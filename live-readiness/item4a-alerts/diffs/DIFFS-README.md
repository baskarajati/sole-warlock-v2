# Diffs — Item 4a (alert call sites + heartbeat + feed-health reporting)

Unified diffs against the pristine trees in `../pristine-v1/` and `../pristine-v2/`
(VPS trees as read 2026-11-24; md5s in `../CALL-SITE-MAP.md` §header).

## Fork targets (commit here later; do not block on the forks)

| Diffs | Fork | Fork HEAD (2026-11-24, per MEMORY.md) |
|---|---|---|
| `v1-*.diff` | `baskarajati/Sol-Warlock-Meteora-LP-Bot` | `22a59b43` |
| `v2-*.diff` | `baskarajati/sole-warlock-v2` | `ef66daa0` |

**Before committing, confirm the fork HEAD matches the pristine md5s.** The fork
contents were NOT verified against the VPS trees in this item; if a fork HEAD
differs from the pristine tree, rebase these diffs onto the fork HEAD first.

## Files

| Diff | Target file | What it adds |
|---|---|---|
| `v1-bot.js.diff` | v1 `bot.js` | `liveAlertOpen` + open/close/reshape/reposition/kill-switch/feed-degraded call sites, `liveRealisedUsd`, `feedHealth` wiring, live main-loop startup/error/heartbeat; fix round: reposition success path passes `sigs: legRow.sigs` + `runningRealisedUsd` |
| `v1-telegram-notify.js.diff` | v1 `telegram-notify.js` | `notifyKillSwitch` / `notifyHalt` / `notifyFeedDegraded`, `statusFromLiveState`, alert-outcome log (`alerts.jsonl`), sig/running/quoted/swap-back lines, live-aware wording; fix round: `notifyReposition` renders sigs + running realised when passed |
| `v1-feed-health.js.diff` | v1 `feed-health.js` | NEW file — rolling-hour feed-health counters (reporting only) |
| `v1-live-open-exec.js.diff` | v1 `live-open-exec.js` | `openDeposit` returns `sigs[]` |
| `v1-live-close-exec.js.diff` | v1 `live-close-exec.js` | `swapBack` returns `sigs[]` |
| `v1-live-reshape-exec.js.diff` | v1 `live-reshape-exec.js` | `reshape` returns `sigs[]` (`readd` returns its sigs) |
| `v1-live-reposition-exec.js.diff` | v1 `live-reposition-exec.js` | `openNew` gets `intermediate: true`; reposition returns the closed `leg` |
| `v2-bot.js.diff` | v2 `bot.js` | sigs/running on open/close, `closeSigs` capture before `clearCloseMarks`, `decisionVal` to close, gated reshape call site, kill-switch/feed-degraded alerts, live main-loop startup/error/heartbeat, `[LIVE-v2]` on raw sends |
| `v2-telegram-notify.js.diff` | v2 `telegram-notify.js` | PREFIX `[LIVE-v2]`, `notifyReshape` un-stubbed, `notifyKillSwitch` / `notifyHalt` / `notifyFeedDegraded`, `statusFromLiveState`, alert-outcome log |
| `v2-tg-format.js.diff` | v2 `tg-format.js` | sigs/running/quoted/swap-back lines in `closeHtml`/`openHtml`/`reshapeHtml`; fees-paid + feed-health lines in `dailySummaryHtml`; fix round: `mode()` live branch renders `🔴 [LIVE-v2]` (N1), shortened-sig line in `repositionHtml` + `repositionFailedHtml` (N2) |
| `v2-feed-health.js.diff` | v2 `feed-health.js` | NEW file — same as v1 |
| `v2-live-open-exec.js.diff` | v2 `live-open-exec.js` | `sendLeg` returns sigs; `openDeposit` returns `sigs[]` |
| `v2-live-close-exec.js.diff` | v2 `live-close-exec.js` | `swapBack` / `swapBackSol` return `sigs[]` |
| `v2-live-reshape-exec.js.diff` | v2 `live-reshape-exec.js` | `reshape` returns `sigs[]` (`readd` returns its sigs) |
| `v2-live-reposition-exec.js.diff` | v2 `live-reposition-exec.js` | `openNew` gets `intermediate: true`; reposition returns the closed `leg`; fix round: the reposition event carries `sigs: leg.row.sigs` (N2) |
| `v2-rpc-config.js.diff` | v2 `rpc-config.js` | `makeFetch` records 429/5xx/network errors into `feed-health` |

## Applying

From the root of a checkout of the matching tree:

```sh
patch -p1 < v1-bot.js.diff        # diffs carry pristine-v1/… / patched-v1/… paths;
patch -p0 < v1-bot.js.diff        # use -p0 if your checkout dir is named pristine-v1,
                                  # -p1 after renaming it to the repo root — verify with
                                  # patch --dry-run first.
```

Verified in this build: all 16 diffs apply cleanly with `patch -p0 --batch`
against fresh copies of the pristine trees and reproduce the patched trees
byte-for-byte (`diff -r` identical). `node --check` passes on every patched
file. See `../CALL-SITE-MAP.md` §6 for the full verification evidence.

## What is NOT in these diffs

- No trip/detection code for halt or circuit-breaker (Item 1). `notifyHalt`
  is built but has no caller until Item 1 lands.
- No feed-RULE code (plan §3.1.7 — Item 1). `feed-health.js` counts only.
- No VPS writes, no live money, no keys. These diffs enter the VPS only
  through the rehearsal-clone install.
