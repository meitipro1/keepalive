#!/usr/bin/env python3
"""
Break every defence in the contract, one at a time, and name the test that notices.

    python scripts/mutate.py                          # run, print the table
    python scripts/mutate.py --table docs/MUTATIONS.md

A passing count is a claim; a table of mutations, each named with the test that
killed it, is evidence. Each mutant is a copy of contracts/keepalive.py with one
defence removed or weakened. The direct and static tests run against it through
KEEPALIVE_CONTRACT, and the first failing test is recorded as the kill.

A kill is read from pytest's own report of which test failed, never from an
exit code alone: a runner that scores exit codes reports a perfect run while
testing nothing. The generator and port parity tests are left out, because they
fail for ANY edit and would kill every mutant without testing its defence.

If anything escapes, the table is not written and the escapes are printed. An
escape means a missing test, or a defence strict enough elsewhere that this one
can no longer fail, and either is a finding.
"""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "keepalive.py"

#: (what the mutant does, text in the contract, what replaces it). Each text
#: must occur exactly once, so a mutant always changes exactly one place.
MUTANTS = [
    ("report: any account may report", 'raise gl.vm.UserError(E + "only the builder may report")', "pass"),
    ("claim: any account may claim", 'raise gl.vm.UserError(E + "only the builder may claim")', "pass"),
    ("close: any account may close", 'raise gl.vm.UserError(E + "only the builder may close")', "pass"),
    ("fund: a paused stream takes deposits", 'raise gl.vm.UserError(E + "stream is paused, deposits resume after an alive check")', "pass"),
    ("fund: a closed stream takes deposits", '''        if s.status == CLOSED:
            raise gl.vm.UserError(E + "stream is closed")
        if value <= 0:''', '''        if value <= 0:'''),
    ("fund: zero value accepted", 'raise gl.vm.UserError(E + "send some GEN to fund")', "pass"),
    ("fund: shares minted against the wrong ratio", "minted = value if total == 0 else value * total // pool", "minted = value if total == 0 else value * pool // total"),
    ("exit: more shares than held may be burnt", "if burn <= 0 or burn > held:", "if burn <= 0:"),
    ("exit: pays one wei too much", "out = burn * pool // total", "out = burn * pool // total + 1"),
    ("exit: patron count never falls", '''        if held - burn == 0:
            s.patrons = u32(int(s.patrons) - 1)''', '''        if False:
            s.patrons = u32(int(s.patrons) - 1)'''),
    ("claim: claimable is not cleared", '''        s.claimable = u256(0)
        s.claimed''', '''        s.claimed'''),
    ("check: the full tranche is released even from a short pool", "released = min(int(s.tranche), pool)", "released = int(s.tranche)"),
    ("check: a paused stream is paid by the alive that lifts it", '''            if s.status == PAUSED:
                # The price''', '''            if False:
                # The price'''),
    ("check: two strikes do not pause", "if int(s.strikes) >= 2 and s.status == ACTIVE:", "if int(s.strikes) >= 3 and s.status == ACTIVE:"),
    ("check: an alive does not reset strikes", '''            s.strikes = u32(0)
            s.alive''', '''            s.alive'''),
    ("check: a first unreadable is final", "if verdict == UNREADABLE and p.status == REPORTED:", "if False:"),
    ("check: a recheck runs before the builder swaps links", "if p.status == RECHECK and not p.amended and now < grace_end:", "if False:"),
    ("check: runs before the period ends", '''        if now < end:
            raise gl.vm.UserError(E + "period has not ended")''', '''        if now < start:
            raise gl.vm.UserError(E + "period has not ended")'''),
    ("check: periods out of order", '''        if int(k) != int(s.next_k):
            raise gl.vm.UserError(E + "periods are checked in order''', '''        if False:
            raise gl.vm.UserError(E + "periods are checked in order'''),
    ("check: the pool emptying keeps the old share epoch", "if int(s.pool) == 0 and int(s.shares) > 0:", "if False:"),
    ("lapse: records before grace ends", '''        if now < grace_end:
            raise gl.vm.UserError(E + "grace is still open")''', '''        if now < end:
            raise gl.vm.UserError(E + "grace is still open")'''),
    ("lapse: lapses a period that has a report", 'raise gl.vm.UserError(E + "a report exists, run check")', "pass"),
    ("report: accepted after grace", 'raise gl.vm.UserError(E + "report window closed")', "pass"),
    ("report: a link outside the declared sources is accepted", "            if not matched:", "            if False:"),
    ("sources: the prefix check has no boundary", 'return link_bare[len(prefix)] in "/?#"', "return True"),
    ("sources: a bare shared host is accepted", 'if host in SHARED_HOSTS and rest == "":', "if False:"),
    ("links: any character is accepted", "        if char not in URL_CHARS:", "        if False:"),
    ("open: a DEMO stream may run day-long periods", "if int(period_days) != 0:", "if False:"),
    ("open: any period length is accepted", "if int(period_days) not in PERIOD_DAYS:", "if False:"),
    ("judge: the fence lets delimiters through", 'return str(raw).replace("<", "(").replace(">", ")")', "return str(raw)"),
    ("judge: validators agree with any label", 'return mine["verdict"] == theirs["verdict"]', "return True"),
    ("judge: a label outside the closed set is compared", 'if not isinstance(theirs, dict) or theirs.get("verdict") not in VERDICTS:', "if not isinstance(theirs, dict):"),
    ("judge: an unparseable answer defaults to QUIET", '''    if verdict not in VERDICTS:
        raise gl.vm.UserError(L + "bad verdict")''', '''    if verdict not in VERDICTS:
        verdict = QUIET'''),
    ("judge: pages are not cut to 5,000 characters", "    return text[:PAGE_CHARS]\n", "    return text\n"),
    ("judge: commits show the author date", 'committed = str(committer.get("date", "")) or authored', "committed = authored"),
    ("judge: the autolink window starts a day early", '"/commits?since=" + _iso(start)', '"/commits?since=" + _iso(start - 86400)'),
]

