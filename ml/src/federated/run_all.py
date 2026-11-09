"""Run experiments A, B, C, D one after another, then compare them.

    python -m src.federated.run_all                 # full runs from configs/base.yaml (hours on CPU; use Colab/GPU)
    python -m src.federated.run_all --smoke         # 2-round sanity check of all four

Each experiment runs in its own Python process so Ray and PyTorch memory are fully released between runs.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[2]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--rounds", type=int)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--cpu", action="store_true")
    a = ap.parse_args()
    extra = (["--smoke"] if a.smoke else []) + (["--rounds", str(a.rounds)] if a.rounds else []) + (["--seed", str(a.seed)] if a.seed else []) + (["--cpu"] if a.cpu else [])
    for exp in "ABCD":
        print(f"\n=== Experiment {exp} ===", flush=True)
        # Ray on Windows occasionally fails to start a worker; a fresh process normally succeeds, so retry.
        for attempt in range(1, 4):
            done = subprocess.run([sys.executable, "-m", "src.federated.run_experiment", "--exp", exp, *extra], cwd=ML_ROOT)
            if done.returncode == 0:
                break
            print(f"Experiment {exp} failed (attempt {attempt}/3).", flush=True)
        else:
            raise SystemExit(f"Experiment {exp} failed 3 times; see the log above.")
    cmp_args = ["--include-smoke"] if a.smoke else []
    subprocess.run([sys.executable, "-m", "src.export.compare", *cmp_args], cwd=ML_ROOT, check=True)
