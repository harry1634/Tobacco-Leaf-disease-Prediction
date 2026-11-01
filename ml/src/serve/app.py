"""Local prediction service for the web app's diagnosis page.

    python -m src.serve.app                       # serves outputs/centralised/model.pt on http://127.0.0.1:8000
    MODEL_DIR=my_model python -m src.serve.app    # serve outputs/my_model/model.pt instead

POST /predict  (multipart field "file": jpeg/png/webp, max 5 MB)
  -> {"label", "confidence", "top": [{"label", "confidence"}, x3], "modelVersion"}
GET  /health   -> {"status": "ok", "classes": N}

The model is only loaded from a real training run; the service refuses to start without one.
Uploaded images are processed in memory and never stored.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

ML_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ML_ROOT))

from src.models.mobilenet import build_model  # noqa: E402
from src.serve.preprocess import prepare_image  # noqa: E402

MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MODEL_DIR = os.environ.get("MODEL_DIR", "centralised")
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]

ckpt_path = ML_ROOT / "outputs" / MODEL_DIR / "model.pt"
if not ckpt_path.is_file():
    raise SystemExit(f"No trained model at {ckpt_path}. Train one first: python -m src.training.centralised")
ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
CLASS_NAMES: list[str] = ckpt["class_names"]
IMG_SIZE: int = int(ckpt["img_size"])
model = build_model(len(CLASS_NAMES), pretrained=False)
model.load_state_dict(ckpt["state_dict"])
model.eval()
VERSION = f"{MODEL_DIR}-mobilenet_v2-{IMG_SIZE}px"

app = FastAPI(title="Tobacco leaf diagnosis")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["POST", "GET"], allow_headers=["*"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "classes": len(CLASS_NAMES), "modelVersion": VERSION}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Unsupported file type. Use JPEG, PNG or WebP.")
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Image is larger than 5 MB.")
    if not raw:
        raise HTTPException(400, "Empty file.")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "The file is not a readable image.")

    x = torch.from_numpy(prepare_image(img, IMG_SIZE)).unsqueeze(0)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)[0].numpy()
    order = np.argsort(-probs)[:3]
    top = [{"label": CLASS_NAMES[i], "confidence": float(probs[i])} for i in order]
    return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top, "modelVersion": VERSION}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8000")))
