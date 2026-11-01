"""Classification metrics. Macro averages weight every class equally (important with rare classes)."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, class_names: list[str]) -> dict:
    labels = list(range(len(class_names)))
    p, r, f, support = precision_recall_fscore_support(y_true, y_pred, labels=labels, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macroPrecision": float(p.mean()),
        "macroRecall": float(r.mean()),
        "macroF1": float(f.mean()),
        "perClass": [
            {"label": class_names[i], "precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(support[i])}
            for i in labels
        ],
        # Stored as a list of rows-as-objects because Firestore does not allow nested arrays.
        "confusionMatrix": [{"actual": class_names[i], "counts": [int(v) for v in cm[i]]} for i in labels],
    }


def rounds_to_convergence(accuracy_by_round: list[float], tolerance: float = 0.01) -> int | None:
    """First round (1-based) whose accuracy is within `tolerance` of the best accuracy reached."""
    if not accuracy_by_round:
        return None
    best = max(accuracy_by_round)
    for i, a in enumerate(accuracy_by_round, start=1):
        if a >= best - tolerance:
            return i
    return None
