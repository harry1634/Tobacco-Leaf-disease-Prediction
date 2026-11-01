"""Step 2: count REAL images (excluding synthetic _paste/_aug files) and look for duplicates.

Run from the ml/ folder:  .venv/Scripts/python.exe src/dataset/audit_dataset.py
Duplicates are found by exact file hash (MD5) and by a small perceptual hash
(8x8 average hash), both within and across the train/validation/test splits.
"""
import hashlib
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
from datasets import load_dataset
from PIL import Image

CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
ds = load_dataset("TamAko783/TPDD_Honglin_CLS", cache_dir=str(CACHE_DIR))
names = ds["train"].features["label"].names


def kind(path: str) -> str:
    stem = Path(path).stem
    if "_paste" in stem:
        return "paste"
    if "_aug" in stem:
        return "aug"
    return "real"


def ahash(img: Image.Image) -> int:
    small = img.convert("L").resize((8, 8))
    px = list(small.getdata())
    avg = sum(px) / 64
    return sum(1 << i for i, p in enumerate(px) if p > avg)


rows = []
for split in ds:
    for ex in ds[split]:
        img = ex["image"]
        path = img.filename
        with open(path, "rb") as f:
            md5 = hashlib.md5(f.read()).hexdigest()
        rows.append(
            dict(split=split, label=names[ex["label"]], kind=kind(path),
                 file=Path(path).name, md5=md5, ahash=ahash(img))
        )
df = pd.DataFrame(rows)

print("\nImage kind per split:\n", pd.crosstab(df["split"], df["kind"]).to_string())
real_train = df[(df.split == "train") & (df.kind == "real")]
tbl = pd.crosstab(df[df.kind == "real"]["label"], df[df.kind == "real"]["split"])
tbl["real_total"] = tbl.sum(axis=1)
print("\nREAL images per class:\n", tbl.sort_values("real_total").to_string())

# ---- exact duplicates ------------------------------------------------------
def report(key: str, title: str):
    groups = df.groupby(key)
    dup = [g for _, g in groups if len(g) > 1]
    cross = [g for g in dup if g["split"].nunique() > 1]
    cross_label = [g for g in dup if g["label"].nunique() > 1]
    print(f"\n{title}: {len(dup)} duplicate groups | across splits: {len(cross)} | conflicting labels: {len(cross_label)}")
    for g in cross[:8]:
        print("  ", list(zip(g["split"], g["label"], g["file"])))

# Synthetic copies are expected to resemble originals, so duplicate checks use real images only.
df_all = df
df = df_all[df_all.kind == "real"]
report("md5", "Exact duplicates (real images only)")
report("ahash", "Perceptual-hash matches (real images only)")

# Source-leaf stems: files look like TV3_4_IMG_0139 -> check shared stems across splits
stem = df["file"].str.replace(r"\.jpg$", "", regex=True)
shared = defaultdict(set)
for s, sp in zip(stem, df["split"]):
    shared[s].add(sp)
multi = {s: v for s, v in shared.items() if len(v) > 1}
print(f"\nFile-name stems appearing in more than one split: {len(multi)}")
print("Name prefixes:", Counter(f.split("_")[0] for f in df["file"]).most_common(6))
