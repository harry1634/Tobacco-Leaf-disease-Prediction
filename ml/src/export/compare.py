"""Compare finished experiments side by side.

    python -m src.export.compare                    # uses outputs/*-full-*/result.json
    python -m src.export.compare --include-smoke    # also include smoke-test runs (for pipeline checks only)
    python -m src.export.compare --seed 42          # only runs made with that seed

Writes outputs/comparison.json and outputs/comparison.md.
"Rounds to common target": target = 95% of the LOWEST best validation accuracy among the compared
runs, so every run can reach it; reported is the first round at which each run's validation accuracy
reached the target. Communication savings are relative to the first run listed (experiment A).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[2]


def load_runs(include_smoke: bool, seed: int | None = None) -> list[dict]:
    pattern = "*-*-s*" if include_smoke else "*-full-s*"
    if seed is not None:  # compare one seed at a time so experiment A is always the baseline
        pattern = pattern[:-1] + str(seed)
    runs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((ML_ROOT / "outputs").glob(f"{pattern}/result.json"))]
    return runs


def compare(runs: list[dict]) -> list[dict]:
    best = [max(r["accuracy"] for r in run["rounds"]) for run in runs]
    target = 0.95 * min(best)
    base_up = runs[0]["summary"]["uplinkBytes"]
    base_total = runs[0]["summary"]["totalCommBytes"]
    rows = []
    for run in runs:
        s = run["summary"]
        reached = next((r["round"] for r in run["rounds"] if r["accuracy"] >= target), None)
        rows.append({
            "experiment": run["name"], "selection": run["config"]["selectionStrategy"], "compression": run["config"]["compression"],
            "testAccuracy": s["accuracy"], "testMacroF1": s["macroF1"], "roundsToConvergence": s["roundsToConvergence"],
            "roundsToCommonTarget": reached, "commonTargetAccuracy": target,
            "uplinkMB": s["uplinkBytes"] / 1e6, "totalMB": s["totalCommBytes"] / 1e6,
            "uplinkVsFirst": s["uplinkBytes"] / base_up if base_up else None,
            "totalVsFirst": s["totalCommBytes"] / base_total if base_total else None,
        })
    return rows


def to_markdown(rows: list[dict]) -> str:
    head = "| Experiment | Selection | Compression | Test acc | Test macro-F1 | Rounds to converge | Rounds to common target | Uplink MB | Total MB | Total vs first |\n|---|---|---|---|---|---|---|---|---|---|\n"
    f = lambda v, p=3: "n/a" if v is None else (f"{v:.{p}f}" if isinstance(v, float) else str(v))  # noqa: E731
    body = "".join(
        f"| {r['experiment']} | {r['selection']} | {r['compression']} | {f(r['testAccuracy'])} | {f(r['testMacroF1'])} | "
        f"{f(r['roundsToConvergence'])} | {f(r['roundsToCommonTarget'])} | {f(r['uplinkMB'], 1)} | {f(r['totalMB'], 1)} | {f(r['totalVsFirst'], 2)}x |\n"
        for r in rows
    )
    return head + body


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-smoke", action="store_true")
    ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    runs = load_runs(a.include_smoke, a.seed)
    if not runs:
        raise SystemExit("No result files found in outputs/. Run the experiments first.")
    rows = compare(runs)
    out = ML_ROOT / "outputs"
    (out / "comparison.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    md = to_markdown(rows)
    (out / "comparison.md").write_text(md, encoding="utf-8")
    print(md)
