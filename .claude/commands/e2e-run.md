---
description: Run the e2e suite unattended, one spec file at a time (argument inventory or core), and report the results
---

Run the full Playwright suite and report back. The user invoked this command, which is their permission to run tests. They will be away for a couple of hours: do not stop to ask anything once it starts.

## Steps

1. Check the services are up (read-only): Vite `http://localhost:5173`, Auth emulator `localhost:9099`, Firestore `localhost:8080`. If any is down, say which and stop.
2. Run `npm run e2e:run -- $ARGUMENTS` in the background (`run_in_background`); with no argument leave off the `--`. The argument is `inventory` (inventory files only), `core` (users, products, orders, smoke: everything that is not inventory) or empty (all). It runs each spec file as its own process and writes `e2e/last-run/<file>.json`. Do not run files yourself and do not add other flags. The emulators grow slower and larger over a long run, so the user runs `inventory` and `core` separately with a manual emulator restart and reseed in between (`seed:setup` before inventory, `seed:e2e` before core).
3. Wait for the completion notification. Do not poll.
4. Report from the `RESULT` lines, the summary table and the JSON files: passed, failed, flaky and skipped per file with start and end times, then each failure with `file:line` and its error message (read it from the group's JSON). Separate real failures from `test.fail()` known bugs (see `e2e/CLAUDE.md`).
5. If a group shows "no report written", read the tail of the output to say why.

Do not edit code, reset emulators or re-run failures unless the user asks.
