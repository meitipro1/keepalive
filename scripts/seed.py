#!/usr/bin/env python3
"""
Seed DEMO streams on Studio Next, in every state, through the real contract and
the real judge.

    python scripts/seed.py              # open, fund, and drive the streams for four periods
    python scripts/seed.py --periods 2  # shorter

DEMO streams run ten-minute periods with five minutes of grace. A ten-minute
window only has real work in it if somebody worked in those ten minutes, so the
live streams here point at busy public repositories, and every report is written
from the commits that actually landed in the window so far, quoted by title,
with links to those commits. The builder accounts are ours; the work is the
repositories'. The site says so on every DEMO stream.

Nothing here chooses a verdict. Every ALIVE, QUIET, OFF MISSION or UNREADABLE
the site shows came out of validator consensus on the transaction recorded in
docs/seed.<network>.json. Two reports are deliberately unbacked, and say so below: the
Moment.js stream claims a refactor that never happened, which is the demo of a
quiet period, and the podcast stream links code, which is the demo of off
mission.
"""

from __future__ import annotations

import datetime
import json
import sys
import time
import urllib.request

import chain as C
import keeper as K

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RECORD = C.ROOT / "docs" / f"seed.{C.NETWORK}.json"
PERIOD = 600
REPORT_AT = 420  # seven minutes into each period
GEN = C.GEN

STREAMS = [
    {
        "key": "llvm",
        "builder": "builder1",
        "title": "LLVM mainline",
        "mission": "Keep the LLVM compiler infrastructure moving: code generation, MLIR, language front ends, tests and fixes landing in llvm/llvm-project.",
        "sources": ["github.com/llvm/llvm-project"],
        "repo": "llvm/llvm-project",
        "tranche": 25,
        "plan": "live",
        "funding": [("patron1", 300), ("patron2", 200)],
    },
    {
        "key": "vscode",
        "builder": "builder2",
        "title": "VS Code mainline",
        "mission": "Build Visual Studio Code: editor features, agent and chat tooling, fixes and engineering work landing in microsoft/vscode.",
        "sources": ["github.com/microsoft/vscode"],
        "repo": "microsoft/vscode",
        "tranche": 20,
        "plan": "live",
        "funding": [("patron1", 150)],
    },
    {
        "key": "moment",
        "builder": "builder2",
        "title": "Moment.js refactor",
        "mission": "Maintain and extend Moment.js, the JavaScript date library: bug fixes, locale updates, refactors and tagged releases.",
        "sources": ["github.com/moment/moment"],
        "repo": "moment/moment",
        "tranche": 30,
        # Deliberately unbacked: the repository has had no commits since 2024,
        # so this is the demo of a report the evidence does not show, followed
        # by a period with no report at all. Two strikes in a row: paused.
        "plan": "quiet_then_lapse",
        "claim": "Finished the parser refactor this period and moved locale loading to lazy modules.",
        "funding": [("patron2", 250)],
    },
    {
        "key": "podcast",
        "builder": "builder3",
        "title": "Indie dev interviews",
        "mission": "Produce a weekly podcast of long-form interviews with independent game developers: recording, editing and publishing episodes with show notes.",
        "sources": ["github.com/WebKit/WebKit"],
        "repo": "WebKit/WebKit",
        "tranche": 15,
        # Deliberately off mission: the builder links browser-engine commits
        # against a podcast mission.
        "plan": "live",
        "funding": [("patron1", 100)],
    },
    {
        "key": "notes",
        "builder": "builder3",
        "title": "Fee market notes",
        "mission": "Research and write notes on validator fee markets and appeal economics for GenLayer, kept as working documents.",
        "sources": ["docs.google.com/document/d/1KeepaliveDemoPrivateNotes"],
        "repo": "",
        "tranche": 10,
        # A private working document: validators hit a login wall or an error,
        # which is the demo of UNREADABLE, a recheck, and no strike.
        "plan": "unreadable",
        "link": "https://docs.google.com/document/d/1KeepaliveDemoPrivateNotes/edit",
        "funding": [("patron2", 50)],
    },
    {
        "key": "nixpkgs",
        "builder": "builder1",
        "title": "nixpkgs upkeep",
        "mission": "Keep nixpkgs packages current and building: package updates, build fixes and NixOS module work landing in NixOS/nixpkgs.",
        "sources": ["github.com/NixOS/nixpkgs"],
        "repo": "NixOS/nixpkgs",
        "tranche": 20,
        "plan": "live_then_close",
        "funding": [("patron1", 120), ("patron2", 60)],
    },
]


