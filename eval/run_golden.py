#!/usr/bin/env python3
"""
Run the golden cases through the probe contract on Studio Next, through real
consensus, and publish what came out.

    python eval/run_golden.py              # every case not yet decided
    python eval/run_golden.py 1 4 H2       # just these
    python eval/run_golden.py --report     # rewrite results.md from results.json

eval/golden.json was written before the first run. H1 to H3 are held out: run
once, reported as they came out, never used to tune the rubric. A case whose
round produced no verdict (the committee timed out or could not agree) may be
sent again under a new id, and both attempts stay in the record. A case that
produced a verdict is never sent again, whatever the verdict was.

Every row in results.json carries the transaction hash, so anybody can open
the explorer and read the stored result for themselves.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

# A model's reason can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
#: Each network keeps its own results: eval/ for studionet, eval/studio-next/ for Studio Next.
RESULTS = C.EVAL_DIR / "results.json"
REPORT = C.EVAL_DIR / "results.md"
CONTRACT = C.ROOT / "contracts" / "keepalive.py"


def rubric_sha() -> str:
    import ast

    tree = ast.parse(CONTRACT.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "CHECK":
            return hashlib.sha256(ast.literal_eval(node.value).encode("utf-8")).hexdigest()
    raise SystemExit("no CHECK constant")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"attempts": []}


def decided(results: dict, case_id: str) -> bool:
    return any(a["case"] == case_id and a.get("verdict") for a in results["attempts"])


def run(ids: list[str]) -> None:
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    entry = C.deployment()
    probe = entry.get("probe")
    if not probe:
        raise SystemExit("no probe in contracts/FROZEN.json. Run: python scripts/deploy.py --only-probes")
    owner = C.accounts("owner")["owner"]
    chain = C.Chain(owner)
    chain.ensure(owner.address, minimum_gen=100)
    results = load_results()
    results.update(
        {
            "probe": probe,
            "probe_sha256": entry.get("probe_sha256"),
            "golden_sha256": C.sha256_file(GOLDEN),
            "rubric_sha256": rubric_sha(),
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
        }
    )
    for case in golden["cases"]:
        cid = case["id"]
        if ids and cid not in ids:
            continue
        if decided(results, cid):
            print(f"{cid}: already decided, never sent again")
            continue
        tries = sum(1 for a in results["attempts"] if a["case"] == cid)
        run_id = cid if tries == 0 else f"{cid}#{tries + 1}"
        print(f"\n{run_id} {case['title']} (expected {case['expected']})")
        outcome = chain.send(
            probe,
            "probe",
            [run_id, case["mission"], case["start"], case["end"], case["report"], case["links"]],
        )
        attempt = {
            "case": cid,
            "run_id": run_id,
            "held_out": bool(case.get("held_out")),
            "expected": case["expected"],
            "tx": outcome["hash"],
            "sent_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "consensus": "decided" if outcome["ok"] else outcome["detail"],
        }
        if outcome["ok"]:
            stored = chain.read_json(probe, "get_result", [run_id])
            attempt.update(
                {
                    "verdict": stored["verdict"],
                    "reason": stored["reason"],
                    "pages": stored["pages"],
                    "readable": stored["readable"],
                    "checked_at": stored["checked_at"],
                }
            )
        # Saved before anything is printed: a result that exists on chain must
        # never be lost to a failure on this side of the wire.
        results["attempts"].append(attempt)
        RESULTS.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        if outcome["ok"]:
            mark = "match" if attempt["verdict"] == case["expected"] else "MISS"
            print(f"  {attempt['verdict']} ({mark}): {attempt['reason']}")
        else:
            print(f"  no verdict: {outcome['detail']}")
    write_report(results, golden)


def write_report(results: dict, golden: dict) -> None:
    explorer = results.get("explorer", C.EXPLORER)
    final: dict = {}
    for attempt in results["attempts"]:
        if attempt.get("verdict"):
            final[attempt["case"]] = attempt
    lines = [
        f"# Golden cases, run through consensus on {C.NETWORK} (chain {C.CHAIN_ID})",
        "",
        "Published as they came out. Nothing here was re-run to change a verdict: a case is sent again",
        "only when its round produced no verdict at all, and every attempt is listed.",
        "",
        f"- probe contract `{results.get('probe')}` (source sha256 `{results.get('probe_sha256')}`)",
        f"- rubric sha256 `{results.get('rubric_sha256')}`, the same constant as `contracts/keepalive.py`",
        f"- golden.json sha256 `{results.get('golden_sha256')}`, written {golden.get('written_at')} before the first run",
        "",
    ]
    for title, held in (("Cases 1 to 8", False), ("Held out, H1 to H3, run once", True)):
        rows = [c for c in golden["cases"] if bool(c.get("held_out")) == held]
        done = [final[c["id"]] for c in rows if c["id"] in final]
        hits = sum(1 for a in done if a["verdict"] == a["expected"])
        lines += [f"## {title}: {hits} of {len(done)} as expected" + (f", {len(rows) - len(done)} not decided" if len(done) < len(rows) else ""), ""]
        lines += ["| case | expected | verdict | reason | pages read | tx |", "|---|---|---|---|---|---|"]
        for case in rows:
            attempt = final.get(case["id"])
            if attempt is None:
                lines.append(f"| {case['id']} {case['title']} | {case['expected']} | not decided | | | |")
                continue
            ok = "" if attempt["verdict"] == attempt["expected"] else " (miss)"
            reason = attempt["reason"].replace("|", "/")
            lines.append(
                f"| {case['id']} {case['title']} | {attempt['expected']} | **{attempt['verdict']}**{ok} | {reason} | "
                f"{attempt['readable']} of {attempt['pages']} | [{attempt['tx'][:10]}]({explorer}/tx/{attempt['tx']}) |"
            )
        lines.append("")
    lines += ["## Every attempt", "", "| run id | consensus | verdict | tx |", "|---|---|---|---|"]
    for attempt in results["attempts"]:
        lines.append(
            f"| {attempt['run_id']} | {attempt['consensus'][:70]} | {attempt.get('verdict', '')} | "
            f"[{attempt['tx'][:10]}]({explorer}/tx/{attempt['tx']}) |"
        )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}")


def main() -> int:
    if "--report" in sys.argv:
        write_report(load_results(), json.loads(GOLDEN.read_text(encoding="utf-8")))
        return 0
    run([arg for arg in sys.argv[1:] if not arg.startswith("--")])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
