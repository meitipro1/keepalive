"""
The site says "source match" before anything is signed, so its copy of the
rules must agree with the contract's. Every case below goes through the
contract's own functions and through web/lib/sources.ts, run by Node, and the
answers must be identical. Skipped only when Node is missing.
"""

from __future__ import annotations

import json
import shutil
import subprocess

import pytest

import genvm_double as D
from harness import ROOT, World

SOURCES = [
    "github.com/corvid-zk/",
    "HTTPS://www.GitHub.com/Corvid-ZK/",
    "corvid.dev/changelog",
    "http://corvid.dev",
    "github.com",
    "x.com",
    "medium.com/",
    "localhost/work",
    "corvid.dev:8080/x",
    "user@corvid.dev/x",
    ".dev/x",
    "corvid dev/x",
    "corvid.dev/<script>",
    "docs.google.com/document/d/1KeepaliveDemoPrivateNotes",
    "a" * 121 + ".dev",
]

PREFIXES = ["github.com/corvid-zk/", "corvid.dev/changelog", "corvid.dev"]
LINKS = [
    "https://corvid.dev/changelog-fake",
    "https://corvid.dev/changelog#v0-10",
    "https://corvid.dev.evil.com/changelog",
    "https://github.com/corvid-zkevil/corvid",
    "corvid.dev/changelog",
    "http://www.corvid.dev/changelog",
    "https://GitHub.com/Corvid-ZK/corvid/pull/412",
    "https://github.com/someone-else/repo",
    "https://corvid.dev/blog",
    "https://corvid.dev/changelog <x>",
    "https://corvid.dev/" + "a" * 300,
]

AUTOLINKS = [
    (["github.com/corvid-zk/"], ["https://github.com/corvid-zk/corvid/pull/412"]),
    (["corvid.dev/changelog", "github.com/Corvid-ZK/corvid.git"], []),
    (["github.com/corvid-zk/"], []),
    (["corvid.dev/changelog"], ["https://corvid.dev/changelog"]),
    (["github.com/llvm/llvm-project"], []),
]


def contract_answers(mod) -> list[dict]:
    out: list[dict] = []
    for raw in SOURCES:
        try:
            out.append({"ok": True, "value": mod._normalise_source(raw)})
        except D.UserError:
            out.append({"ok": False})
    for raw in LINKS:
        try:
            link = mod._clean_url(raw, mod.MAX_LINK)
            if not (link.lower().startswith("https://") or link.lower().startswith("http://")):
                link = "https://" + link
            if any(mod._matches(mod._bare(link), p) for p in PREFIXES):
                out.append({"ok": True, "value": link})
            else:
                out.append({"ok": False})
        except D.UserError:
            out.append({"ok": False})
    for sources, links in AUTOLINKS:
        found = mod.autolinks(sources, links, 1788220800, 1788220800 + 600)
        out.append({"ok": True, "value": found[0] if found else ""})
    return out


@pytest.mark.skipif(shutil.which("node") is None, reason="Node is not installed")
def test_the_site_applies_the_contract_s_rules():
    mod = World().mod
    cases = (
        [{"kind": "source", "raw": raw} for raw in SOURCES]
        + [{"kind": "link", "raw": raw, "prefixes": PREFIXES} for raw in LINKS]
        + [{"kind": "autolink", "sources": s, "links": l, "start": 1788220800, "end": 1788220800 + 600} for s, l in AUTOLINKS]
    )
    result = subprocess.run(
        ["node", str(ROOT / "web" / "scripts" / "sources-cli.ts")],
        input=json.dumps(cases),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert result.returncode == 0, result.stderr
    site = json.loads(result.stdout)
    expected = contract_answers(mod)
    for case, mine, theirs in zip(cases, site, expected):
        assert mine == theirs, f"{case}: site says {mine}, contract says {theirs}"
