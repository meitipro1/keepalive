"""
Property tests for the pool: random deposits, releases, quiet periods, exits
and claims, thrown at the real contract, thousands of sequences, seeded so a
failure reproduces.

After every operation:
  - nothing is created: everything deposited is in the pool, claimable, claimed
    or returned to a patron, to the wei
  - nothing goes negative (the u256 double refuses a negative value)
  - the pool always covers every patron's value at once
  - shares on record add up to the stream's shares
  - each exit pays floor(shares * pool / total), computed before the exit
  - each patron's value tracks an exact-fraction reference within rounding:
    one wei per operation at most, because the share price never exceeds one

No hypothesis dependency: the generator is random.Random with a fixed seed per
sequence, which is all a property test needs to be reproducible.
"""

from __future__ import annotations

import random
from fractions import Fraction

import pytest

import genvm_double as D
from harness import GEN, World

SEQUENCES = 2000
STEPS = 24
PATRONS = (World.ALICE, World.BOB, World.CAROL, "0x" + "a4" * 20, "0x" + "a5" * 20)


def amount(rng: random.Random) -> int:
    """Mostly GEN-sized, sometimes a handful of wei, so rounding is exercised."""
    roll = rng.random()
    if roll < 0.15:
        return rng.randint(1, 1000)
    if roll < 0.3:
        return rng.randint(1, 10**12)
    return rng.randint(1, 5000) * GEN // rng.choice((1, 3, 7, 10))


def shares_of(w: World, who: str) -> int:
    s = w.c.streams["1"]
    key = "1:" + who.lower()
    if key not in w.c.positions:
        return 0
    position = w.c.positions[key]
    return int(position.shares) if int(position.epoch) == int(s.epoch) else 0


def value_of(w: World, who: str) -> int:
    s = w.c.streams["1"]
    total = int(s.shares)
    return 0 if total == 0 else shares_of(w, who) * int(s.pool) // total


class Reference:
    """Each patron's exact claim on the pool, as a Fraction."""

    def __init__(self) -> None:
        self.claim: dict[str, Fraction] = {}

    def deposit(self, who: str, value: int) -> None:
        self.claim[who] = self.claim.get(who, Fraction(0)) + value

    def release(self, released: int) -> None:
        total = sum(self.claim.values(), Fraction(0))
        if total <= 0:
            return
        keep = max(Fraction(0), (total - released) / total)
        for who in self.claim:
            self.claim[who] *= keep

    def exit(self, who: str, out: int) -> None:
        self.claim[who] = self.claim.get(who, Fraction(0)) - out

    def wipe(self) -> None:
        for who in self.claim:
            self.claim[who] = Fraction(0)


def invariants(w: World, ref: Reference, ops: int) -> None:
    s = w.c.streams["1"]
    pool, total = int(s.pool), int(s.shares)
    deposited, claimable, claimed, returned = (int(s.deposited), int(s.claimable), int(s.claimed), int(s.returned))

    assert deposited == pool + claimable + claimed + returned, "value was created or lost"
    assert w.paid_to(World.BUILDER) == claimed
    assert sum(w.paid_to(p) for p in PATRONS) == returned
    assert sum(shares_of(w, p) for p in PATRONS) == total, "shares on record do not add up"
    assert sum(value_of(w, p) for p in PATRONS) <= pool, "the pool cannot cover every patron at once"
    if total == 0:
        assert int(s.patrons) == 0
    assert int(s.patrons) == sum(1 for p in PATRONS if shares_of(w, p) > 0)
    for p in PATRONS:
        exact = ref.claim.get(p, Fraction(0))
        assert abs(value_of(w, p) - exact) <= ops + 1, f"{p[:6]} drifted {float(value_of(w, p) - exact)} wei from exact"


def run_sequence(seed: int) -> None:
    rng = random.Random(seed)
    w = World()
    w.open(period_days=7, tranche=rng.choice((1, 999, 150 * GEN, 10**21, rng.randint(1, 10**22))))
    ref = Reference()
    k = 0
    ops = 0
    for _ in range(STEPS):
        ops += 1
        roll = rng.random()
        s = w.c.streams["1"]
        if roll < 0.4:
            who = rng.choice(PATRONS)
            value = amount(rng)
            if s.status == "PAUSED":
                before = (int(s.pool), int(s.shares))
                with pytest.raises(D.UserError, match="paused"):
                    w.fund(who, value)
                assert (int(s.pool), int(s.shares)) == before
                continue
            try:
                w.fund(who, value)
            except D.UserError as error:
                assert "too small" in str(error)
                continue
            ref.deposit(who, value)
        elif roll < 0.62:
            w.alive_period(k)
            k += 1
            released = int(w.c.periods["1:" + str(k - 1)].released)
            if int(s.shares) == 0 and int(s.pool) == 0:
                ref.wipe()
            else:
                ref.release(released)
        elif roll < 0.7:
            w.at(w.start_of(k) + 5)
            w.report(k)
            w.at(w.end_of(k) + 5)
            w.check(k, rng.choice(("QUIET", "OFF_MISSION")))
            k += 1
        elif roll < 0.95:
            who = rng.choice(PATRONS)
            held = shares_of(w, who)
            if held == 0:
                continue
            burn = held if rng.random() < 0.3 else rng.randint(1, held)
            expected = burn * int(s.pool) // int(s.shares)
            out = w.exit(who, burn)
            assert out == expected
            ref.exit(who, out)
        else:
            if int(s.claimable) > 0:
                w.claim()
        invariants(w, ref, ops)

    # Everyone leaves: the pool empties to the wei.
    for who in PATRONS:
        held = shares_of(w, who)
        if held:
            ref.exit(who, w.exit(who, held))
    s = w.c.streams["1"]
    assert int(s.shares) == 0
    assert int(s.pool) == 0, "the last holder out must take the whole remainder"
    invariants(w, ref, ops + len(PATRONS))


@pytest.mark.parametrize("batch", range(20))
def test_random_sequences_never_create_value_or_go_negative(batch):
    per = SEQUENCES // 20
    for seed in range(batch * per, (batch + 1) * per):
        run_sequence(seed)


def test_a_release_lowers_value_without_touching_shares():
    w = World()
    w.open(tranche=150 * GEN)
    w.fund(World.ALICE, 1000 * GEN)
    before = shares_of(w, World.ALICE)
    w.alive_period(0)
    assert shares_of(w, World.ALICE) == before
    assert value_of(w, World.ALICE) == 850 * GEN


def test_joining_after_a_release_carries_none_of_it():
    w = World()
    w.open(tranche=150 * GEN)
    w.fund(World.ALICE, 1000 * GEN)
    w.alive_period(0)
    w.fund(World.CAROL, 850 * GEN)
    assert value_of(w, World.CAROL) == 850 * GEN
    w.alive_period(1)
    # Both carry half of the second release, none of the first for Carol.
    assert value_of(w, World.ALICE) == 775 * GEN
    assert value_of(w, World.CAROL) == 775 * GEN
