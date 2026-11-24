# Item 1 — Independent Review: per-book safety-halt enforcement in code

**Reviewer:** Independent Reviewer (not the builder) · **Date:** 2026-11-24
**Scope:** `live-halt.js`, all 10 patches, `halt-params-v1/v2.json`, `test-halt-sim.js`,
`BUILD-NOTE.md`, `TEST-EVIDENCE.md`, plan §3 / §3.3, D-0c table (TRACK-RECORD-2026-11-24).
**Method:** read every line of `live-halt.js`; re-ran the builder harness myself;
re-applied every patch from `pristine/` in a scratch dir and diffed against `patched/`;
`node --check` on all patched files; verified every hook against the PRISTINE trees
(not the patches); ran 18 adversarial cases of my own design against the real module.
No VPS writes. No builder files edited (one side effect, disclosed: re-running
`test-halt-sim.js` as instructed regenerated `test-results.json` in place — 16/16,
same content shape; the builder's other files are untouched). Run outputs are in
`review-runs/` alongside this file.

## Verdicts

| Verdict | Result |
|---|---|
| **QA test** | **PASS** — builder sim re-run 16/16, exit 0; my adversarial suite 18/18, exit 0. |
| **QC verify** | **FAIL (NOT DONE)** — the halt module is sound, but its wiring into the bots has three fix-before-DONE defects (N1, N2, N3) plus two small ones (N4, N5/N6). The sims never exercised the wired path, which is how N1 escaped them. |
| **Security countersign** | **PASS WITH NOTES** — no key/chain/network/exfiltration path; latch holds; a halt never blocks exits. Countersign becomes effective when notes N4, N5, N6, N7 are closed (N4 is the only Security-owned code fix; N7 is the A1 restatement). |

**Item 1 is NOT DONE.** What remains: fix N1–N6, get Warlock Head's written decisions on
N7 (A1), N8 (A2), N9 (v2-DEFAULTS), re-run the builder sim + my adversarial suite after
the fixes (including a new wiring-level regression test for N1), and re-submit for QC/Security.
N10–N13 are accepted in writing / carried as open decisions and do not block the re-review
except as noted.

## QA verdict — PASS (with a coverage gap noted)

- Re-ran `node test-halt-sim.js` myself: **exit 0, 16/16 PASS** (full output in
  `review-runs/builder-sim-rerun.txt`). The harness exercises the real `live-halt.js`
  and the real patched trigger/settings files against real Batch 1 paper data; the
  per-criterion evidence in TEST-EVIDENCE.md matches what I observed on re-run.
- My adversarial suite (`review-runs/adversarial.js`, 18 cases, all against the real
  module): **exit 0, 18/18 PASS** — see §Adversarial cases below.
- Coverage gap (note N14): no sim exercises the `liveCycle` equity computation that
  feeds K2 — the builder sims call `checkOpen`/`recordClose` directly with hand-built
  equity figures. That is exactly the seam where the one high-severity defect (N1)
  lives. QA passes on its own evidence; the gap is a QC finding, not a QA failure.

## QC verdict — FAIL (NOT DONE)

Verified and passing (by my own reads, not the builder's claims):

- **Open-route funnel, both trees (pristine reads).** v1: scan loop (`bot.js:2395`
  pristine) and reposition `openNew` (`:2326`) both call `liveOpen`. v2: scan loop
  (`:2854`), reposition `openNew` (`:2607`), `liveManualOpen` (`:2755` via `:2732`)
  all call `liveOpen`. No other live open path exists: `liveOpenUsdcPool` is only
  called from inside `liveOpen`; `openDeposit`/`openDepositTracked` are only called
  from inside the `liveOpen` family; the other `DLMM.create` call sites are paper
  valuation/open, `liveValuation`, or `reconcileEntryCosts` (quotes only).
  `reconcileLive` (v2 only, `:2659`) adopts already-funded on-chain positions and
  refuses to adopt while STOP is present — it opens nothing.
- **Gate is first in `liveOpen`** (patched v1:2022, v2:2025): `checkGate` →
  `checkFeeBps` → `refuseOpen`, before the SL-blacklist, cooldown, TVL and
  entry-cost guards and before any chain call (`DLMM.create`, `solUsd`, swaps).
- **`liveCycle` evaluates feed/K2/K6 before scan and manual opens** (patched
  v1 block :2411–2421, v2 :2857–2868; v2 manual open is after the block at :2870).
- **Exits are not skipped by a halt.** `livePositionCycle` runs at the top of
  `liveCycle` (patched v1:2400, v2:2846), *before* the halt block; when the
  halt block returns `false` the cycle returns without opening, but positions
  were already managed that cycle. On STOP, `livePositionCycle` is still called
  with `stop=true`, which closes positions with reason `STOP file` and the
  process exits once flat (pre-existing `bot.js` behaviour, unchanged).
- **Latch.** Re-latch from the HALT file verified by sim (builder) and by my
  corrupted-state case (A3b). The module never deletes HALT/STOP. The two
  scoped auto-lifts (1st-daily NO_NEW at the CET day boundary; feed NO_NEW on
  a fresh price) are the specified exceptions and are logged.
- **Params.** `halt-params-v1.json` / `halt-params-v2.json` match the D-0c Rev 1
  table exactly on every field (fractions); derived SOL figures K1 0.375, K2 0.75,
  K4 0.50, K5 1.50, K6 0.75, daily 0.375. The two files differ only in `maxFeeBps`
  (0 vs 50) plus the `_comment` text. Verified by script
  (`review-runs/params-check.txt`).
- **v2 RESHAPE_MAX null finding — confirmed independently.** Pristine v2
  `paper-settings.js:28` has `DEFAULTS.RESHAPE_MAX: null`; `:124` FIELDS default
  is 5. `currentValues()` returns `{...DEFAULTS, ...pickAllowed(file.values)}`
  and `pickAllowed` skips nulls, so with no `settings.json` on the tree it
  returns `null`; the paper freeze gate (`bot.js:1822`,
  `Number.isFinite(policy.RESHAPE_MAX) && …`) never fires. Pristine v1 has no
  `RESHAPE_MAX` key in `paper-settings.js` at all (only variant-E
  `VARIANT_SETTINGS.E = {RESHAPE_MAX: 5}`, `bot.js:155`). Pristine live
  `trigger()` on both trees has no cap — confirmed by reading both files.
- **K5 cluster key works with the real `openedAt` format.** `now()` is
  `new Date().toISOString()` (v1:172, v2:149), so `openedAt.slice(0,16)` is
  `YYYY-MM-DDTHH:MM` — pool + entry minute, as specified. Verified by my A6/A6b
  cases (same-minute legs cluster and trip K5 at −1.68; different-minute legs
  do not).
- **Patches.** All 10 apply cleanly (`patch -p1`, dry-run exit 0 each) to
  pristine copies and reproduce `patched/` **byte-for-byte**
  (`diff -r` clean both trees). `node --check` passes on all 14 patched `.js`
  files plus root `live-halt.js` and `test-halt-sim.js`. `live-halt.js` is
  byte-identical in both patched trees and matches the root file.

Failing (see notes table): N1 (K2 unit error — high), N2 (px=0 close skip),
N3 (K8 gap pile bias), N4 (fee fail-open), N5 (dead `reshapeFrozen` + false
doc claim), N6 (corrupt state silently resets accounting).

## Security verdict — PASS WITH NOTES

Read `live-halt.js` in full plus every patched hunk in both `bot.js` files:

- **No key handling, no signing, no chain sends, no network.** The only new
  `require` in either bot is `require('./live-halt')`. `live-halt.js` requires
  only `fs`/`path`. Its only writes are `HALT`, `STOP`, `NO_NEW`,
  `halt-state.json` (atomic tmp+rename) and unlinking `NO_NEW` in the two
  specified lift cases. No `exec`/`spawn`/`child_process`, no HTTP/fetch, no
  wallet/key/secret references, no transaction construction. The only outbound
  call is the bot's own `notifyEmergency` (Telegram alert), invoked through
  the callback the bot passes in, with failures swallowed so an alert failure
  can never break a halt.
- **Latch cannot auto-clear.** Verified: `state.tripped` persists in
  `halt-state.json`; a restart reloads it; a lost/corrupt state file re-latches
  from the HALT file (my A3b). The module never deletes HALT or STOP. (Caveat:
  N6 — a corrupt state file *without* a HALT file silently restarts accounting
  from zero; the latch itself is not affected, but sub-latch history is lost.)
- **A halt never blocks exits.** Exits run through `livePositionCycle` before
  the halt block (QC section above); `liveClose`/`finishLiveClose`/
  `liveCloseSol` have no halt gate; a STOP trip unwinds through the normal
  close path. The `jupiterSwapLive` fee check refuses a *swap*, never a close
  of an open position (closes use `removeLiquidity` + swap-back; the swap-back
  fee check can refuse a swap leg, which is the pre-existing swap-back
  failure path, logged, with the position still closable — same as today).
- **Notes blocking the countersign taking effect:** N4 (fail-open fee check —
  the one Security-owned code fix), N5/N6 (hygiene), N7 (A1 restatement).
  N1–N3 are QC defects with safety consequences but are not Security
  vulnerabilities (no privilege, secret, or exfiltration angle); they still
  block DONE via QC.

## My own run results

| Check | Result |
|---|---|
| `node test-halt-sim.js` (builder harness, my re-run) | exit 0, **16/16 PASS** (`review-runs/builder-sim-rerun.txt`) |
| Patch dry-run, all 10 patches vs pristine | exit 0 each (`review-runs/patch-dryrun.txt`) |
| Patch apply in scratch + `diff -r` vs `patched/` | v1 **byte-identical**, v2 **byte-identical** (`review-runs/patch-apply-and-checks.txt`) |
| `node --check`, 14 patched `.js` + root `live-halt.js` + `test-halt-sim.js` | all OK |
| `halt-params-v1/v2.json` vs D-0c Rev 1 | exact match, all fields; derived figures as specified |
| Adversarial suite (`review-runs/adversarial.js`) | exit 0, **18/18 PASS** (`review-runs/adversarial-output.txt`) |

## Adversarial cases (my design, real `live-halt.js`)

| # | Case | Result |
|---|---|---|
| A1a | K1 just inside: leg −0.374999 SOL | PASS — no trip |
| A1b | K1 exactly at boundary: leg −0.375 SOL | PASS — trips STOP, criterion K1 |
| A2 | K4 loss run broken by a zero-PnL leg, then a fresh 5-loss run | PASS — trips K4 on the second run only |
| A2b | Zero-PnL leg resets the loss run (4 losses + 0) | PASS — `consecLosses` 0, no trip |
| A3a/b | Restart with `halt-state.json` **corrupted** (not deleted) + HALT present | PASS — re-latches from HALT file, opens refused, criterion K1 recovered |
| A3c | Corrupted state, no HALT file | PASS — no false latch; accounting restarts fresh (see N6) |
| A4a/b/c | Feed stale at exactly the 2-poll boundary (600 s) vs 601 s | PASS — 600 s is NOT stale (strict `>` matches "older than 2 polls"), 601 s is stale, `refuseOpen` passes at exactly 600 s |
| A5a–d | `checkFeeBps(null / undefined / NaN / "abc")` | PASS as a probe — all return `ok:true` (this is finding N4, fail-open) |
| A6 | K5: 3 clusters × 2 legs of −0.28 SOL, same pool + same minute, wins interleaved | PASS — trips K5, worst-3 −1.68 < −1.50 |
| A6b | K5: same pool, 6 legs in 6 different minutes | PASS — no K5 trip |
| A7 | K2 wiring: a −$1 unrealised wobble on a USDC leg fed raw as `pnlSol` | PASS as a demonstration — `checkOpen` trips K2 (equity 4.0, "drawdown 1.0000 SOL > 0.75 SOL"). This is finding N1. |
| A7b | Same −$1 move correctly converted (−0.0133 SOL at $75) | PASS — no trip |

## Coordinator findings — verified independently

- **(a) `reshapeFrozen` dead code — CONFIRMED.** It is exported from `live-halt.js`
  (`:454`, exported `:480`) and called nowhere — not in either patched `bot.js`,
  not in either patched `live-reshape-exec.js`, not in the harness. The live
  trigger implements the cap inline
  (`Number.isFinite(settings.RESHAPE_MAX) ? settings.RESHAPE_MAX : 5`).
  BUILD-NOTE §1.3 ("`live-reshape-exec.trigger()` calls this") is wrong. Note
  the inline version and `reshapeFrozen` differ on non-finite input: inline
  defaults to 5, `reshapeFrozen` returns `false` (no cap) — so nobody must
  "fix" the trigger by wiring in `reshapeFrozen` without reconciling that.
  (N5.)
- **(b) `checkFeeBps` fail-open — CONFIRMED.** `live-halt.js`:
  `if (bps == null || !Number.isFinite(+bps)) return { ok: true }`. So
  `null`, `undefined`, `NaN` and non-numeric strings all pass. `ROUTE_FEE_BPS`
  comes from `swap-route-config.js` (required at `bot.js:50` v1 / `:58` v2);
  that file is not in the pristine subset, so I could not verify its export
  shape — the fail-open matters exactly if that export is ever undefined
  (upstream re-add under a different key, replaced file). The `recordClose`
  fee branch guards with `Number.isFinite` too, but it only skips the check
  rather than passing a swap. (N4.)
- **(c) px=0 close skip — CONFIRMED.** Patched v1 `liveClose` and v2
  `finishLiveClose` both do `if (pxHalt > 0) halt.recordClose(…)` else log
  `"CLOSE halt accounting skipped: no SOL/USD price (px=0)"`. `solUsd()`
  returns 0 only when both CoinGecko and DexScreener fail and no cached price
  survives (60 s cache) — possible during the known ~90/hr 429 storms. A
  skipped leg is invisible to K1/K3–K7, is not counted in `closedLegs`, and
  its PnL never enters `netSol`/`dayNetSol`, so K2/K6 computed from that state
  are wrong thereafter; the history row is still written, so the books and
  the halt state silently diverge. v2 `liveCloseSol` has no such skip
  (native-SOL PnL, `recordClose` unconditional) — the asymmetry is itself a
  finding. (N2.)
- **(d) K8 gap units — CONFIRMED consistent on conversion, with a bias
  finding.** `liveValuation().value` is in quote units (USDC for USDC pools,
  SOL for SOL pools; v1 and v2 identical). The patched closes convert both
  sides to SOL-equivalents: USDC pools `quotedSol = v.value / pxHalt`,
  `realisedSol = sb.usdcOut / pxHalt`; SOL pools `quotedSol = v.value`,
  `realisedSol = sb.usdcOut / pxHalt` (USDC-path) or `solOut` (v2 SOL-path).
  The conversions are consistent. BUT `realised` includes pile components
  that `quoted` excludes: the swap-back sells the whole SOL pile
  (`leftoverSol` reserve + `receivedSol`, which includes refunded rent) while
  `v.value` is the position only. So `gap = |quoted − realised|` carries a
  systematic positive bias of `leftoverSol + rent refund − close fees`
  (size unquantified from this subset — `paperCap.allocateOpenSol` is not
  in the pristine copies; the gas-buffer reserve is the unknown). Against a
  0.0625 SOL threshold, a bias in the 0.02–0.05 SOL range plus real slippage
  could false-trip K8 on two consecutive exits. Also: v2 `liveCloseSol` is
  safe on units only because `capitalAsset === 'SOL'` implies
  `quoteMint === SOL` in the live path (v2 `liveOpen` sets both together and
  `solMode` rejects non-SOL pools via `liveCapital.skipPoolReason`) — that
  implication is nowhere asserted in the patched close code. (N3.)

## Notes table

| # | Severity | Note | Owner | Close-out |
|---|---|---|---|---|
| N1 | **High** | **K2 open-unrealised is unit-wrong for USDC-pool legs.** Patched `liveCycle` (v1:2418, v2:2865) computes `openUnrealised = Σ lives[].pnlSol` and `equity = bookSol + netSol + openUnrealised`, treating it as SOL. But pristine `livePositionCycle` sets `pnlSol = v.value − depositSol` (v1:2310, v2 equivalent), and for a USDC-quoted pool both terms are USDC: `liveOpenUsdcPool` sets `depositSol = pl.depositQuote` (USDC, e.g. ~90) and `v.value` is USDC. So a −$1 unrealised wobble reads as −1 "SOL" and K2 false-trips (demonstrated A7: equity 4.0 → "drawdown 1.0000 SOL > 0.75"); a +$5 win reads as +5 SOL and masks real drawdown. K2 is therefore wrong in both directions whenever a USDC-pool leg is open, and correct only for SOL-pool legs. Fix: normalise by `quoteMint` (divide USDC-pool `pnlSol` by the SOL price — `live.pnlUsd` from the exit decision is already USD-denominated — or compute open unrealised in SOL at the source), and add a wiring-level regression test (N14). | Engineering | **Fix before DONE** |
| N2 | **Medium-High** | **px=0 close skip blinds the halt.** v1 `liveClose` + v2 `finishLiveClose` skip `recordClose` entirely when no SOL/USD price is available at close (see coordinator finding (c)). That leg becomes invisible to K1/K3–K7 and corrupts `closedLegs`/`netSol`/`dayNetSol` (hence K2/K6) thereafter, while the history row is still written — books and halt state diverge silently. Fix: never skip accounting — fall back to the last-good SOL price (or the close's own valuation price) and flag the row as price-fallback, so the leg is always counted. v2 `liveCloseSol` already records unconditionally; make the USDC paths match. | Engineering | **Fix before DONE** |
| N3 | **Medium** | **K8 gap has a systematic pile bias.** `realisedSol` includes `leftoverSol` + rent refund that `quotedSol` excludes (see coordinator finding (d)); the 0.0625 SOL threshold is tight against that bias. Fix: compare like with like — subtract the pile components from `realisedSol` (or add them to `quotedSol`) and assert `quoteMint === SOL` on the `liveCloseSol` path. Cannot be measured on the rehearsal clone (paper never runs `liveClose`), so this must be fixed by code reasoning now, not deferred to Item 2. | Engineering | **Fix before DONE** |
| N4 | **Medium (narrow)** | **`checkFeeBps` fails open on null/non-numeric input** (see coordinator finding (b)). A missing/renamed `ROUTE_FEE_BPS` export would silently disable the K8 fee gate on opens and swaps. Fix: fail closed — treat null/non-numeric as a trip (refuse + alert), since a safety gate that cannot read its input must not pass trades. | Engineering | **Fix before DONE** (Security-owned) |
| N5 | **Low** | **`reshapeFrozen` is dead code; BUILD-NOTE §1.3 misdescribes it** (see coordinator finding (a)). The inline cap in `trigger()` is what runs, with different null-handling from `reshapeFrozen`. Fix: delete the export or wire it in with reconciled null-handling, and correct §1.3. Trivial. | Engineering | **Fix before DONE** |
| N6 | **Medium** | **Corrupt `halt-state.json` silently restarts accounting from zero** when no HALT file exists (my A3c: `closedLegs` 0, `netSol` 0, no alert — only a log line "starting fresh (halt latch NOT assumed)"). The latch itself survives via HALT, but K2/K6/K7 history is lost without anyone being told. Fix: alert (via `notifyEmergency`) on an unparseable state file; keep refusing nothing — alert-only, so a transient disk issue cannot halt the pilot by itself. | Engineering | **Fix before DONE** |
| N7 | **Open decision** | **A1 — K8 "STOP absent while live"** (see Adjudication below). The literal D-0c wording cannot stand. | **Warlock Head** | **Open decision — blocks DONE until D-0c is restated in writing** |
| N8 | **Open decision** | **A2 — K5 bar reachability** (see Adjudication below). Mechanism verified correct; whether the −1.50 bar is the intended bar given K1 subsumption is a parameter decision. | **Warlock Head** | **Open decision — blocks DONE until confirmed in writing** |
| N9 | **Open decision** | **v2 DEFAULTS null→5** (see Adjudication below). Patch matches FIELDS/D-0c but activates the paper freeze gate; must not be installed on the running v2 paper window mid-window without a decision. | **Warlock Head** | **Open decision — blocks DONE until confirmed in writing** |
| N10 | **Low-Medium** | **v1 §3.1.7 "flagged in the alert" half is not built.** v1 `liveClose` has no Telegram call site (OPEN-4, acknowledged in A7); the on-chain-estimate flag is stamped on the row + log only. The content is complete for Item 4a to pick up, but plan §3.1.7 as written is only half-met on v1 until 4a lands. | Item 4a (Engineering) | **Accept in writing** — carried as a 4a dependency, not a fix for this item |
| N11 | **Low** | **K2/K6 are evaluated after position management in the cycle.** A reposition `openNew` inside `livePositionCycle` can open before that cycle's `liveCycle` halt block evaluates K2/K6 (one poll of delay; the `liveOpen` gate still checks latch/STOP/NO_NEW/feed). Reposition opens add no new capital (same leg's proceeds), so exposure does not increase; accepted as ordering, flagged for the record. | Engineering | **Accept in writing** |
| N12 | **Low** | **`HALT_*` env vars override the JSON table** (including e.g. `HALT_K1LEGLOSSPCT`), so an env var can neuter a criterion. Deliberate operator control per the design, but wider than the JSON file. Go-live runbook must record the effective env at start. | Engineering (runbook) | **Accept in writing** |
| N13 | **Open decision** | **K1 sits beyond the worst known cliff** (−0.375 vs worst known −0.349/−0.3639 scaled; TEST-EVIDENCE finding 1). The mechanism is correct; the number is sole's call at finalisation, already recorded as open in the D-0c table. | **sole** | **Carried — does not block this item's mechanism** |
| N14 | **Medium** | **Sim coverage gap: no test of the wired K2 path.** The builder sims call `checkOpen`/`recordClose` directly; nothing tests `liveCycle`'s equity computation from `lives[].pnlSol`. That is how N1 escaped 16/16 green. Close-out of N1 must include a wiring-level regression test (my A7/A7b are a template). | Engineering / QA | **Fix before DONE** (with N1) |

## Adjudications

### A1 — K8 "STOP absent while live": literal reading REFUSED; builder's reading accepted with a restatement condition

The D-0c wording, read literally, would trip K8 on every legitimate live trade: a
live instance normally runs with STOP absent, so "STOP absent while live" as a trip
condition is self-defeating — it would halt all live trading by design, and it
contradicts the plan's own rehearsal flow (which runs live-mode code paths with
STOP absent once the lock is lifted). No code can implement it literally and still
have a pilot. **I refuse the literal reading.**

The implemented gate-state check (trip when `LIVE_CONFIRMED=1` while `PAPER=1` or
`DRY_RUN=1`, plus defence-in-depth refusal of an open while STOP is present) is the
only workable reading of the K8 mode limb, and it is the correct *kind* of check
(contradictory mode flags are exactly the "trade executed outside the paper/live
gate state" case). **I accept the implemented checks as the K8 mode check.**

But acceptance is conditional: the literal wording must not survive into the
go-live runbook or a future D-0c revision, or a later reader will "fix" the code
to trip always. **Open question for Warlock Head (N7): restate K8-mode in D-0c
Rev 2, explicitly deleting "STOP absent while live" (or defining, in one sentence,
what state it was meant to describe), before Item 1 is DONE.** This is a
Warlock Head decision, not mine — I am ruling on the code reading, not rewriting
the parameter table.

### A2 — K5 cluster definition: mechanism ACCEPTED as specified; the bar is Warlock Head's call

The implementation follows the stated definition faithfully: cluster = pool +
entry minute (Extension B's event definition), worst-3 = three most-negative
cluster totals, trip when the sum < −30% of book. My A6/A6b cases prove the
mechanism works exactly as specified, including the multi-leg-cluster path.

The reachability finding is real and I confirm it: with single-leg clusters the
worst-3 sum without tripping K1 is at most 3 × 0.375 = 1.125 SOL < the 1.50 bar,
so K5 can only trip via multi-leg clusters (e.g. a reposition re-entering the
same pool in the same entry minute). That makes K5 a narrow, second-order trip
— but it is *specified* that way, and the mechanism is demonstrated. This is a
parameter question, not a code defect: **the mechanism is accepted as specified.
Open question for Warlock Head (N8): confirm the −1.50 bar stands (accepting K5
as a multi-leg-cluster-only trip) or restate the bar/definition — in writing,
before Item 1 is DONE.**

### v2 DEFAULTS null→5: patch CORRECT as written for live; paper application needs Warlock Head's decision

Verified facts: pristine v2 returns `null` from `currentValues()` with no
`settings.json`, so the paper freeze gate never fired — the 23 Nov port set the
FIELDS default to 5 but left DEFAULTS null. The patch (DEFAULTS null→5) aligns
DEFAULTS with the FIELDS default, with the port's own comment ("Warlock v1 Book E
= 5"), and with the D-0c `reshapeMax: 5`. On that evidence the port's null looks
like an oversight, not an intended policy — **the patch is correct as written**.

Two qualifications. First, the live cap does not depend on this change: the live
`trigger()` defaults to 5 when the setting is unset, and patched `CFG.RESHAPE_MAX`
defaults to 5 — so even if the paper-settings change were reverted, live safety
is unchanged. Second, the change *does* alter paper behaviour if installed on
the running v2 paper window (the freeze gate would start firing mid-window, to
30 Nov), and the plan forbids touching running paper windows. **Open question
for Warlock Head (N9): confirm the v2 paper window's intended reshape policy —
capped at 5 (patch stands, install only after the window closes) or unlimited
(patch must be scoped live-only: revert the paper-settings hunk and rely on the
trigger default). Do not install this hunk on the running v2 paper instance
before that decision.**

## Final line

**Item 1 is NOT DONE.** QA PASS, QC FAIL, Security PASS WITH NOTES. Remaining:
fix N1–N6 (+N14 regression test with N1), Warlock Head's written decisions on N7
(A1 restatement), N8 (A2 bar), N9 (v2-DEFAULTS scope), then re-run the builder sim
and the adversarial suite and re-submit for QC verify and Security countersign.
N10–N13 are accepted/carried as recorded above.

## §7 — Close-out re-review (2026-11-24, independent re-reviewer — NOT the builder)

**Scope:** verify the builder's §8 fix record for N1–N6 + N14 by my own runs and
read-backs, not by trusting the builder's report or the coordinator's verification.
I re-ran every harness myself, re-read the fixed code at the claimed sites in
`live-halt.js` and both patched `bot.js` trees, re-applied all 10 patches from
`pristine/` in my own scratch dir (`/tmp/closeout-repro`, not the builder's or
the coordinator's), and updated the A5 adversarial expectations to fail-closed.
No builder file edited. One disclosed side effect, same as the original review:
re-running `test-halt-sim.js` as instructed regenerated `test-results.json` in
place — 16/16, same shape (16 scenarios, same names; new timestamp
2026-11-24T17:46:47Z). No VPS writes, no key material, no live-mode flag set
(the only `LIVE_CONFIRMED` mentions are the K8 gate-check logic itself).

### My own run results

| Check | Result | Output file |
|---|---|---|
| `node test-halt-sim.js` (my re-run) | exit 0, **16/16 PASS** | `review-runs/closeout-sim-rerun.txt` |
| `node test-n1-wiring.js` (my re-run) | exit 0, **14/14 PASS** | `review-runs/closeout-n1-rerun.txt` |
| `test-n1-wiring.js` on pre-fix code (W0 claim) | exit 1, **0/1, W0 FAIL** — reproduced with my own fixture built from the reviewer's pre-fix trees in `review-runs/scratch/` (fail-open `checkFeeBps`, `reshapeFrozen` present, no `openUnrealisedSol` function) | `review-runs/closeout-n1-prefix.txt` |
| `node review-runs/adversarial.js` BEFORE A5 update | exit 1, **14/18** — only A5a–d fail, as the builder predicted | `review-runs/closeout-adversarial-pre.txt` |
| `node review-runs/adversarial.js` AFTER A5 update | exit 0, **18/18 PASS** | `review-runs/closeout-adversarial-post.txt` |
| `node --check`, root `live-halt.js` + 2 test files + 14 patched `.js` | **17/17 OK** | `review-runs/closeout-node-check.txt` |
| Patch dry-run, all 10 patches vs pristine (my scratch) | exit 0 each | `review-runs/closeout-patch-dryrun.txt` |
| Patch apply in my scratch + `diff -r` vs `patched/` | v1 **byte-identical**, v2 **byte-identical**; root `live-halt.js` identical in both patched trees | `review-runs/closeout-patch-apply.txt` |
| `halt-params-v1/v2.json` vs D-0c Rev 1 | exact match, all fields; differ only in `maxFeeBps` (0 vs 50) | `review-runs/closeout-params-check.txt` |
| N6 direct probe (corrupt state, no HALT) | post-fix: exactly 1 `halt-state-corrupt` alert, action `INFO`, not halted; pre-fix scratch: 0 alerts | `review-runs/closeout-n6-probe.txt` |

### Per-note verdicts (my evidence)

- **N1 — CLOSED.** Read the fix sites myself: `livePositionCycle` stamps
  `quoteMint: state.position.quoteMint === USDC ? 'USDC' : 'SOL'` on each
  `live` entry (patched v1:2362, v2:2642); `liveCycle` converts via
  `halt.openUnrealisedSol(lives, pxHalt)` (v1:2448, v2:2916) with the price
  chain fresh `solUsd()` → `halt.lastSolUsdPx()` (persisted last-good price;
  `solUsd` hooks v1:260/265, v2:247/252 pass the price to
  `noteSolUsdAt(ts, px)`), and skips the K2/K6 verdict that poll (logged)
  when no price exists at all. `openUnrealisedSol` itself
  (`live-halt.js:395`) divides USDC legs, passes SOL legs through, and
  returns `null` on a USDC leg with no price or an entry with no
  `quoteMint`. The wiring test passes 14/14 including both masking
  directions (W1/W3 + controls), and I reproduced its W0 failure on
  pre-fix code (exit 1, 0/1) with my own fixture — the test would have
  caught N1.
- **N2 — CLOSED.** `recordClose` is now unconditional in v1 `liveClose`
  and v2 `finishLiveClose` (inside `if (!opts.intermediate)` only — the
  intermediate-leg exclusion is the specified behaviour, final close
  carries the PnL). Read the fallback chain at both sites: fresh
  `solUsd()` → `halt.lastSolUsdPx()` → only when no SOL price was ever
  seen is `pnlSol` booked as 0, leg still counted, row flagged
  `priceFallback` (also flagged when the price is older than the 60 s
  cache window). Grep for `"accounting skipped"` finds nothing in any
  code file. Residual, as specified in A11 and disclosed, not hidden: a
  leg closed with no price ever seen books PnL 0 — counted everywhere,
  magnitude 0, loudly logged.
- **N3 — CLOSED.** `pileOutsideSol = leftoverSol + rentRefundableSol` is
  subtracted from `realisedSol` at all three close sites (v1 `liveClose`,
  v2 `finishLiveClose`, v2 `liveCloseSol`), and the gap observation is
  `null` when the swap-back is incomplete or no price exists. v2
  `liveCloseSol` asserts `quoteMint === SOL` AFTER `recordClose`, so a
  real K1 on the leg keeps latch priority; the breach trips K8 and is
  always in the log line. Residuals as stated in A12: close fees inside
  `receivedSol` stay in (shrinks the gap — the safe direction) and
  execution-price noise on the pile sale remains (small).
- **N4 — CLOSED.** `checkFeeBps` (`live-halt.js`) now trips K8 (refuse +
  alert) on null/undefined/NaN/non-numeric input — verified by the
  updated A5a–d (each returns `ok:false`, criterion K8, action STOP,
  instance halted, alert captured) and by the sim's extended K8-fee
  scenario (8b). Call sites unchanged and present: `liveOpen` gate
  (v1:2031, v2:2034) and `jupiterSwapLive` (v1:2333, v2:2575). The
  `recordClose` fee branch distinction is as specified in A13 and I
  accept it as specified: a fee that IS supplied but unreadable trips;
  an ABSENT fee is skipped, not tripped — the open/swap-time gate is
  what sees `ROUTE_FEE_BPS` on every open and swap.
- **N5 — CLOSED.** `reshapeFrozen` is gone: grep over `live-halt.js`,
  `patched/`, `pristine/`, both test files and the adversarial suite
  finds nothing in code (only the historical mentions in BUILD-NOTE /
  TEST-EVIDENCE prose). BUILD-NOTE §1.3 is corrected in place — the
  inline cap in `trigger()` is stated as the only implementation.
- **N6 — CLOSED.** An unparseable `halt-state.json` (or unsupported
  version) fires `notifyEmergency` with criterion `halt-state-corrupt`
  and action `INFO` during `create()` (`live-halt.js:179/184`); a missing
  file (ENOENT) does not alert; nothing is refused. Verified three ways:
  the sim's extended LATCH scenario asserts the alert; my direct probe
  against the real module (post-fix: 1 alert, INFO, `halted=false`;
  pre-fix scratch: 0 alerts); and the adversarial A3c case still passes
  (no false latch, accounting restarts fresh).
- **N14 — CLOSED.** The wiring-level regression test exists
  (`test-n1-wiring.js`, 14/14 on my re-run) and I demonstrated it fails
  on pre-fix code (W0, exit 1, 0/1) using a fixture I built myself from
  the reviewer's pre-fix `review-runs/scratch/` trees — it exercises the
  exact function `liveCycle` calls with `lives[]` shaped as
  `livePositionCycle` builds them, plus static checks that both patched
  trees call it and no longer sum raw.

### A5 inversion handling

The adversarial suite's A5a–d asserted the OLD fail-open behaviour
(`checkFeeBps(null/undefined/NaN/"abc") → ok:true`), which N4 deliberately
removed. Before my update the suite ran 14/18 with only A5a–d failing —
exactly the builder's predicted result, confirming the inversion rather
than a regression. I updated the A5 block in `review-runs/adversarial.js`
(review-side file, mine to edit; no builder file touched) to assert
fail-closed: each probe now uses its own fresh instance (a trip latches,
so sharing one instance would weaken the per-case assertions) and checks
`ok:false` + criterion K8 + action STOP + instance halted + alert
captured. The original expectations are preserved in the file as a
comment recording the inversion. Re-run: **18/18 PASS, exit 0**. All
other 14 cases pass unchanged, including A3b/A3c and A7/A7b.

### N7–N9 / N10–N13 status — confirmed untouched, still open

- **N7 (A1 restatement), N8 (K5 bar), N9 (v2 DEFAULTS scope): UNTOUCHED
  and STILL OPEN.** No decision text exists anywhere in the item files:
  BUILD-NOTE §8 states "N7–N9 are Warlock Head decisions, untouched" and
  §4 A15 states the v2 hunk is "kept as-is, pending decision". I verified
  the v2 `DEFAULTS null→5` hunk in
  `patches/v2-paper-settings.js.patch` is unchanged from the original
  review — a single hunk at `paper-settings.js:28`, context matching
  pristine, FIELDS default 5 at `:124` untouched — and the patched v2
  tree carries exactly that hunk. No D-0c restatement was attempted; I do
  not decide them.
- **N10–N13: UNTOUCHED, carried as recorded.** v1 still has zero
  `liveNotifyClose` call sites (N10, Item 4a dependency); the `HALT_*`
  env override is still present in `live-halt.js` (N12, accepted design);
  K1/K5 bars are unchanged (params match D-0c Rev 1 exactly — N8/N13).

### Close-out verdicts

| Verdict | Result |
|---|---|
| **QA test** | **PASS** — builder sim re-run 16/16, wiring test 14/14, adversarial suite 18/18 after the A5 fail-closed update. |
| **QC verify** | **PASS** — N1–N6 and N14 all CLOSED on my own evidence above. |
| **Security countersign** | **PASS WITH NOTES — countersign now effective except for N7.** The original countersign was conditioned on N4, N5, N6, N7 closing; N4, N5, N6 are closed by this re-review, so only N7 (the A1 restatement, a Warlock Head decision) still gates effectiveness. No new key/chain/network/exfiltration path was introduced by the fixes; the N4 fail-closed change and the N6 alert-only change are the only Security-relevant behaviour changes and both are as specified. |

**Item 1 is DONE, pending only the Warlock Head decisions N7 (A1 restatement),
N8 (K5 bar), and N9 (v2 DEFAULTS scope).** All fix-before-DONE defects
(N1–N6 + N14) are closed with independent evidence. Nothing in this
re-review authorises installing the patches on any running instance: the N9
decision still governs whether the v2 paper-settings hunk may be installed
(only after the running v2 paper window closes, if confirmed), and install
itself remains Item 2's W-1–W-12 scope.
