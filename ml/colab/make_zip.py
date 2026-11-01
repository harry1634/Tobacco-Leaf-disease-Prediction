"""Pack the ML code for upload to Colab. Run from the ml folder:  python colab/make_zip.py

Includes only code and config. The dataset, trained models, outputs, virtual environment and any
credentials are NOT included (the dataset downloads itself on Colab).
"""
import zipfile
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
OUT = ML / "ml_for_colab.zip"
KEEP_DIRS = ["src", "configs"]
KEEP_FILES = ["requirements.txt"]

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for d in KEEP_DIRS:
        for f in sorted((ML / d).rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts and f.suffix not in {".pyc", ".pt"}:
                z.write(f, f.relative_to(ML).as_posix())
    for name in KEEP_FILES:
        z.write(ML / name, name)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
