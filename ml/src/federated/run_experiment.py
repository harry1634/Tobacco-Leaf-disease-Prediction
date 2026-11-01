"""Run one federated experiment (A, B, C or D) with Flower's simulation engine.

    python -m src.federated.run_experiment --exp A                  # full run from configs/base.yaml
    python -m src.federated.run_experiment --exp D --smoke          # tiny, fast sanity run

Writes outputs/<run_name>/result.json (config, summary, per-round metrics, per-class, per-client,
confusion matrix). Nothing is invented: every number comes from the run.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

import numpy as np
import torch
import yaml

ML_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ML_ROOT))
os.environ["PYTHONPATH"] = str(ML_ROOT) + os.pathsep + os.environ.get("PYTHONPATH", "")

from flwr.app import ArrayRecord, ConfigRecord  # noqa: E402
from flwr.clientapp import ClientApp  # noqa: E402,F401
from flwr.serverapp import Grid, ServerApp  # noqa: E402
from flwr.simulation import run_simulation  # noqa: E402

from src.evaluation.metrics import rounds_to_convergence  # noqa: E402
from src.federated.client_app import app as client_app  # noqa: E402
from src.federated.common import data_args, get_data  # noqa: E402
from src.federated.server import TobaccoStrategy  # noqa: E402
from src.models.mobilenet import build_model, get_vector  # noqa: E402


def load_config(path: Path, smoke: bool, overrides: dict) -> dict:
    cfg = yaml.safe_load(path.read_text(encoding="utf-8"))
    if smoke:  # small data, few rounds: proves the pipeline runs, says nothing about final quality
        cfg["data"]["img_size"] = 96
        cfg["federated"].update(rounds=2, num_clients=4, clients_per_round=2, min_client_size=5)
        cfg["smoke"] = {"max_train": 160}
    for k, v in overrides.items():
        if v is not None:
            cfg["federated"][k] = v
    return cfg


def run(cfg: dict, exp_key: str, out_root: Path, smoke: bool) -> Path:
    exp = cfg["experiments"][exp_key]
    f, comp = cfg["federated"], cfg["compression"]
    max_train = cfg.get("smoke", {}).get("max_train", 0)
    cpu = os.cpu_count() or 2
    threads = max(1, cpu // int(f["clients_per_round"]))

    flat = {
        "img_size": cfg["data"]["img_size"], "include_synthetic": cfg["data"]["include_synthetic"],
        "num_clients": f["num_clients"], "clients_per_round": f["clients_per_round"],
        "distribution": f["distribution"], "alpha": f["dirichlet_alpha"], "min_size": f["min_client_size"],
        "seed": f["seed"], "max_train": max_train, "local_epochs": f["local_epochs"], "batch_size": f["batch_size"],
        "lr": f["lr"], "compression": exp["compression"], "topk_ratio": comp["topk_ratio"],
        "error_feedback": comp["error_feedback"], "threads": threads,
    }
    data, parts = get_data(*data_args(flat))
    class_names = data["class_names"]

    torch.manual_seed(f["seed"])  # identical starting weights for every experiment
    init_vec = get_vector(build_model(len(class_names), pretrained=cfg["model"]["pretrained"]))

    ad = cfg["adaptive"]
    strategy = TobaccoStrategy(flat, class_names, data["val"], exp["selection"], (ad["w_loss"], ad["w_stale"], ad["w_size"]))
    server_app = ServerApp()

    @server_app.main()
    def main(grid: Grid, context) -> None:  # noqa: ARG001
        strategy.start(grid=grid, initial_arrays=ArrayRecord([init_vec]), num_rounds=int(f["rounds"]),
                       train_config=ConfigRecord({k: v for k, v in flat.items()}), evaluate_fn=strategy.evaluate_global)

    run_simulation(
        server_app=server_app, client_app=client_app, num_supernodes=int(f["num_clients"]),
        # With a GPU, clients share it (each takes 1/clients_per_round of it); without one, num_gpus is 0.
        backend_config={"client_resources": {"num_cpus": threads,
                                             "num_gpus": (1.0 / int(f["clients_per_round"])) if torch.cuda.is_available() else 0.0},
                        "init_args": {"include_dashboard": False}},
    )

    if not strategy.rounds:
        raise RuntimeError("No rounds were recorded; the simulation did not complete.")
    final = strategy.final_report()
    t, rounds = final["test"], strategy.rounds
    total_up = sum(r["uplinkBytes"] for r in rounds)
    total_all = sum(r["commBytes"] for r in rounds)
    name = exp["name"] + (" (smoke test)" if smoke else "")
    result = {
        "id": f"{exp_key}-{'smoke' if smoke else 'full'}-s{f['seed']}",
        "name": name, "status": "completed", "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "config": {
            "numClients": f["num_clients"], "clientsPerRound": f["clients_per_round"], "rounds": f["rounds"],
            "selectionStrategy": exp["selection"], "compression": exp["compression"],
            "topkRatio": comp["topk_ratio"] if exp["compression"] == "topk" else None,
            "distribution": f["distribution"], "model": cfg["model"]["name"],
            "dataset": f"TLA 16-class (real images only), {sum(len(p) for p in parts)} train images", "seed": f["seed"],
        },
        "summary": {
            "accuracy": t["accuracy"], "macroPrecision": t["macroPrecision"], "macroRecall": t["macroRecall"],
            "macroF1": t["macroF1"], "roundsToConvergence": rounds_to_convergence([r["accuracy"] for r in rounds]),
            "totalCommBytes": total_all, "uplinkBytes": total_up,
        },
        "classNames": class_names, "perClass": t["perClass"], "perClient": final["perClient"],
        "confusionMatrix": t["confusionMatrix"], "rounds": rounds,
    }
    out = out_root / result["id"]
    out.mkdir(parents=True, exist_ok=True)
    (out / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"\nSaved {out / 'result.json'}")
    print(f"test accuracy={t['accuracy']:.3f} macroF1={t['macroF1']:.3f} uplink={total_up/1e6:.1f} MB total={total_all/1e6:.1f} MB")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--exp", required=True, choices=list("ABCD"))
    ap.add_argument("--config", default=str(ML_ROOT / "configs" / "base.yaml"))
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--rounds", type=int)
    ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    cfg = load_config(Path(a.config), a.smoke, {"rounds": a.rounds, "seed": a.seed})
    run(cfg, a.exp, ML_ROOT / "outputs", a.smoke)
