"""Convert a trained model to ONNX and check it gives the same answers as the PyTorch original.

    python -m src.serve.export_onnx --model centralised_224 --out ../web/api/_model

Writes model.onnx and classes.json. Then runs every TEST photo through both models (using the
prediction service's own preparation) and prints how often they agree. Needs: pip install onnx onnxruntime onnxscript
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch

ML_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ML_ROOT))

from src.models.mobilenet import build_model  # noqa: E402
from src.serve.preprocess import prepare_image  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="centralised_224")
    ap.add_argument("--out", default=str(ML_ROOT.parent / "web" / "api" / "_model"))
    ap.add_argument("--temperature", type=float, help="calibration temperature (default: outputs/<model>/calibration.json, else 1.0)")
    a = ap.parse_args()

    ckpt = torch.load(ML_ROOT / "outputs" / a.model / "model.pt", map_location="cpu", weights_only=False)
    names, size = ckpt["class_names"], int(ckpt["img_size"])
    model = build_model(len(names), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros(1, 3, size, size)
    torch.onnx.export(model, dummy, str(out / "model.onnx"), input_names=["input"], output_names=["logits"],
                      dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17, dynamo=False)
    calib = ML_ROOT / "outputs" / a.model / "calibration.json"
    temperature = a.temperature or (json.loads(calib.read_text(encoding="utf-8"))["temperature"] if calib.is_file() else 1.0)
    (out / "classes.json").write_text(json.dumps({"classNames": names, "imgSize": size, "modelVersion": f"{a.model}-mobilenet_v2-{size}px-tta4", "temperature": temperature}), encoding="utf-8")
    print(f"wrote {out / 'model.onnx'} ({(out / 'model.onnx').stat().st_size / 1e6:.1f} MB)")

    import onnxruntime as ort
    from datasets import load_dataset
    from src.dataset.tla import HF_NAME, RAW_DIR

    sess = ort.InferenceSession(str(out / "model.onnx"), providers=["CPUExecutionProvider"])
    ds = load_dataset(HF_NAME, cache_dir=str(RAW_DIR))["test"]
    agree, worst, correct_t, correct_o, n = 0, 0.0, 0, 0, 0
    with torch.no_grad():
        for ex in ds:
            x = prepare_image(ex["image"], size)[None]
            lt = model(torch.from_numpy(x)).numpy()
            lo = sess.run(None, {"input": x})[0]
            worst = max(worst, float(np.abs(lt - lo).max()))
            agree += int(lt.argmax() == lo.argmax())
            correct_t += int(lt.argmax() == ex["label"])
            correct_o += int(lo.argmax() == ex["label"])
            n += 1
    print(f"test photos: {n}; same predicted class: {agree}/{n}; largest logit difference: {worst:.2e}")
    print(f"accuracy PyTorch {correct_t / n:.3f}  ONNX {correct_o / n:.3f}")


if __name__ == "__main__":
    main()