def iso(seconds: int) -> str:
    return datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def commits(repo: str, since: int, until: int) -> list[dict]:
    """Commits that landed in the window so far, from the public API, newest first."""
    url = f"https://api.github.com/repos/{repo}/commits?since={iso(since)}&until={iso(until)}&per_page=30"
    request = urllib.request.Request(url, headers={"User-Agent": "keepalive-seed", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            rows = json.loads(response.read())
    except Exception as error:  # noqa: BLE001
        print(f"  GitHub API for {repo}: {str(error)[:100]}")
        return []
    return rows if isinstance(rows, list) else []


def report_for(stream: dict, start: int, now: int) -> tuple[str, list[str]]:
    """An honest report of what landed so far this period, built from the commits themselves."""
    if stream["plan"] == "unreadable":
        return "Wrote up the fee-market and appeal-bond notes in our working document this period.", [stream["link"]]
    if stream["plan"] == "quiet_then_lapse":
        return stream["claim"], []
    rows = commits(stream["repo"], start, now)
    if not rows:
        return f"No commits have landed on {stream['repo']} yet this period.", []
    titles = [str(row["commit"]["message"]).split("\n")[0].strip() for row in rows]
    lead = "Worked on these this period" if stream["key"] == "podcast" else f"{len(rows)} commit{'s' if len(rows) != 1 else ''} landed on {stream['repo']} so far this period, including"
    summary = f"{lead}: " + "; ".join(titles[:3]) + "."
    links = [f"https://github.com/{stream['repo']}/commit/{row['sha']}" for row in rows[:3]]
    return summary[:800], links


def main() -> int:
    periods = int(sys.argv[sys.argv.index("--periods") + 1]) if "--periods" in sys.argv else 4
    names = ["builder1", "builder2", "builder3", "patron1", "patron2", "keeper"]
    accounts = C.accounts(*names)
    address = C.deployment()["keepalive"]
    record = json.loads(RECORD.read_text(encoding="utf-8")) if RECORD.exists() else {"contract": address, "actions": []}
    if record.get("contract") != address:
        record = {"contract": address, "actions": []}
    chains = {name: C.Chain(account) for name, account in accounts.items()}

    def log(stream_key: str, method: str, outcome: dict, **extra) -> None:
        record["actions"].append(
            {"stream": stream_key, "method": method, "tx": outcome.get("hash"), "ok": outcome.get("ok"), "detail": outcome.get("detail", ""), **extra}
        )
        RECORD.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(f"contract {address}")
    for name in names:
        chains[name].ensure(accounts[name].address, minimum_gen=100 if name.startswith("patron") else 20, top_up_gen=1000)

    # Open every stream that has not been opened by an earlier run.
    opened = record.setdefault("streams", {})
    for stream in STREAMS:
        if stream["key"] in opened:
            continue
        chain = chains[stream["builder"]]
        outcome = chain.send(address, "open_stream", [stream["title"], stream["mission"], stream["sources"], 0, stream["tranche"] * GEN, True])
        sid = outcome.get("result")
        if outcome["ok"] and not isinstance(sid, int):
            # The receipt did not carry the return value: the newest stream this
            # builder opened with this title is the one.
            page = chain.read_json(address, "list_streams", ["", 0, 50])
            mine = [r for r in page["rows"] if r["owner"].lower() == accounts[stream["builder"]].address.lower() and r["title"] == stream["title"]]
            sid = mine[0]["sid"] if mine else None
        log(stream["key"], "open_stream", outcome, sid=sid)
        if not outcome["ok"] or not isinstance(sid, int):
            print(f"  {stream['title']}: open failed: {outcome['detail']}")
            continue
        row = chain.read_json(address, "get_stream", [sid])
        opened[stream["key"]] = {"sid": sid, "start": row["start"]}
        RECORD.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"  opened {stream['title']} as stream {sid}")
        for patron, amount in stream["funding"]:
            funded = chains[patron].send(address, "fund", [sid], value=amount * GEN)
            log(stream["key"], "fund", funded, sid=sid, patron=patron, gen=amount)
            print(f"    {patron} funded {amount} GEN: {'ok' if funded['ok'] else funded['detail']}")

    by_key = {s["key"]: s for s in STREAMS}
    reported: set = {(a["stream"], a.get("k")) for a in record["actions"] if a["method"] == "report" and a.get("ok")}
    finished: set = set()
    due: dict = {}
    deadline = max(v["start"] for v in opened.values()) + periods * PERIOD + 300

    while time.time() < deadline + 900:
        now = int(time.time())
        # 1. Reports first: they have a window, checks can wait.
        for key, info in opened.items():
            stream = by_key[key]
            sid, start = info["sid"], info["start"]
            k = (now - start) // PERIOD
            if k >= periods or (key, k) in reported or key in finished:
                continue
            if now < start + k * PERIOD + REPORT_AT:
                continue
            if stream["plan"] == "quiet_then_lapse" and k >= 1:
                continue  # the lapse: no report, on purpose
            if stream["plan"] in ("unreadable", "live_then_close") and k >= 1:
                continue
            summary, links = report_for(stream, start + k * PERIOD, now)
            if not links and not stream["repo"]:
                continue
            outcome = chains[stream["builder"]].send(address, "report", [sid, k, summary, links])
            log(key, "report", outcome, sid=sid, k=k, summary=summary, links=links)
            reported.add((key, k))
            print(f"  {stream['title']} period {k + 1} reported: {'ok' if outcome['ok'] else outcome['detail']}")

        # 2. One stream's due checks and lapses, then back to reports. A stream
        # is only asked when something on it can be due, because Studio Next
        # allows about thirty requests a minute.
        changed: list[str] = []
        for key, info in opened.items():
            if key in finished or now < due.get(key, info["start"] + PERIOD):
                continue
            results = K.settle(chains["keeper"], address, info["sid"])
            for result in results:
                log(key, result["method"], {"hash": result["tx"], "ok": result["ok"]}, sid=info["sid"], k=result["k"], verdict=result["verdict"])
            if results:
                due[key] = info["start"] + (max(r["k"] for r in results) + 2) * PERIOD
                changed.append(key)
                break
            due[key] = now + 60

        # 3. The endings, for the stream that just changed: claim after an
        # alive release, close, and a patron leaving a paused stream.
        for key in changed:
            info = opened[key]
            stream = by_key[key]
            sid = info["sid"]
            row = chains["keeper"].read_json(address, "get_stream", [sid])
            if int(row["claimable"]) > 0 and key not in finished:
                claimed = chains[stream["builder"]].send(address, "claim", [sid])
                log(key, "claim", claimed, sid=sid, gen=int(row["claimable"]) / GEN)
                print(f"  {stream['title']}: builder claimed {int(row['claimable']) / GEN} GEN: {'ok' if claimed['ok'] else claimed['detail']}")
            if stream["plan"] == "live_then_close" and row["next_k"] >= 1 and row["status"] != "CLOSED":
                closed = chains[stream["builder"]].send(address, "close", [sid])
                log(key, "close", closed, sid=sid)
                print(f"  {stream['title']}: closed: {'ok' if closed['ok'] else closed['detail']}")
                for patron, _ in stream["funding"]:
                    position = chains["keeper"].read_json(address, "get_position", [sid, accounts[patron].address])
                    if int(position["shares"]) > 0:
                        left = chains[patron].send(address, "exit", [sid, int(position["shares"])])
                        log(key, "exit", left, sid=sid, patron=patron, gen=int(position["value"]) / GEN)
                        print(f"    {patron} exited with {int(position['value']) / GEN} GEN: {'ok' if left['ok'] else left['detail']}")
                finished.add(key)
            if stream["plan"] == "unreadable" and row["next_k"] >= 1:
                finished.add(key)
            if stream["plan"] == "quiet_then_lapse" and row["status"] == "PAUSED" and key not in finished:
                patron = stream["funding"][0][0]
                position = chains["keeper"].read_json(address, "get_position", [sid, accounts[patron].address])
                if int(position["shares"]) > 0:
                    left = chains[patron].send(address, "exit", [sid, int(position["shares"]) // 2])
                    log(key, "exit", left, sid=sid, patron=patron, note="half the position, leaving the rest to show a paused holding")
                    print(f"    {patron} took half out of the paused stream: {'ok' if left['ok'] else left['detail']}")
                finished.add(key)
        if now > deadline and all(k in finished or due.get(k, 0) > deadline + 900 for k in opened):
            break
        time.sleep(20)
    print("seed finished; docs/seed.<network>.json holds every transaction")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
