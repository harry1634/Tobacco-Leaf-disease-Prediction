"""Tests the prediction service's wiring and input validation.

A RANDOM-weights model is used on purpose: these tests check the API behaves correctly
(types, size limits, response shape), not that predictions are accurate.
"""
import importlib
import io
import shutil
import sys

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image

from src.models.mobilenet import build_model
from src.serve.preprocess import prepare_image, shades_of_gray
from src.dataset.tla import ML_ROOT

NAMES = [f"class_{i}" for i in range(16)]


@pytest.fixture(scope="module")
def client():
    out = ML_ROOT / "outputs" / "_test_random"
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(0)
    model = build_model(16, pretrained=False)
    torch.save({"state_dict": model.state_dict(), "class_names": NAMES, "img_size": 64}, out / "model.pt")
    import os
    os.environ["MODEL_DIR"] = "_test_random"
    sys.modules.pop("src.serve.app", None)
    app_module = importlib.import_module("src.serve.app")
    yield TestClient(app_module.app)
    shutil.rmtree(out, ignore_errors=True)
    os.environ.pop("MODEL_DIR", None)
    sys.modules.pop("src.serve.app", None)


def _png(size=(120, 90), color=(60, 140, 60)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["classes"] == 16


def test_predict_returns_valid_distribution(client):
    r = client.post("/predict", files={"file": ("leaf.png", _png(), "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["label"] in NAMES and 0 <= body["confidence"] <= 1
    assert len(body["top"]) == 3 and body["top"][0]["label"] == body["label"]
    assert body["top"][0]["confidence"] >= body["top"][1]["confidence"] >= body["top"][2]["confidence"]


def test_rejects_wrong_type_empty_corrupt_and_oversize(client):
    assert client.post("/predict", files={"file": ("a.txt", b"hello", "text/plain")}).status_code == 415
    assert client.post("/predict", files={"file": ("a.png", b"", "image/png")}).status_code == 400
    assert client.post("/predict", files={"file": ("a.png", b"not an image", "image/png")}).status_code == 400
    big = b"\x00" * (5 * 1024 * 1024 + 10)
    assert client.post("/predict", files={"file": ("a.png", big, "image/png")}).status_code == 413


def test_preprocess_shape_dtype_and_gray_stays_gray():
    x = prepare_image(Image.new("RGB", (300, 200), (128, 128, 128)), 64)
    assert x.shape == (3, 64, 64) and x.dtype == np.float32
    gray = np.full((4, 4, 3), 100.0, dtype=np.float32)
    assert np.allclose(shades_of_gray(gray), gray, atol=1e-3)  # a neutral image needs no correction


def test_white_balance_removes_colour_cast():
    cast = np.stack([np.full((8, 8), v, dtype=np.float32) for v in (200, 100, 50)], axis=-1)
    out = shades_of_gray(cast)
    assert np.ptp(out.mean(axis=(0, 1))) < np.ptp(cast.mean(axis=(0, 1)))


def test_deployed_function_uses_identical_preprocessing():
    """web/api/_preprocess.py must stay a byte-for-byte copy, or the live site would prepare photos differently."""
    web_copy = ML_ROOT.parent / "web" / "api" / "_preprocess.py"
    original = ML_ROOT / "src" / "serve" / "preprocess.py"
    assert web_copy.read_text(encoding="utf-8") == original.read_text(encoding="utf-8")


def test_tta_views_are_the_four_expected_orientations():
    from src.serve.preprocess import VIEWS, tta_views
    x = np.arange(3 * 4 * 4, dtype=np.float32).reshape(3, 4, 4)
    v = tta_views(x)
    assert v.shape == (VIEWS, 3, 4, 4) and v.dtype == np.float32
    assert np.array_equal(v[0], x) and np.array_equal(v[1], x[:, :, ::-1]) and np.array_equal(v[2], x[:, ::-1, :])
    assert np.array_equal(v[3], np.rot90(x, 1, axes=(1, 2)))


def test_average_probabilities_sum_to_one_and_temperature_sharpens():
    from src.serve.preprocess import average_probabilities
    logits = np.array([[2.0, 1.0, 0.0], [1.5, 1.2, 0.1], [2.2, 0.5, 0.3], [1.0, 1.0, 0.2]])
    p1, p_sharp, p_soft = (average_probabilities(logits, t) for t in (1.0, 0.5, 2.0))
    for p in (p1, p_sharp, p_soft):
        assert abs(p.sum() - 1.0) < 1e-9 and (p >= 0).all()
    assert p_sharp.max() > p1.max() > p_soft.max()          # T < 1 sharpens, T > 1 softens
    assert p_sharp.argmax() == p1.argmax() == p_soft.argmax()  # calibration never changes WHICH disease is named
