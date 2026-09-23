# Archive: Keepalive on Studio Next

Keepalive was first built, deployed and evaluated on GenLayer Studio Next (chain 61997, consensus v0.6, runtime
`py-genlayer:5jycge4q`), then moved to Studionet (chain 61999), where the site and the deployment live. Nothing here
is used by the site. It is kept because it is real, on-chain work, and because the same judge giving the same answers
on a second network is evidence about the rubric.

| | |
|---|---|
| Contract | [`0xB636Ab2a57d6047414C1dB8D9fE5dEB6e4f993B9`](https://explorer-studio-dev.genlayer.com/address/0xB636Ab2a57d6047414C1dB8D9fE5dEB6e4f993B9) |
| Record | [`FROZEN.json`](FROZEN.json): addresses, deploy transactions and sha256 of the bytes sent |
| Source | [`contracts/keepalive.py`](contracts/keepalive.py), generated from `contracts/keepalive.py` at the root by `scripts/port.py`; [`contracts/PORT.diff`](contracts/PORT.diff) is the whole difference (header, two imports, three API names) |
| Golden cases | [`eval/results.md`](eval/results.md): 7 of 8 and 3 of 3, with every transaction |
| Web probe | [`eval/web_probe.md`](eval/web_probe.md) |
| DEMO seed | [`docs/seed.studio-next.json`](docs/seed.studio-next.json): 6 streams, 16 checks (4 ALIVE, 7 QUIET, 3 OFF_MISSION, 2 UNREADABLE), 4 lapses, 3 claims paid, 3 exits paid, 1 close |

The archived files are still held to their deployed bytes: `python scripts/port.py --check` regenerates them from the
Studionet source, and `KEEPALIVE_NETWORK=studio-next python scripts/verify.py` (in an environment built from
`requirements-studio-next.txt`, genlayer-py 0.19.0rc2) reads them back off Studio Next and compares.
