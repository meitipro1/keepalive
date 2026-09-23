#!/usr/bin/env python3
"""
Deploy to Studio Next and record what was deployed.

    python scripts/deploy.py                 # contracts/keepalive.py
    python scripts/deploy.py --probe         # eval/probe_contract.py as well
    python scripts/deploy.py --web-probe     # eval/web_probe.py as well
    python scripts/deploy.py --only-probes   # the two eval contracts, not keepalive

The network is KEEPALIVE_NETWORK: studionet (chain 61999, the default and the
site's network) or studio-next (chain 61997). This script never picks one on its
own, and each network deploys its own runtime's files (see scripts/port.py).

The deployer is the local "owner" account in ~/.keepalive/accounts.json,
funded from Studio's faucet when it runs low; Studio Next is gasless in the
sense that test GEN is free, and a deposit is still charged on every write.

contracts/FROZEN.json records, per contract: the address, the deploy
transaction, the sha256 of the exact bytes sent, and when. web/lib/deployment.json
is written from it for the site. scripts/verify.py later reads the source back
out of the chain and diffs it against the file, because the deployment is the
submission and the repository documents it, not the other way round.
"""

from __future__ import annotations

import datetime
import sys

import chain as C

TARGETS = C.FILES


def main() -> int:
    wanted = [] if "--only-probes" in sys.argv else ["keepalive"]
    if "--probe" in sys.argv or "--only-probes" in sys.argv:
        wanted.append("probe")
    if "--web-probe" in sys.argv or "--only-probes" in sys.argv:
        wanted.append("web_probe")

    owner = C.accounts("owner")["owner"]
    chain = C.Chain(owner)
    print(f"network  {C.NETWORK} (chain {C.CHAIN_ID}) via {C.RPC}")
    print(f"deployer {owner.address}")
    chain.ensure(owner.address, minimum_gen=50)

    record = C.frozen()
    entry = record.setdefault("deployments", {}).setdefault(C.NETWORK, {})
    entry.update({"chain_id": C.CHAIN_ID, "rpc": C.RPC, "explorer": C.EXPLORER, "runtime": C.RUNTIME})
    for name in wanted:
        path = TARGETS[name]
        digest = C.sha256_file(path)
        done = chain.deploy(path)
        entry[name] = done["address"]
        entry[name + "_tx"] = done["tx"]
        entry[name + "_sha256"] = digest
        entry[name + "_deployer"] = owner.address
        entry[name + "_file"] = path.relative_to(C.ROOT).as_posix()
        if name == "keepalive":
            entry["deployed_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        C.save_frozen(record)
        print(f"  recorded {name}: {done['address']}  {C.EXPLORER}/tx/{done['tx']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
