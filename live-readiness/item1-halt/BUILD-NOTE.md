# Item 1 — Build Note: per-book safety-halt enforcement in code

**Track:** Warlock Live System-Readiness, Item 1 (plan §3) · **Built:** 2026-11-24
**Bases (read-only SSH, exact trees):** v1 `~/DLMM/audit/repo/sol-lp-bot`
(`bot.js` 2,520 lines); v2 `~/apps/warlock-v2` at commit `6c3ae78`
(`bot.js` 3,004 lines). Pristine copies fetched for diffing are in
`pristine/`; the patched results are in `patched/`. Nothing was written to
the VPS. **Fix revision (review close-out): 2026-11-24 — REVIEW.md notes N1–N6 + N14
fixed (see §8). Line numbers in §1.2 are post-fix. The v2
`DEFAULTS null → 5` hunk is kept as-is pending Warlock Head's N9 decision
(§4 A15). No QC / Security verdict is claimed here** — those come from the
independent reviewer.

**Install target (later, rehearsal clone only, W-1):** apply the `patches/`
files to the clone's v1 tree (5 patches) / v2 tree (5 patches). All 10
patches were verified to apply cleanly with `patch` and to reproduce
`patched/` byte-for-byte. **Fork note:** sole forked both repos under
baskarajati on 24 Nov ~17:39 CET (v1 HEAD `22a59b43`, v2 HEAD `ef66daa0`).
These diffs are against the VPS trees, not the fork HEADs — rebase/diff
against the fork trees at install time before applying, and confirm the
v2 fork's `RESHAPE_MAX=5 gate` commit is the same paper freeze gate this
note describes (it is named in the fork HEAD, not yet read).

## 1. What was built

One new shared module, `live-halt.js` (identical file in both trees; the
only per-bot difference is the `maxFeeBps` passed at construction: v1 = 0,
v2 = 50), plus thin wiring in `bot.js` on both trees, a per-leg reshape
cap in `live-reshape-exec.js` on both trees, and settings entries so the
cap is honoured. Full API + accounting is documented in the header comment
of `live-halt.js` itself.

### 1.1 `live-halt.js` (new file, both trees) — the whole mechanism

- **Parameters** — `DEFAULT_PARAMS` is the D-0c Rev 1 table as *fractions*
  (book 5 SOL, leg 1.25 SOL, K1 −30% of leg, K2 >15% of book, K3 3,
  K4 5 totalling <−10% of book, K5 worst-3 <−30% of book, K6 <−15% of
  book after 30 legs / 7 days, daily 7.5% of book, K7 2 breaches,
  K8 gap >0.0625 SOL ×2 consecutive exits, feed stale 2 polls /
  degraded 3 polls, `reshapeMax` 5). The effective table is read from
  `<instance-dir>/halt-params.json` when present (installed as
  `halt-params-v1.json` / `halt-params-v2.json`, differing only in
  `maxFeeBps`), then `HALT_*` env vars; the in-code table is only the
  fallback. Derived SOL figures are computed from the fractions and
  exposed by `status()` — verified in simulation P0: K1 0.375, K2 0.75,
  K4 0.50, K5 1.50, K6 0.75, daily 0.375 SOL. Sole changes any number at
  go-live by editing the JSON and restarting — no rebuild.
- **Accounting (persisted in `<DIR>/halt-state.json`, atomic tmp+rename)** —
  per-calendar-day (Europe/Berlin civil day) realised-loss accumulator
  with day-boundary reset; consecutive emergency-stop counter;
  consecutive-loss run (with trailing-5 sum); entry-cluster map
  (pool + entry minute → summed PnL); closed-leg count + cumulative net;
  per-exit quote-vs-fill gap (consecutive counter); feed staleness
  counters (`lastSolUsdAt`, `lastScanAt`); pilot-start timestamp.
- **Trip actions** — `trip(criterion, figures, action)`: action `STOP`
  writes `HALT` (JSON: criterion, timestamp, figures) + `STOP`, logs
  `HALT TRIP <criterion> …`, fires `notifyEmergency` with the criterion
  and figures in the Alasan line; action `NO_NEW` writes `NO_NEW` +
  same log/alert. First STOP trip wins and is never overwritten.
