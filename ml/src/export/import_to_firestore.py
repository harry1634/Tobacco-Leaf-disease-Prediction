"""Copy experiment results into Firestore so the web dashboard can show them.

    # real project (needs a service-account key file that stays on your computer, never in git):
    python -m src.export.import_to_firestore --uid <FIREBASE_USER_UID> --service-account path/to/key.json

    # local emulator (used by the automated test; no credentials needed):
    python -m src.export.import_to_firestore --uid alice --emulator 127.0.0.1:8080 --project demo-tobacco

    --dry-run prints what would be written. Add --include-smoke to also import smoke-test runs.

Writes   users/{uid}/experiments/{id}              (config, summary, perClass, perClient, confusionMatrix)
and      users/{uid}/experiments/{id}/rounds/r###  (one document per round)
The Admin SDK bypasses Firestore rules, so only someone holding the key can run this; browsers cannot write these paths.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[2]


def clean(v):
    """Make a value Firestore-safe: NaN/inf are not stored (a missing value must stay missing, not become 0)."""
    if isinstance(v, float) and not math.isfinite(v):
        return None
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    return v


def split_result(result: dict) -> tuple[str, dict, list[dict]]:
    doc = {k: v for k, v in result.items() if k not in ("rounds", "id")}
    doc["createdAt"] = dt.datetime.fromisoformat(result["createdAt"])
    return result["id"], clean(doc), [clean(r) for r in result["rounds"]]


def get_client(args):
    if args.emulator:
        os.environ["FIRESTORE_EMULATOR_HOST"] = args.emulator
        from google.auth.credentials import AnonymousCredentials
        from google.cloud import firestore
        return firestore.Client(project=args.project, credentials=AnonymousCredentials())
    if not args.service_account or not Path(args.service_account).is_file():
        raise SystemExit("Provide --service-account <key.json> (Firebase console > Project settings > Service accounts).")
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_admin.initialize_app(credentials.Certificate(args.service_account))
    return firestore.client()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uid", required=True, help="Firebase Auth UID of the user who should own these results")
    ap.add_argument("--service-account")
    ap.add_argument("--emulator")
    ap.add_argument("--project", default="demo-tobacco")
    ap.add_argument("--include-smoke", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    pattern = "*-*-s*" if args.include_smoke else "*-full-s*"
    files = sorted((ML_ROOT / "outputs").glob(f"{pattern}/result.json"))
    if not files:
        raise SystemExit("No result.json files found in outputs/. Run the experiments first (or pass --include-smoke).")

    db = None if args.dry_run else get_client(args)
    for f in files:
        exp_id, doc, rounds = split_result(json.loads(f.read_text(encoding="utf-8")))
        print(f"{'[dry-run] ' if args.dry_run else ''}{exp_id}: {len(rounds)} rounds -> users/{args.uid}/experiments/{exp_id}")
        if args.dry_run:
            continue
        ref = db.collection("users").document(args.uid).collection("experiments").document(exp_id)
        batch = db.batch()
        batch.set(ref, doc)  # set() replaces, so re-importing the same run is safe (idempotent)
        for r in rounds:
            batch.set(ref.collection("rounds").document(f"r{int(r['round']):03d}"), r)
        batch.commit()
    print("Done.")


if __name__ == "__main__":
    main()