EXCLUDED = [
    "tests/test_static.py::test_the_probe_contracts_are_what_the_generator_writes",
    "tests/test_static.py::test_the_studio_next_port_is_what_the_port_writes",
    "tests/test_static.py::test_the_probe_judges_with_the_contract_s_own_code",
    "tests/test_static.py::test_no_private_key_in_the_repository",
]


def first_failure(output: str) -> str | None:
    for line in output.splitlines():
        match = re.match(r"FAILED (\S+)", line.strip())
        if match:
            return match.group(1).split(" - ")[0]
    return None


def main() -> int:
    source = CONTRACT.read_text(encoding="utf-8")
    rows: list[tuple[int, str, str]] = []
    escapes: list[str] = []
    with tempfile.TemporaryDirectory() as folder:
        mutant = pathlib.Path(folder) / "keepalive.py"
        for index, (what, old, new) in enumerate(MUTANTS, 1):
            count = source.count(old)
            if count != 1:
                raise SystemExit(f"mutant {index} ({what}) matches {count} places; it must match exactly one")
            mutant.write_text(source.replace(old, new), encoding="utf-8")
            env = dict(os.environ, KEEPALIVE_CONTRACT=str(mutant))
            command = [
                sys.executable, "-m", "pytest", "tests/test_direct.py", "tests/test_static.py",
                "-k", "not studio-next", "-x", "-q", "--tb=no", "-rf", "-p", "no:cacheprovider",
            ] + [arg for test in EXCLUDED for arg in ("--deselect", test)]
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
            killer = first_failure(result.stdout)
            if result.returncode == 0 or killer is None:
                escapes.append(what)
                print(f"  {index:2} ESCAPED  {what}")
            else:
                rows.append((index, what, killer))
                print(f"  {index:2} killed   {what}  <- {killer}")
    if escapes:
        print(f"\n{len(escapes)} mutant(s) escaped; no table written:")
        for what in escapes:
            print(f"  - {what}")
        return 1
    if "--table" in sys.argv:
        target = ROOT / sys.argv[sys.argv.index("--table") + 1]
        lines = [
            "# Mutations",
            "",
            f"Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. {len(rows)} defences in",
            "`contracts/keepalive.py` were each broken on their own, and every mutant was caught. Each row",
            "names the first test that failed against it, read from pytest's report rather than an exit code.",
            "The generator and port parity tests are excluded, because they fail for any edit at all.",
            "",
            "| # | defence broken | caught by |",
            "|---|---|---|",
        ] + [f"| {i} | {what} | `{killer}` |" for i, what, killer in rows]
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\nwrote {target.relative_to(ROOT).as_posix()}")
    print(f"\n{len(rows)} of {len(MUTANTS)} killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
