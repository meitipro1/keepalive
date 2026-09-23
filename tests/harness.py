"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/keepalive.py
is a change to what these tests exercise. The runner comment on the first lines
of the contract is ignored by CPython, so the file imports as ordinary Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import os
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
#: KEEPALIVE_CONTRACT points the suite at a mutant; scripts/mutate.py sets it.
CONTRACT = pathlib.Path(os.environ.get("KEEPALIVE_CONTRACT") or ROOT / "contracts" / "keepalive.py")
PROBE = ROOT / "eval" / "probe_contract.py"

#: The two runtimes the contract ships for. "studionet" is contracts/, the
#: primary deployment, on py-genlayer:1jb45aa8. "studio-next" is the port in
#: contracts/studio-next/, on py-genlayer:5jycge4q, written by scripts/port.py.
#: conftest.py runs every contract test once per runtime by setting PAIR.
PAIRS = {"studionet": CONTRACT, "studio-next": ROOT / "contracts" / "studio-next" / "keepalive.py"}
PAIR = "studionet"

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
DAY = 86400

#: 2026-09-01T00:00:00Z. Every world starts here.
T0 = 1788220800


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` package shaped like the runtime under test, so an
    import the port left out fails here rather than on chain.

    py-genlayer:1jb45aa8 (Studionet): the star import brings gl, the storage
    names and the types. py-genlayer:5jycge4q (Studio Next): the star import
    brings Address and the integer types, `import genlayer as gl` is the package
    itself, and the storage names live in genlayer.storage.
    """
    sys.modules.pop("genlayer.storage", None)
    if PAIR == "studionet":
        module = types.ModuleType("genlayer")
        module.gl = gl
        module.Address = D.Address
        module.TreeMap = D.TreeMap
        module.DynArray = D.DynArray
        module.allow_storage = D.allow_storage
        for name in ("u8", "u16", "u32", "u64", "u256"):
            setattr(module, name, getattr(D, name))
        module.__all__ = ["gl", "Address", "TreeMap", "DynArray", "allow_storage", "u8", "u16", "u32", "u64", "u256"]
        sys.modules["genlayer"] = module
        return
    storage = types.ModuleType("genlayer.storage")
    storage.TreeMap = D.TreeMap
    storage.DynArray = D.DynArray
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    for name in ("contract", "vm", "message", "public", "nondet", "evm"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = ["Address", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL, path: pathlib.Path | None = None, name: str = "keepalive_contract") -> types.ModuleType:
    """Import the runtime under test's contract fresh against this gl."""
    path = path or PAIRS[PAIR]
    _install(gl)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def answer(verdict: str, reason: str = "") -> str:
    """A model answer, as the model would type it."""
    return json.dumps({"verdict": verdict, "reason": reason or f"The evidence reads as {verdict.lower()}."})


class World:
    """
    One Keepalive contract and the accounts around it.

    Time is explicit: `at(seconds)` sets the transaction datetime the contract
    reads, because nothing on chain moves the clock on its own and periods are
    the thing these tests most need to control.
    """

    BUILDER = "0x" + "b1" * 20
    ALICE = "0x" + "a1" * 20
    BOB = "0x" + "a2" * 20
    CAROL = "0x" + "a3" * 20
    STRANGER = "0x" + "d4" * 20
    KEEPER = "0x" + "e5" * 20
    CONTRACT = "0x" + "cc" * 20

    TITLE = "Corvid Circuits"
    MISSION = (
        "Maintain and extend Corvid, an MIT-licensed zk circuit library: new gadgets, "
        "audit fixes, docs and tagged releases."
    )
    SOURCES = ["github.com/corvid-zk/", "corvid.dev/changelog"]
    REPORT = (
        "Shipped v0.9 with the rewritten prover, merged 14 PRs including the batched range "
        "check, and closed the two audit findings from July."
    )
    LINKS = ["https://github.com/corvid-zk/corvid/releases/tag/v0.9", "https://corvid.dev/changelog#v0-9"]

    def __init__(self) -> None:
        self.gl = D.GL()
        self.mod = load(self.gl)
        self.at(T0)
        self.sender(self.BUILDER)
        self.c = self.mod.Keepalive()

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = int(seconds)
        stamp = datetime.datetime.fromtimestamp(self.t, datetime.timezone.utc)
        self.gl.message.raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = int(value)
        return self

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    @property
    def validators(self) -> list[D.NodeWorld]:
        return self.gl.nondet.validators

    def nodes(self) -> list[D.NodeWorld]:
        return [self.leader, *self.validators]

    # -- shorthands --------------------------------------------------------

    def open(
        self,
        title: str | None = None,
        mission: str | None = None,
        sources: list[str] | None = None,
        period_days: int = 14,
        tranche: int = 150 * GEN,
        demo: bool = False,
        who: str | None = None,
    ) -> int:
        self.sender(who or self.BUILDER)
        return int(
            self.c.open_stream(
                title if title is not None else self.TITLE,
                mission if mission is not None else self.MISSION,
                list(sources) if sources is not None else list(self.SOURCES),
                period_days,
                tranche,
                demo,
            )
        )

    def fund(self, who: str, amount: int, sid: int = 1) -> int:
        self.sender(who, amount)
        try:
            return int(self.c.fund(sid))
        finally:
            self.sender(who)

    def exit(self, who: str, shares: int, sid: int = 1) -> int:
        self.sender(who)
        return int(self.c.exit(sid, shares))

    def report(self, k: int, summary: str | None = None, links: list[str] | None = None, sid: int = 1, who: str | None = None) -> None:
        self.sender(who or self.BUILDER)
        self.c.report(sid, k, summary if summary is not None else self.REPORT, list(links) if links is not None else list(self.LINKS))

    def queue(self, verdict: str, validator_verdict: str | None = None, reason: str = "") -> None:
        """One model answer for the leader and one for each validator."""
        self.leader.answers.append(answer(verdict, reason))
        for world in self.validators:
            world.answers.append(answer(validator_verdict or verdict, reason))

    def check(self, k: int, verdict: str = "ALIVE", validator_verdict: str | None = None, sid: int = 1, who: str | None = None, reason: str = "") -> None:
        self.queue(verdict, validator_verdict, reason)
        self.sender(who or self.KEEPER)
        self.c.check(sid, k)

    def lapse(self, k: int, sid: int = 1, who: str | None = None) -> None:
        self.sender(who or self.KEEPER)
        self.c.lapse(sid, k)

    def claim(self, sid: int = 1, who: str | None = None) -> int:
        self.sender(who or self.BUILDER)
        return int(self.c.claim(sid))

    def close(self, sid: int = 1, who: str | None = None) -> None:
        self.sender(who or self.BUILDER)
        self.c.close(sid)

    def start_of(self, k: int, sid: int = 1) -> int:
        s = self.c.streams[str(sid)]
        return int(s.start) + k * int(s.period_s)

    def end_of(self, k: int, sid: int = 1) -> int:
        return self.start_of(k + 1, sid)

    def grace_end_of(self, k: int, sid: int = 1) -> int:
        s = self.c.streams[str(sid)]
        return self.end_of(k, sid) + int(s.grace_s)

    def alive_period(self, k: int, sid: int = 1) -> None:
        """Report period k inside it, then check it ALIVE after it ends."""
        self.at(self.start_of(k, sid) + 60)
        self.report(k, sid=sid)
        self.at(self.end_of(k, sid) + 60)
        self.check(k, "ALIVE", sid=sid)

    # -- reads -------------------------------------------------------------

    def stream(self, sid: int = 1) -> dict:
        return json.loads(self.c.get_stream(sid))

    def period(self, k: int, sid: int = 1) -> dict:
        return json.loads(self.c.get_period(sid, k))

    def position(self, who: str, sid: int = 1) -> dict:
        return json.loads(self.c.get_position(sid, who))

    def current(self, sid: int = 1) -> dict:
        return json.loads(self.c.current_period(sid))

    def listing(self, status: str = "", offset: int = 0, limit: int = 50) -> dict:
        return json.loads(self.c.list_streams(status, offset, limit))

    def paid_to(self, address: str) -> int:
        return sum(t.value for t in self.gl.bus.transfers if t.to.lower() == address.lower())

    def paid_out(self) -> int:
        return sum(t.value for t in self.gl.bus.transfers)


def refused(prefix: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused, and that the refusal is the sentence it should be."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert prefix in message, f"expected {prefix!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {prefix!r}, nothing was raised")
