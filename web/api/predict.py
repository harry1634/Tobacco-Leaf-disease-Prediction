"""Prediction function for the deployed site (Vercel Python function, ONNX model, no PyTorch).

POST /api/predict  (multipart field "file": jpeg/png/webp)
  -> {"label", "confidence", "top": [{"label", "confidence"}, x3], "modelVersion"}
GET  /api/predict  -> {"status": "ok", "classes": N, "modelVersion": ...}

The same model and the same image preparation as the local service (ml/src/serve), converted with
ml/src/serve/export_onnx.py, which checks that both give identical answers. Images are processed in
memory and never stored. Vercel limits request bodies to 4.5 MB, so the page shrinks big photos first.
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from _preprocess import prepare_image  # noqa: E402

MAX_BYTES = 4 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp"}

_meta = json.loads((HERE / "_model" / "classes.json").read_text(encoding="utf-8"))
CLASS_NAMES: list[str] = _meta["classNames"]
IMG_SIZE: int = int(_meta["imgSize"])
VERSION: str = _meta["modelVersion"]
_session = ort.InferenceSession(str(HERE / "_model" / "model.onnx"), providers=["CPUExecutionProvider"])

app = FastAPI(title="Tobacco leaf diagnosis")


def _health() -> dict:
    return {"status": "ok", "classes": len(CLASS_NAMES), "modelVersion": VERSION}


async def _predict(file: UploadFile) -> dict:
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Unsupported file type. Use JPEG, PNG or WebP.")
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Image is larger than 4 MB.")
    if not raw:
        raise HTTPException(400, "Empty file.")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "The file is not a readable image.")

    x = prepare_image(img, IMG_SIZE)[None]
    logits = _session.run(None, {"input": x})[0][0].astype(np.float64)
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    order = np.argsort(-probs)[:3]
    top = [{"label": CLASS_NAMES[i], "confidence": float(probs[i])} for i in order]
    return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top, "modelVersion": VERSION}


# Registered under both paths so it works however the platform forwards the request path.
for _path in ("/api/predict", "/"):
    app.get(_path)(_health)

    @app.post(_path)
    async def predict(file: UploadFile = File(...)) -> dict:  # noqa: F811 - one handler per path, same body
        return await _predict(file)
