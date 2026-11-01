"""Step 1: download the TLA dataset and report what is actually in it.

Run from the ml/ folder:  .venv/Scripts/python.exe src/dataset/inspect_dataset.py
Nothing here is assumed: class names, splits and counts all come from the data.
"""
from collections import Counter
from pathlib import Path

from datasets import load_dataset

CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"

ds = load_dataset("TamAko783/TPDD_Honglin_CLS", cache_dir=str(CACHE_DIR))

print("Splits:", {name: len(split) for name, split in ds.items()})
for name, split in ds.items():
    print(f"\n[{name}] features: {split.features}")

# ---- per-class counts per split -------------------------------------------
import pandas as pd

names = ds["train"].features["label"].names
table = pd.DataFrame(
    {split: Counter(names[i] for i in ds[split]["label"]) for split in ds}
).fillna(0).astype(int)
table["total"] = table.sum(axis=1)
print("\nImages per class per split:\n", table.sort_values("total").to_string())

# ---- can synthetic (_paste / _aug) images be identified? -------------------
sample = ds["train"][0]["image"]
print("\nImage object type:", type(sample).__name__, "| filename attribute:", getattr(sample, "filename", None))
print("Dataset columns:", ds["train"].column_names)

# ---- image sizes / modes (decodes a sample of up to 200 train images) ------
sizes, modes = Counter(), Counter()
for i in range(0, len(ds["train"]), max(1, len(ds["train"]) // 200)):
    img = ds["train"][i]["image"]
    sizes[img.size] += 1
    modes[img.mode] += 1
print("Image modes (sampled):", dict(modes))
print("Most common sizes (sampled):", sizes.most_common(5), "| distinct:", len(sizes))
