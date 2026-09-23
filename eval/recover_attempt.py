#!/usr/bin/env python3
"""
Record a probe attempt that exists on chain but never reached results.json.

    python eval/recover_attempt.py <case id> <run id> <tx hash>

Used once, for case 4 of the first golden run: the transaction was decided and
its result stored on chain, and the runner then stopped on a Windows console
encoding error before saving it. The result is read back from the probe
contract and the transaction's receipt is checked, so nothing here is typed in
by hand except the hash, and the attempt is marked as recovered.
"""

from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent


def main() -> int:
    case_id, run_id, tx = sys.argv[1:4]
    results_path = C.EVAL_DIR / "results.json"
    results = json.loads(results_path.read_text(encoding="utf-8"))
    if any(a["run_id"] == run_id for a in results["attempts"]):
        print(f"{run_id} is already recorded")
        return 0
    golden = json.loads((HERE / "golden.json").read_text(encoding="utf-8"))
    case = next(c for c in golden["cases"] if c["id"] == case_id)
    chain = C.Chain(C.accounts("owner")["owner"])
    outcome = C.check(chain.wait(tx, retries=5))
    if not outcome["ok"]:
        raise SystemExit(f"{tx} was not a successful probe: {outcome['detail']}")
    stored = chain.read_json(C.deployment()["probe"], "get_result", [run_id])
    results["attempts"].append(
        {
            "case": case_id,
            "run_id": run_id,
            "held_out": bool(case.get("held_out")),
            "expected": case["expected"],
            "tx": tx,
            "sent_at": stored["checked_at"],
            "consensus": "decided",
            "verdict": stored["verdict"],
            "reason": stored["reason"],
            "pages": stored["pages"],
            "readable": stored["readable"],
            "checked_at": stored["checked_at"],
            "recovered": "read back from the chain after the runner stopped before saving it",
        }
    )
    results_path.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{run_id}: {stored['verdict']} | {stored['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