- **Latch + manual reset** — `state.tripped` latches; `checkOpen` /
  `refuseOpen` refuse while tripped even if figures improve. A restart
  never auto-clears: state is reloaded from `halt-state.json`, and if
  that file is lost the constructor re-latches from the `HALT` file
  itself (simulated and passing). The module never deletes `HALT` or
  `STOP`; clearing needs sole removing both after review. Two scoped,
  specified exceptions, both logged: (a) a 1st daily-breach `NO_NEW`
  lives for the rest of its CET day only and is lifted by the module at
  the day boundary; (b) a feed-degraded `NO_NEW` is lifted when a fresh
  price arrives (rails §6.3: "`NO_NEW` until a fresh price arrives").
- **Feed rules (§3.1.7)** — `checkFeed()` once per `liveCycle` poll:
  stale = SOL/USD age or screening-snapshot age > 2 polls (10 min at
  `POLL_SEC` 300); stale increments a counter; 3 consecutive stale
  polls → `feed-degraded` alert + `NO_NEW` until fresh; fresh again →
  counter reset + `NO_NEW` lifted (logged). `refuseOpen()` refuses
  opens on a stale feed at the choke point. Exits are *not* blocked by
  a stale feed: they follow the existing quote → 10-poll on-chain
  estimate order, and an exit taken on an estimate is flagged (below).
  "Never close on a guessed price" is the existing
  held-and-retried-next-poll path; the new code adds the explicit
  valuation flag on the close row so it is visible.
- **K9** — deliberately absent. Monitoring rule only, per plan §3.1.2.

### 1.2 `bot.js` wiring (both trees)

