"""Turn an uploaded photo into the model input, matching how the training data was prepared.

The training dataset's images were white-balanced with the Shades-of-Gray colour-constancy method
(dataset card: "Shades-of-Gray colour-constancy normalised"). The exact parameters were not
published where we read them, so this uses the standard setting (Minkowski power p = 6). It is an
approximation: photos from different cameras and lighting than the dataset may still be
"out of distribution", which lowers reliability. Treat predictions as estimates.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def shades_of_gray(rgb: np.ndarray, p: float = 6.0) -> np.ndarray:
    """White-balance a float RGB image in [0, 255] (HxWx3) with the Shades-of-Gray method."""
    illum = np.power(np.mean(np.power(rgb, p), axis=(0, 1)), 1.0 / p)  # per-channel Minkowski mean
    illum = np.maximum(illum, 1e-6)
    gray = np.linalg.norm(illum) / np.sqrt(3.0)
    return np.clip(rgb * (gray / illum), 0, 255)


def prepare_image(img: Image.Image, size: int) -> np.ndarray:
    """PIL image -> float32 array shaped (3, size, size), balanced and ImageNet-normalised."""
    img = img.convert("RGB")
    balanced = shades_of_gray(np.asarray(img, dtype=np.float32))
    resized = Image.fromarray(balanced.astype(np.uint8)).resize((size, size), Image.BILINEAR)
    chw = np.asarray(resized, dtype=np.float32).transpose(2, 0, 1) / 255.0
    return ((chw - _MEAN) / _STD).astype(np.float32)
