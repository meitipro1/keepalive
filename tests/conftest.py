"""
Every behavioural contract test runs once per runtime: contracts/keepalive.py on
Studionet's py-genlayer:1jb45aa8, and contracts/studio-next/keepalive.py on
Studio Next's py-genlayer:5jycge4q. A test id ends [studionet] or [studio-next],
so a defence that holds in one and not the other fails by name.

The pool property tests run on the primary only: the port changes three API
names and nothing the pool touches, which test_direct proves on both.
"""

from __future__ import annotations

import pytest

import harness

BOTH = ("test_direct",)


def pytest_generate_tests(metafunc):
    if metafunc.module.__name__.rpartition(".")[2] in BOTH:
        metafunc.parametrize("pair", sorted(harness.PAIRS), indirect=True)


@pytest.fixture(autouse=True)
def pair(request):
    chosen = getattr(request, "param", "studionet")
    previous = harness.PAIR
    harness.PAIR = chosen
    yield chosen
    harness.PAIR = previous
