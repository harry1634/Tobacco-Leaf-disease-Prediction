"""Evaluate a saved centralised model on the TEST set, once.

    python -m src.training.final_test --out r4

Use it after choosing a run by validation score only. Adds a "test" entry to outputs/<out>/result.json
and refuses to run twice, so the test set cannot be quietly reused to keep tuning.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch

ML_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ML_ROOT))

from src.dataset.tla import load_tla  # noqa: E402
from src.evaluation.metrics import compute_metrics  # noqa: E402
from src.models.mobilenet import build_model  # noqa: E402
from src.training.local import evaluate  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="folder name under outputs/")
    a = ap.parse_args()
    out = ML_ROOT / "outputs" / a.out
    result_path = out / "result.json"
    result = json.loads(result_path.read_text(encoding="utf-8"))
    if "test" in result:
        sys.exit(f"{a.out} already has a test result; refusing to evaluate the test set again.")
    ckpt = torch.load(out / "model.pt", map_location="cpu")
    names = ckpt["class_names"]
    model = build_model(len(names), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    data = load_tla(ckpt["img_size"], False)
    _, pred = evaluate(model, *data["test"])
    result["test"] = compute_metrics(data["test"][1], pred, names)
    result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    t = result["test"]
    print(f"TEST accuracy={t['accuracy']:.3f}  macroF1={t['macroF1']:.3f}  -> {result_path}")


if __name__ == "__main__":
    main()
