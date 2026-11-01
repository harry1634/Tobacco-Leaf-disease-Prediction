"""Load the Tobacco Leaf Abnormality (TLA) dataset into memory as small uint8 arrays.

Source: Hugging Face "TamAko783/TPDD_Honglin_CLS" (a re-split of the TLA/TPDD data by
Lin et al., Macao Polytechnic University). Class names come from the data, not from this code.

Synthetic training images (file names containing "_paste" or "_aug") are excluded by
default, so models train and are evaluated on real photographs only.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ML_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ML_ROOT / "data" / "raw"
PROCESSED_DIR = ML_ROOT / "data" / "processed"
HF_NAME = "TamAko783/TPDD_Honglin_CLS"


def image_kind(file_name: str) -> str:
    """'real', 'paste' (synthetic lesion copy-paste) or 'aug' (synthetic oversampling)."""
    stem = Path(file_name).stem
    if "_paste" in stem:
        return "paste"
    if "_aug" in stem:
        return "aug"
    return "real"


def _build_cache(img_size: int, path: Path) -> None:
    from datasets import load_dataset  # imported lazily: only needed the first time

    ds = load_dataset(HF_NAME, cache_dir=str(RAW_DIR))
    class_names = ds["train"].features["label"].names
    xs, ys, splits, kinds, files = [], [], [], [], []
    for split in ds:
        for ex in ds[split]:
            img = ex["image"]
            files.append(Path(img.filename).name)
            kinds.append(image_kind(files[-1]))
            splits.append("val" if split == "validation" else split)
            ys.append(ex["label"])
            arr = np.asarray(img.convert("RGB").resize((img_size, img_size), Image.BILINEAR), dtype=np.uint8)
            xs.append(arr.transpose(2, 0, 1))  # HWC -> CHW
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        x=np.stack(xs), y=np.array(ys, dtype=np.int64), split=np.array(splits), kind=np.array(kinds),
        fname=np.array(files), class_names=np.array(class_names),
    )


def load_tla(img_size: int = 160, include_synthetic: bool = False) -> dict:
    """Return {'train': (x, y), 'val': (x, y), 'test': (x, y), 'class_names': [...]}.

    x is uint8 with shape (N, 3, img_size, img_size); y is int64 class indices.
    """
    path = PROCESSED_DIR / f"tla_{img_size}.npz"
    if not path.exists():
        _build_cache(img_size, path)
    z = np.load(path, allow_pickle=False)
    keep_synth = np.ones(len(z["y"]), dtype=bool) if include_synthetic else (z["kind"] == "real")
    out: dict = {"class_names": [str(c) for c in z["class_names"]]}
    for split in ("train", "val", "test"):
        m = (z["split"] == split) & keep_synth
        out[split] = (z["x"][m], z["y"][m])
    # Synthetic images must never leak into evaluation splits.
    assert (z["kind"][(z["split"] != "train")] == "real").all(), "synthetic image found outside train split"
    return out