| Hook | v1 (patched lines) | v2 (patched lines) | What it does |
|---|---|---|---|
| Require + instance | 55, 64 | 64, 70 | `liveHalt.create({dir: DIR, bot, log, notifyEmergency: telegram.notifyEmergency, maxFeeBps})` — v1 0 bps, v2 50 bps |
| CFG `RESHAPE_MAX` | 128 | 133 | Env default 5; `settings.json` wins via `applyPaperSettings` |
| `solUsd()` freshness | 260, 265 | 247, 252 | On every successful CoinGecko/DexScreener fetch: `halt.noteSolUsdAt(Date.now())` |
| **`liveOpen()` choke point** | 2025 (gate 2029, fee 2031) | 2028 (gate 2032, fee 2034) | Before any chain call: `checkGate` (K8 mode) → `checkFeeBps` (K8 fee) → `refuseOpen` (latch / STOP / NO_NEW / daily pause / feed). Returns `{skipped}` on refusal. `checkFeeBps` is fail-closed (N4): an unreadable fee trips K8 instead of passing |
| `jupiterSwapLive()` fee | 2333 | 2575 | `checkFeeBps(ROUTE_FEE_BPS)` before any swap is sent; a restored upstream fee trips K8 and the swap is not sent |
| `liveClose()` / `finishLiveClose()` + `liveCloseSol()` | 2167 (stamp 2202, record 2228) | 2322 (stamp 2368, record 2395); 2407 (stamp 2444, record 2456; assert 2464) | Stamp `row.quoted` / `row.valuationBasis` from the exit valuation; `halt.recordClose(...)` for real closed legs only (intermediate reposition legs excluded — the final close carries the leg PnL). **Never skips accounting (N2):** falls back to the last-good SOL price (fresh `solUsd()`, else the halt module's persisted last-good price) and flags the row `priceFallback`; only when no SOL price was ever seen is `pnlSol` booked as 0, leg still counted. **K8 gap compares like with like (N3):** `realisedSol` subtracts the out-of-position pile (`leftoverSol + rentRefundableSol`); no gap observation on an incomplete swap-back or with no price. v2 `liveCloseSol` asserts `quoteMint === SOL` after the close is counted (N3) |
| `livePositionCycle()` valuation pass | 2410 | 2724 | `liveClose(state, exitReason, {valuation: decisionVal ? {quoted, basis} : null})` |
| `livePositionCycle()` live object | 2362 | 2642 | Stamps `quoteMint: 'SOL' / 'USDC'` on the `live` entry — the quote units of `pnlSol` (N1). `liveCycle` reads it to convert USDC legs |
| `livePositionCycle()` freeze log | 2391 | 2702 | Log `reshape FROZEN … (RESHAPE_MAX=…)` once per position when the trigger reports `capped` |
| **`liveCycle()` per-cycle evaluation** | 2415 (block 2433–2456) | 2841 (block 2900–2923) | Once per cycle, before any open: `checkFeed()` (feed rule) → K2 drawdown + K6 7-day branch with open unrealised PnL included → on refusal, write status with `halt: halt.status()` and return without opening. **Open unrealised is converted, not summed raw (N1):** `halt.openUnrealisedSol(lives, px)` divides USDC legs by the SOL price; if no price exists at all the K2/K6 verdict is skipped this poll (logged) and the `liveOpen` gate still applies to every open |

### 1.3 `live-reshape-exec.js` — RESHAPE_MAX per-leg cap (closes OPEN-3)

- **Pristine gap (both trees):** the live `trigger()` has NO cap. v1's
  only cap is the paper variant-E freeze gate (`bot.js` paperCycle,
  `VARIANT_SETTINGS.E = {RESHAPE_MAX: 5}`); v2's 23 Nov port added the
  cap only to the paper freeze gate (`bot.js:1818`) and to
  `paper-settings.js` — the live trigger was never capped.
- **Patch (v1:15, v2:16):** `max = Number.isFinite(settings.RESHAPE_MAX)
  ? settings.RESHAPE_MAX : 5`; if `(pos.reshapes || 0) >= max` return
  `{due: false, capped: true, max, reshapes}`. A frozen leg stays open;
  the −20% emergency stop, TP and max-age exits stay live — same freeze
  semantics as the paper gate. Unset setting = D-0c default 5; an
  explicit positive integer wins.
- **Settings chain:** v1 `paper-settings.js` gains `RESHAPE_MAX: 5` in
  `DEFAULTS` (:28) and a `FIELDS` entry (:121, mirroring v2's). v2
  `paper-settings.js` changes `DEFAULTS.RESHAPE_MAX: null → 5` (:28).
  The v2 change matters: `currentValues()` returns `{...DEFAULTS,
  ...pickAllowed(file.values)}`, and the running v2 paper tree has **no
  `settings.json`** — so pristine v2 returns `null`, `CFG.RESHAPE_MAX`
  is null, and the paper freeze gate (`Number.isFinite(null)` = false)
  **never fired on the running v2 paper instance**. The 23 Nov port set
  the FIELDS default to 5 but left DEFAULTS null. Verified in the
  harness: pristine v1 `undefined`, pristine v2 `null`, patched both `5`.
  `applyPaperSettings()` already copies `strategy.KEYS` (which includes
  `RESHAPE_MAX` in both trees) into `CFG`, and `strategy.snapshot(CFG)`
  stamps it into each position, so the live trigger sees it via `pol`.

- **Correction (review close-out, N5):** the original build also exported a
  `reshapeFrozen(pos, settings)` helper from `live-halt.js` whose comment
  claimed "`live-reshape-exec.trigger()` calls this" — that was false. The
  trigger was never wired to it; it implements the cap inline (above), and
  the two differed on non-finite input (inline defaults to 5,
  `reshapeFrozen` returned `false` = no cap). Fix chosen: **delete the
  export** (function + export entry removed from `live-halt.js` in both
  trees). The inline cap in `trigger()` is the only implementation; nothing
  references `reshapeFrozen` anywhere else.

## 2. Why no open route bypasses the halt

Open routes found by fresh reads of both trees:

- **v1:** (a) `liveCycle()` scan loop → `liveOpen()` (bot.js:2395
  pristine); (b) `livePositionCycle()` OOR-right reposition
  `openNew: (pool, o) => liveOpen(pool, state, o)` (bot.js:2326).
  Note the reposition runs *before* `liveCycle()`'s STOP/NO_NEW check
  in the same cycle, and under `NO_NEW` alone (no STOP) it could
  previously open — the `liveOpen()` gate closes that route too.
- **v2:** (a) scan loop → `liveOpen()` (bot.js:2854); (b) reposition
  `openNew` (bot.js:2607); (c) **`liveManualOpen()`** (bot.js:2732,
  Mini App manual open) → `liveOpen(p, state, {source: 'manual'})`
  (bot.js:2755) — a v2-only route, also funnels through `liveOpen()`.
  `reconcileLive()` adopts already-funded on-chain positions into
  management; it does not open anything (and refuses to adopt while
  STOP is present, bot.js:2677).

Every route funnels through `liveOpen()`, and the halt gate is the
first thing `liveOpen()` does — before the SL-blacklist, cooldown, TVL,
and entry-cost guards, and before any chain call (`DLMM.create`,
`solUsd`, swaps). In addition, `liveCycle()` evaluates feed + K2 + K6
once per cycle before the scan/manual open, so a breach is caught in
the same cycle it becomes measurable. `liveClose()` is unchanged as an
exit path: a halt never abandons positions — open positions unwind
through the normal close path and the process exits once flat on STOP
(bot.js:2374 v1 / :2819 v2, pre-existing).

## 3. Thresholds are parameters (D-0c)

`halt-params.json` (installed at the instance root) carries the D-0c
table as fractions; `live-halt.js` derives the SOL figures. The v1 and
v2 params files differ in exactly one field (`maxFeeBps`: 0 vs 50).
`HALT_*` env vars override individual keys. QC can verify the
derivation with `halt.params()` / `halt.status()` (simulation P0).

## 4. Ambiguities and decisions (stated, not improvised silently)

- **A1 — K8 "STOP absent while live" (D-0c wording).** Read literally it
  would trip on every legitimate live trade (a live instance normally
  runs with STOP absent). NOT implemented literally. The implemented
  gate-state check trips on (i) `LIVE_CONFIRMED=1` while `PAPER=1` or
  `DRY_RUN=1`, and (ii) a live open attempted while STOP is present
  (defence in depth — the cycle already re-checks). Needs QC/Security
  to confirm the reading, or Warlock Head to restate the criterion.
- **A2 — K5 cluster definition.** Extension B never defines "entry
  cluster" formally. Adopted the consistency-baseline method note:
  *event = instance + pool + entry minute*; a cluster is legs sharing
  pool + entry minute, worst-3 = the three most-negative cluster
  totals in the pilot window. Simulation finding: with single-leg
  clusters K5 is unreachable without K1 firing first (max 3 × 0.375 =
  1.125 < 1.50) — see TEST-EVIDENCE.md finding 2.
- **A3 — K4 "5 totalling < −0.50".** Read as the trailing 5 of the
  current consecutive-loss run; trip when that sum < −0.50 SOL.
- **A4 — K2 drawdown.** Pilot-start equity is the book (`bookSol` = 5);
  current equity = book + cumulative realised net + open unrealised
  (from `liveCycle`'s `lives[].pnlSol`). No wallet-balance read is used
  for K2 (wallet reads would count deposits/withdrawals as PnL).
- **A5 — Daily loss.** Net realised PnL for the CET day (wins offset
  losses), per pilot spec §2.4 ("0.375 SOL net realised loss per
  calendar day"). One breach counted per day (further same-day losses
  do not double-count). CET day = Europe/Berlin civil day.
- **A6 — Alert title.** `notifyEmergency`'s title is the existing
  emergency-stop title; the halt criterion + figures ride in the
  `closeReasonText` (Alasan) line, which `closeBody` renders verbatim.
  Item 4a may give halts their own title later; content is complete.
- **A7 — v1 live close has no Telegram call site (OPEN-4).** v1
  `liveClose()` never notifies (only `paperClose` does). The §3.1.7
  "flagged in the alert" half therefore rides on Item 4a's call-site
  map: this build stamps `row.quoted` / `row.valuationBasis` and the
  log line, which is what 4a's close call site reads. v2's
  `liveNotifyClose(row, …)` already renders the row, so the flag
  reaches the v2 alert through the existing call site. NOT built here:
  no new notify call site was added (that is Item 4a's scope).
- **A8 — "Never close on a guessed price".** The existing code already
  holds and retries next poll when the exit decision throws
  (`livePositionCycle` catch). The new code adds the explicit
  valuation flag; there is no `basis === 'none'` value in current
  `paper-usdc.exitQuote` output (it always falls back to an on-chain
  estimate after 10 failed polls), so no new refusal branch was
  invented for a case the code cannot produce.
- **A9 — Fee check reads the configured fee.** `ROUTE_FEE_BPS` from
  `swap-route-config.js` is the fee the swap will charge (the swap
  body params are built from it). There is no per-swap on-chain fee
  receipt to compare against; the md5/patch-guard check for the file
  itself is Item 5's scope. A fee change trips K8 at the next
  open/swap attempt, before the swap is sent.
- **A10 — N1 (K2 units): normalise by quoteMint at the source of the
  sum.** `livePositionCycle` stamps `quoteMint: 'SOL' / 'USDC'` (symbol,
  mapped from the position's mint) on each `live` entry, and `liveCycle`
  converts through `halt.openUnrealisedSol(lives, px)` — USDC legs
  divided by the SOL price, SOL legs passed through. Chosen over
  computing unrealised in SOL inside `livePositionCycle` because the
  conversion needs one price per cycle (not one per leg) and the helper
  is unit-testable in isolation. A leg that cannot be converted (USDC
  leg with no usable price, or an entry with no `quoteMint`) returns
  `null` and the K2/K6 verdict is skipped for that poll (logged) —
  never guessed, never silently treated as SOL. The `live.pnlUsd`
  alternative (reviewer's suggestion) was not used: `pnlUsd` only exists
  when the exit decision ran that poll, while `pnlSol / px` works on
  every poll including STOP polls.
- **A11 — N2 (px=0 close skip): never skip accounting.** Fallback chain
  for the close price: fresh `solUsd()` (which already returns its
  last-good cached price) → `halt.lastSolUsdPx()` (last-good price the
  module remembers, persisted in `halt-state.json`, so it survives a
  restart mid-outage) → only when no SOL price was ever seen, book
  `pnlSol` as 0 with the row flagged `priceFallback` (the leg is still
  counted: `closedLegs`, K3, K4, K5, K7 all see it; only the PnL
  magnitude is 0, and the log line says so loudly). A price older than
  the 60 s `solUsd` cache window is flagged `priceFallback` too. The
  "close's own valuation price" alternative was not needed: `solUsd()`'s
  cache plus the persisted last-good price cover every case except
  "never had a price", where no valuation price exists either.
- **A12 — N3 (K8 gap pile bias): subtract the pile components from
  `realisedSol`.** `pileOutsideSol = leftoverSol + rentRefundableSol`
  (both fields exist on every live position record in both trees). The
  position's own SOL quote side stays in `realisedSol` — only the
  out-of-position pile is removed, so the subtraction is correct for
  both SOL and USDC pools (for SOL pools the pile passed to the
  swap-back includes the position quote side, which is NOT subtracted).
  Residuals, stated: close fees inside `receivedSol` stay in (they
  shrink the gap slightly — the safe direction), and execution-price
  noise on the pile sale remains (small). No gap observation when the
  swap-back is incomplete (partial fills, and the pending-token
  estimate added to `sb.usdcOut` / `solOut`, are not a quote-vs-fill
  observation) or when no price exists. v2 `liveCloseSol` asserts
  `quoteMint === SOL` AFTER the close is counted, so a real K1 on the
  leg keeps latch priority; the breach is always in the log line.
- **A13 — N4 (fee fail-open): fail closed.** `checkFeeBps` trips K8
  (refuse + alert) on null / undefined / NaN / non-numeric input. The
  `recordClose` fee branch is consistent with one distinction: a fee
  that IS supplied but unreadable trips; an ABSENT fee (null/undefined
  = no fee observation) is skipped, not tripped — the open/swap-time
  `checkFeeBps` is the gate that sees `ROUTE_FEE_BPS` on every open and
  swap. Consequence to verify at rehearsal install: a missing
  `ROUTE_FEE_BPS` export now trips K8 on the first open/swap attempt
  (including dry/paper paths that reach `jupiterSwapLive`, where the fee
  check runs before the dry-run early return) — that is the intended
  fail-closed behaviour, surfacing a config problem loudly instead of
  silently disabling the gate.
- **A14 — N6 (corrupt state): alert-only.** An unparseable
  `halt-state.json` (or a parsed file with an unsupported version)
  fires `notifyEmergency` with criterion `halt-state-corrupt` and action
  `INFO` (new alert action whose text states opens are NOT refused).
  Nothing is refused, so a transient disk issue cannot halt the pilot
  by itself. A missing file (ENOENT) is normal on first run and does
  not alert. The alert fires during `create()` — the bot's
  `notifyEmergency` is available by then (`telegram` is required before
  the halt instance is created), and the module's `alert()` already
  swallows notify failures, so an alert failure can never break startup.
- **A15 — N9 (v2 DEFAULTS null→5): kept as-is, pending decision.** The
  v2 paper-settings hunk (`DEFAULTS.RESHAPE_MAX: null → 5`) is unchanged
  in this fix revision. It must NOT be installed on the running v2 paper
  window before Warlock Head's decision; the live trigger's own default
  (5 when unset) already covers the live side either way.

## 5. What QC should check (acceptance §3.3)

1. Read the diffs: halt check sits on the open path of both bots
   (table §1.2); thresholds are parameters (halt-params.json, §3);
   the latch cannot auto-clear on restart (HALT-file re-latch,
   simulated); `RESHAPE_MAX` is honoured per leg (§1.3).
2. Run `node test-halt-sim.js` — 16/16 PASS with evidence in
   TEST-EVIDENCE.md + `test-results.json` — **and**
   `node test-n1-wiring.js` — 14/14 PASS (N1/N14 wiring regression;
   it FAILS on pre-fix code, demonstrated with a pre-fix fixture).
   Re-run `review-runs/adversarial.js`: expect 14/18, with ONLY A5a–d
   failing — those four assert the OLD fail-open behaviour
   (`checkFeeBps(null)` → `ok:true`); post-fix N4 they correctly return
   `ok:false` + K8 trip. The re-review should update the A5
   expectations to fail-closed; do not "fix" the module back.
3. Confirm ambiguities A1/A2 with Warlock Head / Security before the
   item is DONE (A1 especially: it changes what K8 means).
4. Confirm the v2 `DEFAULTS null → 5` change does not alter the
   running v2 paper window's intended behaviour — it *activates* the
   paper freeze gate that the 23 Nov port intended but never fired
   (no `settings.json` on that tree). If the paper window is meant to
   run unlimited reshapes, this patch is wrong for paper and the cap
   must be live-only; the live trigger's own default (5 when unset)
   already covers the live side either way.
5. Verify the N1–N6 fixes against §8 (fix record): N1 conversion in
   `liveCycle` + `openUnrealisedSol` (wiring test W1–W9); N2 fallback
   chain + `priceFallback` row flag (no `recordClose` skip remains —
   grep for "accounting skipped" must find nothing); N3 pile
   subtraction + `liveCloseSol` assert (K8 gap inputs only from
   complete swap-backs); N4 fail-closed (`checkFeeBps` + `recordClose`
   branch, sim scenario 8b); N5 `reshapeFrozen` deleted (grep must find
   nothing outside REVIEW.md); N6 corrupt-state alert (sim LATCH
   scenario, alert-only).

## 6. Files delivered (all under `~/workspace/warlock-division/live-readiness/item1-halt/`)

| File | Contents |
|---|---|
| `live-halt.js` | The halt module (new, identical in both trees) |
| `halt-params-v1.json` / `halt-params-v2.json` | D-0c parameter tables (install as `halt-params.json`; differ only in `maxFeeBps`) |
| `patches/v1-*.patch` (5) / `patches/v2-*.patch` (5) | Clean unified diffs, one per file changed, verified to apply cleanly and reproduce `patched/` byte-for-byte |
| `patched/v1/` / `patched/v2/` | Full patched trees (result of applying the patches) |
| `pristine/v1/` / `pristine/v2/` | Exact pristine copies fetched read-only from the VPS (diff bases) |
| `apply-patches.py` | The script that produced `patched/` from `pristine/` (reproducibility; re-run to regenerate) |
| `test-halt-sim.js` + `test-results.json` | Simulation harness + machine-readable results (16/16; extended in the fix revision with N4 fail-closed + N6 corrupt-state assertions inside the existing K8-fee and LATCH scenarios) |
| `test-n1-wiring.js` | Wiring-level regression test for N1/N14 (14 checks; FAILS on pre-fix code, PASSES post-fix — see §8) |
| `TEST-EVIDENCE.md` | Per-criterion simulation evidence (verbatim console output) + fix-record appendix (§8) |
| `BUILD-NOTE.md` | This file |

## 8. Fix record — review close-out (REVIEW.md N1–N6 + N14), 2026-11-24

All fixes are in `live-halt.js` (root + both patched trees, byte-identical)
and in the `bot.js` wiring via `apply-patches.py` (re-run to regenerate
`patched/`; patches regenerated with `diff -u` and verified to apply
cleanly and reproduce `patched/` byte-for-byte). N7–N9 are Warlock Head
decisions, untouched. N10–N13 accepted/carried, untouched.

| Note | Fix |
|---|---|
| N1 (High) | `livePositionCycle` stamps `quoteMint: 'SOL'/'USDC'` on each `live` entry (v1:2362, v2:2642); `liveCycle` converts via new `halt.openUnrealisedSol(lives, px)` (v1:2448, v2:2916) — USDC legs ÷ SOL price, SOL legs through. Price chain: fresh `solUsd()` → `halt.lastSolUsdPx()` (persisted last-good price, new `state.lastSolUsdPx`, `noteSolUsdAt(ts, px)` now records the price; solUsd hooks pass it). No price at all → helper returns `null`, K2/K6 verdict skipped that poll (logged). See §4 A10. |
| N14 (with N1) | New `test-n1-wiring.js` (14 checks): exercises the exact function `liveCycle` calls with `lives[]` shaped as `livePositionCycle` builds them, plus static checks that both patched trees call it and no longer sum raw. A7/A7b template (W1/W2), masking direction (W3), SOL pass-through (W4), no-price null (W5), mixed legs (W6), missing-`quoteMint` null (W7), last-good persistence (W8), static wiring + module identity (W9). Demonstrated: FAILS on pre-fix code (exit 1, W0), PASSES post-fix (14/14, exit 0). |
| N2 | v1 `liveClose` (2221–2228) + v2 `finishLiveClose` (2388–2395): `recordClose` is now unconditional. Price fallback chain (A11); row flagged `row.priceFallback = true` + log line; only when no SOL price was ever seen is `pnlSol` booked as 0 (leg still counted). v2 `liveCloseSol` already recorded unconditionally — unchanged on this point. No "accounting skipped" path remains. |
| N3 | `realisedSol` subtracts `pileOutsideSol = leftoverSol + rentRefundableSol` in v1 `liveClose`, v2 `finishLiveClose`, v2 `liveCloseSol`. No gap observation on incomplete swap-back (`quotedSol`/`realisedSol` null) or with no price. v2 `liveCloseSol` asserts `quoteMint === SOL` after the close is counted (v2:2464): loud log + K8 trip (fail-closed). See §4 A12. |
| N4 | `checkFeeBps` fails closed: null/undefined/NaN/non-numeric → K8 trip (refuse + alert). `recordClose` fee branch: supplied-but-unreadable → trip; absent (null/undefined) → skipped, not tripped. See §4 A13. |
| N5 | **Deleted the export** (`reshapeFrozen` function + export entry removed from `live-halt.js`). The inline cap in `trigger()` is the only implementation. §1.3 corrected (above). |
| N6 | Unparseable `halt-state.json` (or unsupported version) fires `notifyEmergency` (`halt-state-corrupt`, action `INFO` — new alert-only action) during `create()`; nothing is refused. Missing file (ENOENT) does not alert. See §4 A14. |

Re-run results (2026-11-24, this revision): `node test-halt-sim.js`
exit 0, **16/16 PASS** (same 16 scenarios; K8-fee + LATCH scenarios
extended with N4/N6 assertions); `node test-n1-wiring.js` exit 0,
**14/14 PASS**; `node review-runs/adversarial.js` exit 1, **14/18** —
only A5a–d fail, asserting the old fail-open behaviour (see §5 item 2);
all 10 patches dry-run clean, apply clean, reproduce `patched/`
byte-for-byte; `node --check` passes on all patched `.js` files plus
root `live-halt.js`, `test-halt-sim.js`, `test-n1-wiring.js`.

- Feed-health *reporting* (metrics per check) — Item 4a.
- Alert call-site map / heartbeat / missing notify sites — Item 4a
  (dependency noted in A7).
- Patch-guard script / md5 checks — Item 5.
- v2 settings-pin procedure — Item 6.
- Any VPS write, key, wallet, live-mode flag, or rehearsal install —
  Item 2's W-1–W-12, not this item.
