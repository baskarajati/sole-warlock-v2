# System-readiness Phase 1 — review branch (v2)

> **Install status — `fix/live-readiness` branch (24 Nov 2026, review fix).**
> The Item 1 wiring is now APPLIED in the tree (`bot.js`, `live-reshape-exec.js`,
> `paper-settings.js`). Do not apply the patches again. The creation patches for
> `live-halt.js` and `halt-params.json` were removed: these files were already in
> the tree, and `patch` appended a second copy (exit 0), so `live-halt.js` failed
> with `SyntaxError: Identifier 'fs' has already been declared`. `maxFeeBps` is 0
> for both bots (v2 fee removed). The Item 1 <-> Item 4a `bot.js` hand-merge (N3)
> is still open: the Item 4a diffs were not applied.

Snapshot of the Warlock live system-readiness **Phase 1** code (2026-11-24) for
independent bug review by sole's Claude. Branched from `main`
@ `ef66daa0f0cb2e5ee53bc4a669a305cce0dbf4e1`. `main` is untouched; nothing here
is merged, and this branch is a review snapshot — not a live build.

## Items in this branch

- **Item 1 — halt enforcement (DONE, pending Warlock Head decisions N7/N8/N9).**
  New modules at their natural paths: `live-halt.js`, `halt-params.json`.
  The wiring into `bot.js` and the other existing files is represented by the
  patch files only, under `live-readiness/item1-halt/patches/` — the Item 1 ↔
  Item 4a `bot.js` hand-merge (N3) is **not** done; that is Phase 2's job.
- **Item 4a — alert call-site map + heartbeat (DONE, build scope).** New module
  `feed-health.js`; all other changes as diffs under
  `live-readiness/item4a-alerts/diffs/`. Clone-proven criteria (alert latency
  ≤ 5 min, heartbeat observed, dropped-alert demo) are **not** proven here —
  they belong to Item 2.
- **Item 5 — patch-guard (DONE).** Script `verify-patch.sh` (landed without
  the executable bit — `chmod +x` to run it); procedure and evidence under
  `live-readiness/item5-patchguard/`.
- **Item 6 — v2 settings-pin verification (DONE).** Procedure and evidence
  under `live-readiness/item6-v2pin/`. No code change — the pin was verified,
  not patched.

## What is NOT here

- The merged `bot.js` (N3) and any Phase 2 rehearsal-clone work.
- Any key, secret, token, `.env`, or runtime/paper state. Nothing in this
  branch can start a live instance.
- Any change to a live-mode flag or a running paper window (the v2 paper
  window closes 30 Nov 21:52 CET and is untouched).

## Pending decisions (may change this code later)

- **N7** — K8-mode restatement in the decision table.
- **N8** — K5 loss bar, confirm or restate.
- **N9** — v2 `DEFAULTS` null→5 paper scope (does not touch the running v2
  paper window).
- **N4** — `notifyHalt` caller: rewire `live-halt` to `notifyHalt` vs retire it.

Evidence for each item is its `REVIEW.md` under `live-readiness/<item>/`.
