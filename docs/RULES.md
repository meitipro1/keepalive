# The twenty rules, and what Keepalive does about each

The rules come from five rejection notices and three live deployments
("Rules for an Intelligent Contract"). Each row names the rule, what this
repository does about it, and where to check.

| # | Rule | What Keepalive does | Where to check |
|---|---|---|---|
| 01 | Ask for the coarsest answer that still carries the judgment | The judge answers one label from a closed set of four. Only the label crosses consensus as a decision; the reason is display only. | `VERDICTS`, `parse_verdict`, `run_judgment` |
| 02 | Put the uncertainty in the value, never in the comparison | Validators compare the label exactly. No tolerance, no forgiven pairs: a validator that reads the pages differently votes disagree and the round rotates. UNREADABLE is its own stored value with its own rule (no strike, one recheck), not a forgiven mismatch. | `run_judgment`, `test_a_different_label_is_a_disagreement_and_nothing_is_stored` |
| 03 | A comment arguing why a tolerance is safe is a smell | There is no tolerance to argue for. | `run_judgment` |
| 04 | Ask the same question in both presentation orders | Not applied, on purpose: Keepalive asks one classification of one report against its own evidence. There is no pair whose order could bias the answer. | `CHECK` |
| 05 | Every write is bound to an address | `report`, `claim` and `close` refuse everyone but the builder. `open_stream`, `fund` and `exit` act on the caller's own address. `check` and `lapse` are open on purpose and record the caller. | `test_static.py::WRITE_AUTH`, `test_owner_writes_compare_the_sender_to_the_owner` |
| 06 | Cover the methods nobody has written yet | A static test fails when a new write is not classified, and when any write never reads the sender. The reason `check` and `lapse` are open is written into the test. | `test_every_write_is_classified`, `OPEN_REASON` |
| 07 | Record provenance on the row | Every period stores who reported it and who checked or lapsed it; every position is keyed by the patron's address; the views publish them. | `Period.reporter`, `Period.checker` |
| 08 | A refusal must leave the refused party somewhere to go | UNREADABLE opens one recheck with new links inside grace. A paused stream is lifted by the next alive check. A patron can always exit. The way out is never "ask again until it suits": the recheck is once, and an unamended recheck waits for grace to end. | `test_recheck_waits_for_new_links_inside_grace`, `test_first_alive_after_a_pause_lifts_it_without_release` |
| 09 | Tagging untrusted text is not a fence | `fence()` replaces `<` and `>` in the mission, the report, every URL and every fetched page at the prompt boundary. Replace, never delete. Storage keeps the original. Links with angle brackets are refused before they are stored. | `fence`, `test_a_report_cannot_close_its_own_block` |
| 10 | Assert the closure, not that a payload arrived | Tests count the opening and closing delimiters of every block. A static test fails when any value reaches the prompt without `fence()` and is not a name the contract owns. | `delimiter_counts`, `test_every_prompt_value_is_fenced_or_owned_by_the_contract` |
| 11 | Content-free items make honest validators disagree | Golden cases and DEMO reports are real sentences about real pages; every DEMO report quotes the commits that actually landed. | `eval/golden.json`, `scripts/seed.py` |
| 12 | Change one thing per demonstration | Each golden case varies one thing against the rubric: the date, the mission, the triviality, the readability. | `eval/GOLDEN-SOURCES.md` |
| 13 | Say it in the words the prompt asks in | Missions are one sentence naming the work; reports say what shipped. | `eval/golden.json` |
| 14 | No single pair may reveal what only the contract should see | Nothing is hidden from the judge here: each check sees one period's evidence, and the two-strike rule is enforced by the contract, never asked of the model. | `_strike` |
| 15 | Diff the deployed source, and lint the deployed bytes | `scripts/verify.py` reads each contract back with `gen_getContractCode`, separates cosmetic from material differences, and lints the bytes that came back. | `scripts/verify.py` |
| 16 | Put both paths on the explorer | The golden runs store QUIET, OFF_MISSION and UNREADABLE verdicts on chain with their transactions, and the DEMO seed puts a quiet, a lapse, a pause, an off-mission period and an unreadable recheck on chain. | `eval/results.md`, `docs/seed.studionet.json` |
| 17 | Mutate every defence | `scripts/mutate.py` breaks 36 defences one at a time and names the test that caught each, read from pytest's report, and refuses to write the table if anything escapes. The first run found one escape: the validator's closed-set check could not fail on its own, because the label comparison already refuses a forged label. What that check buys is cost, so the missing test was written for exactly that: a forged answer is refused before any page is fetched. | `docs/MUTATIONS.md`, `test_a_forged_label_is_refused_without_reading_anything` |
| 18 | Give each node its own world in the simulator | The test double gives the leader and every validator their own pages and model answers, and compares addresses as bytes. | `tests/genvm_double.py`, `test_each_node_reads_its_own_pages` |
| 19 | Make the suite clean on a reviewer's machine | The integration test is skipped unless `KEEPALIVE_INTEGRATION=1`; the rest needs no network. | `tests/test_integration.py` |
| 20 | Generate anything the repo offers to be copied | The probe contracts are generated from the contract's own functions, the Studio Next files from the Studionet ones, and the site's rubric page from the contract's constant, each with a `--check` mode a test runs. | `scripts/gen_probe.py`, `scripts/port.py`, `test_the_probe_judges_with_the_contract_s_own_code` |

## GenVM rules the runtime enforces badly

| Rule | Here |
|---|---|
| No collection inside a storage dataclass | Sources and links are stored newline-joined; `test_no_collection_inside_a_storage_dataclass` |
| No `int`, `list`, `dict` or `tuple` as a storage type | `test_no_plain_python_types_in_storage` |
| Every persistent field declared in the class body | `test_every_persistent_field_is_declared_in_the_class_body` |
| The nondet block returns a flat dict of strings | `judge()` returns four strings; the test double refuses anything else |
| Never compare storage objects by identity | `test_storage_objects_are_never_compared_by_identity` |
| Every `gl.nondet.*` inside a consensus closure | `test_nondet_calls_live_only_in_the_judge` |
| No block timestamp | Time is `gl.message_raw["datetime"]` (Studio Next: `gl.message.raw`), in integer seconds |
| `genvm-lint check` can print green under a lint failure | `scripts/verify.py` reads the JSON verdict and the exit code, never the last line |
