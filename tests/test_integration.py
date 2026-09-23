"""
The one test that talks to Studio Next. Skipped unless asked for:

    KEEPALIVE_INTEGRATION=1 pytest tests/test_integration.py -v -s

Gated behind an explicit variable rather than a probe of the network, because
Studio's transport failures are intermittent: a probe that is right most of the
time is worse than no gate, and nothing in a wall of connection errors tells a
reviewer's machine apart from a broken contract.

What it proves that the direct tests cannot: that the deployed bytes are the
repository's, that the deployed contract answers its views through the real
runtime, and that a refusal comes back as the contract's own sentence.
"""

from __future__ import annotations

import os
import pathlib
import sys

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("KEEPALIVE_INTEGRATION") != "1",
    reason="set KEEPALIVE_INTEGRATION=1 to run against Studio Next",
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def test_the_deployed_contract_answers_and_matches_the_repository():
    import chain as C
    import verify

    entry = C.deployment()
    chain = C.Chain()
    onchain = verify.deployed_source(chain, entry["keepalive"])
    assert verify.cosmetic(onchain) == verify.cosmetic((ROOT / "contracts" / "keepalive.py").read_text(encoding="utf-8"))
    page = chain.read_json(entry["keepalive"], "list_streams", ["", 0, 5])
    assert set(page) >= {"total", "count", "rows", "now"}


def test_a_refusal_comes_back_as_the_contract_s_sentence():
    import chain as C

    entry = C.deployment()
    stranger = C.accounts("integration_stranger")["integration_stranger"]
    chain = C.Chain(stranger)
    chain.ensure(stranger.address, minimum_gen=5, top_up_gen=50)
    outcome = chain.send(entry["keepalive"], "claim", [1])
    assert not outcome["ok"]
    assert "only the builder may claim" in outcome["refusal"] or "unknown stream" in outcome["refusal"]
