"""Centralised MobileNetV2 baseline: all training images in one place (no federation).

    python -m src.training.centralised            # settings from configs/base.yaml
    python -m src.training.centralised --epochs 1 --max-train 200   # quick check

Gives an upper-bound reference for the federated runs. Picks the epoch with the best VALIDATION
macro-F1, then reports the TEST set once with that checkpoint. Saves outputs/centralised/.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch
import yaml

ML_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ML_ROOT))

from src.dataset.tla import load_tla  # noqa: E402
from src.evaluation.metrics import compute_metrics  # noqa: E402
from src.models.mobilenet import build_model  # noqa: E402
from src.training.local import evaluate, train_local  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ML_ROOT / "configs" / "base.yaml"))
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--max-train", type=int, default=0)
    ap.add_argument("--img-size", type=int)
    ap.add_argument("--out", default="centralised", help="folder name under outputs/")
    ap.add_argument("--lr", type=float, help="starting learning rate (default from config)")
    ap.add_argument("--cosine", action="store_true", help="decay the learning rate to ~0 over the epochs")
    ap.add_argument("--strong-aug", action="store_true", help="rotation, zoom and colour jitter")
    ap.add_argument("--label-smoothing", type=float, default=0.0)
    ap.add_argument("--skip-test", action="store_true",
                    help="tune on validation only; evaluate the test set later with src.training.final_test")
    ap.add_argument("--balance", action="store_true", help="weight the loss by 1/sqrt(class frequency)")
    ap.add_argument("--include-synthetic", action="store_true",
                    help="also train on the dataset's synthetic (_aug/_paste) images; they are never used for validation or test")
    ap.add_argument("--train-on-all", action="store_true",
                    help="FINAL model only: train on train+val+test photos for a fixed number of epochs and keep the last one. "
                         "No score can be measured afterwards, so quote the score from the earlier held-out evaluation.")
    a = ap.parse_args()
    cfg = yaml.safe_load(Path(a.config).read_text(encoding="utf-8"))
    c = cfg["centralised"]
    epochs = a.epochs or c["epochs"]
    seed = cfg["federated"]["seed"]
    img = a.img_size or cfg["data"]["img_size"]

    torch.manual_seed(seed)
    data = load_tla(img, cfg["data"]["include_synthetic"] or a.include_synthetic)
    names = data["class_names"]
    x, y = data["train"]
    if a.train_on_all:
        x = np.concatenate([x, data["val"][0], data["test"][0]])
        y = np.concatenate([y, data["val"][1], data["test"][1]])
    if a.max_train and a.max_train < len(y):
        keep = np.sort(np.random.default_rng(seed).permutation(len(y))[:a.max_train])
        x, y = x[keep], y[keep]
    print(f"train={len(y)} val={len(data['val'][1])} test={len(data['test'][1])} classes={len(names)}")

    weights = None
    if a.balance:
        counts = np.bincount(y, minlength=len(names)).astype(np.float64)
        weights = 1.0 / np.sqrt(np.maximum(counts, 1))
        weights = weights / weights.mean()
    lr0 = a.lr or c["lr"]
    options = {"lr": lr0, "cosine": a.cosine, "strongAug": a.strong_aug, "labelSmoothing": a.label_smoothing,
               "balance": a.balance, "imgSize": img, "includeSynthetic": a.include_synthetic or cfg["data"]["include_synthetic"],
               "trainOnAll": a.train_on_all}
    print("options:", options)

    model = build_model(len(names), pretrained=cfg["model"]["pretrained"])
    best_f1, best_state, history = -1.0, None, []
    for ep in range(1, epochs + 1):
        t0 = time.time()
        lr = lr0 * 0.5 * (1 + math.cos(math.pi * (ep - 1) / epochs)) if a.cosine else lr0
        tl = train_local(model, x, y, epochs=1, lr=lr, batch_size=c["batch_size"], seed=seed * 1000 + ep,
                         strong_augment=a.strong_aug, label_smoothing=a.label_smoothing, class_weights=weights)
        if a.train_on_all:  # nothing is held out, so there is nothing honest to measure; just keep going
            history.append({"epoch": ep, "trainLoss": tl})
            print(f"epoch {ep:2d}  train_loss={tl:.3f}  ({time.time()-t0:.0f}s)")
            continue
        vl, vp = evaluate(model, *data["val"])
        m = compute_metrics(data["val"][1], vp, names)
        history.append({"epoch": ep, "trainLoss": tl, "valLoss": vl, "valAccuracy": m["accuracy"], "valMacroF1": m["macroF1"]})
        print(f"epoch {ep:2d}  train_loss={tl:.3f}  val_loss={vl:.3f}  val_acc={m['accuracy']:.3f}  val_macroF1={m['macroF1']:.3f}  ({time.time()-t0:.0f}s)")
        if m["macroF1"] > best_f1:
            best_f1, best_state = m["macroF1"], {k: v.clone() for k, v in model.state_dict().items()}

    out = ML_ROOT / "outputs" / a.out
    out.mkdir(parents=True, exist_ok=True)
    if a.train_on_all:
        final = {k: v.clone() for k, v in model.state_dict().items()}
        torch.save({"state_dict": final, "class_names": names, "img_size": img}, out / "model.pt")  # git-ignored
        (out / "result.json").write_text(json.dumps({"epochs": epochs, "options": options, "trainedOn": "train+val+test", "history": history,
                                                     "note": "No held-out data was left, so no score exists for this model."}, indent=2), encoding="utf-8")
        print(f"\nTrained on all {len(y)} photos; saved the last epoch (no score is possible) -> {out}")
        return
    model.load_state_dict(best_state)
    torch.save({"state_dict": best_state, "class_names": names, "img_size": img}, out / "model.pt")  # git-ignored
    result = {"epochs": epochs, "options": options, "bestValMacroF1": best_f1, "history": history}
    if a.skip_test:
        (out / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"\nbest validation macro-F1={best_f1:.3f} (test set not touched) -> {out}")
        return
    _, tp = evaluate(model, *data["test"])
    test = compute_metrics(data["test"][1], tp, names)
    result["test"] = test
    (out / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"\nTEST (best val-F1 epoch): accuracy={test['accuracy']:.3f}  macroF1={test['macroF1']:.3f}  -> {out}")


if __name__ == "__main__":
    main()
