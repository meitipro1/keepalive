#!/usr/bin/env python3
"""
The keeper: calls check and lapse whenever they become callable.

    python scripts/keeper.py            # one pass over every stream
    python scripts/keeper.py --watch    # keep passing, once a minute

Anyone may call check and lapse, which is what lets a stream run while its
builder and patrons are asleep. The keeper decides nothing: check asks the
validators, and lapse needs grace to be over with no report on file. It reads
current_period for each open stream and acts on what that view says is due,
one transaction at a time, because Studio Next allows about thirty requests a
minute from one address and a check already polls for a minute or two.

It never calls the GitHub API or any page itself; only validators fetch.
"""

from __future__ import annotations

import sys
import time

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def open_streams(reader: C.Chain, address: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        page = reader.read_json(address, "list_streams", ["", offset, 50])
        rows.extend(row for row in page["rows"] if row["status"] != "CLOSED")
        offset += 50
        if offset >= page["total"]:
            return rows


def settle(chain: C.Chain, address: str, sid: int, log=print) -> list[dict]:
    """Resolve every period of one stream that is due, in order. Returns the outcomes."""
    done: list[dict] = []
    for _ in range(12):
        current = chain.read_json(address, "current_period", [sid])
        pending = current["pending"]
        if pending["checkable"]:
            method = "check"
        elif pending["lapsable"]:
            method = "lapse"
        else:
            return done
        outcome = chain.send(address, method, [sid, pending["k"]])
        period = chain.read_json(address, "get_period", [sid, pending["k"]])
        verdict = period.get("verdict") or period.get("status")
        if outcome["ok"]:
            log(f"  stream {sid} period {pending['k'] + 1}: {method} -> {verdict}: {period.get('reason', '')}")
        else:
            log(f"  stream {sid} period {pending['k'] + 1}: {method} not decided: {outcome['detail']}")
        done.append({"sid": sid, "k": pending["k"], "method": method, "tx": outcome["hash"], "ok": outcome["ok"], "verdict": verdict})
        if not outcome["ok"]:
            # A failed round (validators could not agree, or timed out) is left
            # for the next pass rather than retried in a tight loop.
            return done
    return done


def one_pass(chain: C.Chain, address: str) -> list[dict]:
    results: list[dict] = []
    for row in open_streams(chain, address):
        results.extend(settle(chain, address, row["sid"]))
    return results


def main() -> int:
    keeper = C.accounts("keeper")["keeper"]
    chain = C.Chain(keeper)
    chain.ensure(keeper.address, minimum_gen=20, top_up_gen=200)
    address = C.deployment()["keepalive"]
    print(f"keeper {keeper.address} on {address}")
    if "--watch" not in sys.argv:
        one_pass(chain, address)
        return 0
    while True:
        try:
            one_pass(chain, address)
        except Exception as error:  # noqa: BLE001  a keeper that dies on one bad read is no keeper
            print(f"  pass failed, trying again next minute: {str(error)[:160]}")
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
