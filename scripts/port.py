#!/usr/bin/env python3
"""
The Studio Next port, generated from the Studionet contracts.

    python scripts/port.py           # write the studio-next/ files and PORT.diff
    python scripts/port.py --check   # exit 1 unless they are exactly what this writes

Keepalive runs on Studionet (chain 61999), whose GenVM is v0.2.16 and whose
runner is py-genlayer:1jb45aa8. The same logic was first built and evaluated on
Studio Next (chain 61997), which runs the v0.3 standard library under
py-genlayer:5jycge4q. That library renamed three things the contract calls and
stopped exporting gl and the storage names through the star import, so the
Studionet file cannot load there and the other way round.

The Studio Next files are a function of the Studionet ones, never a second copy
edited by hand. Everything this changes is in the tables below: the runtime
header, two import lines, and three API names. The logic, the rubric and every
string are the Studionet files'. contracts/studio-next/PORT.diff is always the
whole difference, and the Studio Next deployment recorded in
contracts/FROZEN.json is held to these exact bytes by scripts/verify.py.
"""

from __future__ import annotations

import difflib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

RUNTIME_STUDIONET = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"
RUNTIME_STUDIO_NEXT = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng"

HEADER_STUDIONET = '# { "Depends": "' + RUNTIME_STUDIONET + '" }'
#: The version line is how the v0.3 executor reads which ABI a file targets.
HEADER_STUDIO_NEXT = "# v0.3.0\n" + '# { "Depends": "' + RUNTIME_STUDIO_NEXT + '" }'

STAR = "from genlayer import *\n"

#: Studionet name, Studio Next name. Each is the same thing under its new
#: name: run_nondet_unsafe and run_nondet have the same body, message_raw and
#: message.raw are the same decoded dict, and gl.Contract is gl.contract.Contract.
RENAMES = (
    ("gl.Contract)", "gl.contract.Contract)"),
    ("gl.vm.run_nondet_unsafe(", "gl.vm.run_nondet("),
    ("gl.message_raw", "gl.message.raw"),
)

PAIRS = (
    ("contracts/keepalive.py", "contracts/studio-next/keepalive.py"),
    ("eval/probe_contract.py", "eval/studio-next/probe_contract.py"),
    ("eval/web_probe.py", "eval/studio-next/web_probe.py"),
)

DIFF = ROOT / "contracts" / "studio-next" / "PORT.diff"


def storage_import(text: str) -> str:
    if "allow_storage" in text:
        return "from genlayer.storage import TreeMap, allow as allow_storage\n"
    return "from genlayer.storage import TreeMap\n"


def port(text: str) -> str:
    """Studionet source to Studio Next source."""
    if not text.startswith(HEADER_STUDIONET + "\n"):
        raise SystemExit("a Studionet file must start with the py-genlayer:1jb45aa8 header")
    out = HEADER_STUDIO_NEXT + text[len(HEADER_STUDIONET) :]
    if out.count(STAR) != 1:
        raise SystemExit("expected exactly one star import")
    out = out.replace(STAR, STAR + storage_import(text) + "import genlayer as gl\n", 1)
    for old, new in RENAMES:
        if new in text:
            raise SystemExit(f"the Studionet file already contains the Studio Next name {new!r}")
        out = out.replace(old, new)
    return out


def unport(text: str) -> str:
    """Studio Next source back to Studionet source: the exact inverse of port()."""
    if not text.startswith(HEADER_STUDIO_NEXT + "\n"):
        raise SystemExit("a Studio Next file must start with the v0.3.0 and py-genlayer:5jycge4q header")
    out = HEADER_STUDIONET + text[len(HEADER_STUDIO_NEXT) :]
    out = out.replace(STAR + storage_import(text) + "import genlayer as gl\n", STAR, 1)
    for old, new in RENAMES:
        out = out.replace(new, old)
    if port(out) != text:
        raise SystemExit("unport is not the inverse of port for this file")
    return out


def render() -> dict[pathlib.Path, str]:
    outputs: dict[pathlib.Path, str] = {}
    diff_lines = [
        "# contracts/studio-next/PORT.diff, written by scripts/port.py. Do not edit it.",
        "#",
        f"# The whole difference between the Studionet files ({RUNTIME_STUDIONET})",
        f"# and the Studio Next files ({RUNTIME_STUDIO_NEXT}).",
        "# Every changed line is the runtime header, an import, or one of three API",
        "# names: gl.Contract, gl.vm.run_nondet_unsafe and gl.message_raw.",
        "",
    ]
    for source, target in PAIRS:
        text = (ROOT / source).read_text(encoding="utf-8")
        ported = port(text)
        outputs[ROOT / target] = ported
        diff_lines += list(
            difflib.unified_diff(text.splitlines(), ported.splitlines(), fromfile=source, tofile=target, lineterm="", n=0)
        )
    outputs[DIFF] = "\n".join(diff_lines) + "\n"
    return outputs


def main() -> int:
    outputs = render()
    if "--check" in sys.argv:
        stale = [p for p, t in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        for path in stale:
            print(f"{path.relative_to(ROOT).as_posix()} is not what scripts/port.py writes. Run it.")
        return 1 if stale else 0
    for path, text in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
