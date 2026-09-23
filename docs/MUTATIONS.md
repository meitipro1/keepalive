# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 36 defences in
`contracts/keepalive.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generator and port parity tests are excluded, because they fail for any edit at all.

| # | defence broken | caught by |
|---|---|---|
| 1 | report: any account may report | `tests/test_direct.py::test_only_the_builder_may_report[studionet]` |
| 2 | claim: any account may claim | `tests/test_direct.py::test_only_the_builder_may_claim[studionet]` |
| 3 | close: any account may close | `tests/test_direct.py::test_only_the_builder_may_close[studionet]` |
| 4 | fund: a paused stream takes deposits | `tests/test_direct.py::test_two_strikes_in_a_row_pause_the_stream[studionet]` |
| 5 | fund: a closed stream takes deposits | `tests/test_direct.py::test_after_close_patrons_exit_everything_and_the_builder_claims[studionet]` |
| 6 | fund: zero value accepted | `tests/test_direct.py::test_fund_refuses_zero_value[studionet]` |
| 7 | fund: shares minted against the wrong ratio | `tests/test_direct.py::test_worked_example_from_the_spec[studionet]` |
| 8 | exit: more shares than held may be burnt | `tests/test_direct.py::test_exit_refuses_more_shares_than_held[studionet]` |
| 9 | exit: pays one wei too much | `tests/test_direct.py::test_worked_example_from_the_spec[studionet]` |
| 10 | exit: patron count never falls | `tests/test_direct.py::test_patron_count_follows_holdings[studionet]` |
| 11 | claim: claimable is not cleared | `tests/test_direct.py::test_claim_pays_the_builder_the_claimable_balance[studionet]` |
| 12 | check: the full tranche is released even from a short pool | `tests/test_direct.py::test_a_resolved_period_cannot_be_reported[studionet]` |
| 13 | check: a paused stream is paid by the alive that lifts it | `tests/test_direct.py::test_first_alive_after_a_pause_lifts_it_without_release[studionet]` |
| 14 | check: two strikes do not pause | `tests/test_direct.py::test_exit_is_allowed_while_paused_and_after_close[studionet]` |
| 15 | check: an alive does not reset strikes | `tests/test_direct.py::test_one_strike_between_alives_never_pauses[studionet]` |
| 16 | check: a first unreadable is final | `tests/test_direct.py::test_unreadable_first_check_opens_a_recheck_without_a_strike[studionet]` |
| 17 | check: a recheck runs before the builder swaps links | `tests/test_direct.py::test_recheck_waits_for_new_links_inside_grace[studionet]` |
| 18 | check: runs before the period ends | `tests/test_direct.py::test_check_waits_for_the_period_to_end[studionet]` |
| 19 | check: periods out of order | `tests/test_direct.py::test_periods_resolve_in_order[studionet]` |
| 20 | check: the pool emptying keeps the old share epoch | `tests/test_direct.py::test_an_emptied_pool_starts_a_new_share_epoch[studionet]` |
| 21 | lapse: records before grace ends | `tests/test_direct.py::test_lapse_waits_for_grace_to_end[studionet]` |
| 22 | lapse: lapses a period that has a report | `tests/test_direct.py::test_lapse_refuses_a_period_with_a_report[studionet]` |
| 23 | report: accepted after grace | `tests/test_direct.py::test_report_window_runs_from_start_to_end_of_grace[studionet]` |
| 24 | report: a link outside the declared sources is accepted | `tests/test_direct.py::test_links_must_start_with_a_declared_source[studionet]` |
| 25 | sources: the prefix check has no boundary | `tests/test_direct.py::test_the_prefix_check_has_a_boundary[studionet-https://corvid.dev/changelog-fake]` |
| 26 | sources: a bare shared host is accepted | `tests/test_direct.py::test_open_refuses_bad_sources[studionet-github.com-shared` |
| 27 | links: any character is accepted | `tests/test_direct.py::test_open_refuses_bad_sources[studionet-corvid` |
| 28 | open: a DEMO stream may run day-long periods | `tests/test_direct.py::test_demo_refuses_a_period_in_days[studionet]` |
| 29 | open: any period length is accepted | `tests/test_direct.py::test_open_refuses_other_periods[studionet-0]` |
| 30 | judge: the fence lets delimiters through | `tests/test_direct.py::test_a_report_cannot_close_its_own_block[studionet]` |
| 31 | judge: validators agree with any label | `tests/test_direct.py::test_a_different_label_is_a_disagreement_and_nothing_is_stored[studionet]` |
| 32 | judge: a label outside the closed set is compared | `tests/test_direct.py::test_a_forged_label_is_refused_without_reading_anything[studionet]` |
| 33 | judge: an unparseable answer defaults to QUIET | `tests/test_direct.py::test_parse_verdict_refuses_everything_else[studionet-{"verdict":` |
| 34 | judge: pages are not cut to 5,000 characters | `tests/test_direct.py::test_pages_are_cut_to_5000_characters[studionet]` |
| 35 | judge: commits show the author date | `tests/test_direct.py::test_commits_are_condensed_to_one_line_each[studionet]` |
| 36 | judge: the autolink window starts a day early | `tests/test_direct.py::test_leader_and_validator_each_fetch_every_link[studionet]` |
