# Item 1 — Test Evidence (simulated trips, paper data)

**Harness:** `test-halt-sim.js` (run with `node test-halt-sim.js`, exit 0 = all pass).
It exercises the REAL `live-halt.js` and the REAL patched `live-reshape-exec.js`
/ `paper-settings.js` — no mocks of the halt logic itself (only the Telegram
send is stubbed, capturing the alert payloads; the filesystem is a fresh
temp dir per scenario).

**Paper data:** Batch 1 windows,
`~/workspace/warlock-division/research/batch1-data-2026-11-20/history_{A,B7,D,E}.csv`
($500 legs, SOL ~$72–75, 19–20 Nov 2026). Pilot legs are 1.25 SOL, so each
paper leg is scaled by `1.25 / legSolPaper`, where `legSolPaper` is the
deposit in SOL (`deposit_quote` directly for SOL-quoted pools, `deposit_quote
/ sol_usd` for USDC pools). Every scenario states what is real paper data
and what is synthetic extension. A criterion that does not refuse on
simulation would be a FAIL (plan §3.3) — none did.

**Result: 16/16 scenarios PASS, 0 FAIL.**

## Full console output (verbatim, run 2026-11-24 ~17:52 CET)

```
PASS  P0 parameters derive D-0c Rev 1 figures from fractions
      derived: k1=0.375 k2=0.75 k4=0.5 k5=1.5 k6=0.75 daily=0.375 SOL
      expected: k1=0.375 k2=0.75 k4=0.50 k5=1.50 k6=0.75 daily=0.375 SOL
      params source: halt-params.json in scenario dir (D-0c table); code default is the same Rev 1 table
PASS  K1 single leg <= -30% of leg trips STOP
      seed (real paper): B7 DCTY-USDC emergency_stop -139.29186902862625 USD -> -0.3639 SOL scaled (leg 1.25 SOL); limit -0.375 SOL
      worst known cliff scaled: NO trip (correct — K1 sits beyond the worst known cliff by design)
      synthetic leg -0.40 SOL (worst known +15%): TRIP K1; refuseOpen={"ok":false,"reason":"halt latched: K1","criterion":"K1","action":"STOP"}
      HALT file: {"criterion":"K1","action":"STOP","at":"2026-11-24T16:51:52.196Z","figures":{"pnlSol":-0.4,"legSol":1.25,"limitSol":0.375,"pool":"DmACYGgeSHEAyPrHERcRdHP3hFGMgSBdNE5Y4CXfQg7i","reason":"emergency_stop"},"bot":"v1","bookSol":5}; STOP present=true; alert captured=2 (criterion in Alasan line: "HALT K1: {"pnlSol":-0.4,"legSol":1.25,"limitSol":0.375,"pool":"DmACYGgeSHEAyPrHERcRdHP3hFG")
      log line: "HALT TRIP K1 action=STOP figures={"pnlSol":-0.4,"legSol":1.25,"limitSol":0.375,"pool":"DmACYGgeSHEAyPrHERcRdHP3hFGMgSBdNE5Y4CXfQg7i","reason":"emergency_stop"} — STOP written, new opens refused (latched)"
PASS  K2 drawdown > 15% of book trips STOP
      seed (real paper): B7 window 10 legs scaled, net -0.5287 SOL; + synthetic -0.30 SOL leg -> net -0.8287 SOL
      checkOpen(equitySol=4.1713): drawdown 0.8287 SOL > 0.75 SOL -> {"ok":false,"reason":"K2 drawdown 0.8287 SOL > 0.75 SOL","criterion":"K2","action":"STOP"}
      HALT file criterion=K2; STOP present=true; alerts=2
PASS  K3 three consecutive emergency stops trips STOP
      seed (real paper, three books, same STANK event 19 Nov 17:45 WIB): B7 DCTY -0.3639 SOL, B7 STANK -0.2928 SOL, E STANK -0.2698 SOL — consecutiveness is synthetic (different books), the stops are real
      consecEmergency=3; HALT criterion=K3; alerts=2
      note: no K1 trip on these legs (all > -0.375 SOL) — K3 isolated
PASS  K4 five consecutive losses totalling < -10% of book trips STOP
      seed (real paper): B7 3-leg run -0.048, -0.364, -0.293 + A losses -0.001, -0.048
      5-leg sum -0.7542 SOL < -0.50 SOL -> TRIP K4; consecLosses=5; HALT criterion=K4
PASS  K5 worst-3 entry clusters combined < -30% of book trips STOP
      seed (real paper): B7 worst-3 single-leg clusters DCTY -0.364, STANK -0.293, :3 -0.049 SOL; real sum -0.7045 SOL — far below the -1.50 bar, so NO real paper window trips K5 at pilot scale
      reachability finding: with single-leg clusters the worst-3 sum without tripping K1 is at most 3 x 0.375 = 1.125 SOL < 1.50 — K1 subsumes K5 unless clusters hold multiple legs (e.g. a reposition re-entering the same pool in the same minute)
      demo: 3 clusters x 2 legs of -0.28 SOL (under the K1 tripwire), +0.01 wins interleaved, one leg per CET day -> worst-3 sum -1.68 SOL < -1.50 -> TRIP K5; HALT criterion=K5; figures={"worst3SumSol":-1.68,"limitSol":-1.5,"worst3":[-0.56,-0.56,-0.56]}
      K4/K7 silent by construction (loss run never exceeds 1; no day under -0.375); K2 not evaluated by recordClose
PASS  K6 net < -15% of book after 30 closed legs trips STOP
      seed: B7 10 legs over days 1-2 (day nets -0.196 / -0.329 — no daily breach) + 20 synthetic -0.013 SOL legs day 3 (day net -0.26, no breach)
      closedLegs=30, netSol=-0.7887 SOL < -0.75 -> TRIP K6; HALT criterion=K6
      no other criterion fired first: K1 worst leg -0.364 > -0.375, K3 max 2 consecutive emergency stops, K4 longest loss run 2, K7 no day breached
PASS  K6 net < -15% of book at the 7-day close trips STOP
      pilotStartAt rewound 8 days (restart simulation); net -0.80 SOL, 12 legs, open unrealised +0.10 SOL
      checkOpen(equitySol=4.30) -> {"ok":false,"reason":"K6 net -0.8000 SOL < -0.75 SOL at 7-day close","criterion":"K6","action":"STOP"}; HALT criterion=K6
PASS  K7 daily-loss breaker: 1st breach NO_NEW rest of day, 2nd breach STOP
      seed (real paper): B7 window day net -0.5287 SOL <= -0.375 SOL -> breach 1: NO_NEW written (present after day 1: true), refuseOpen={"ok":false,"reason":"NO_NEW file present"}
      day 2 (synthetic, -0.40 SOL): breach 2 -> TRIP K7 STOP; HALT criterion=K7; dayBreaches=2
      day-1 NO_NEW was lifted at the CET day boundary (daily pause is day-scoped, not latched); alerts captured=2 (1st NO_NEW alert + STOP alert)
PASS  K8 quote-vs-fill gap > 0.0625 SOL/leg on 2 consecutive exits trips STOP
      gap is a live-only quantity (paper has no fills): exit 1 gap 0.080 SOL -> consecGap=1, no trip; exit 2 gap 0.090 SOL -> TRIP K8
      HALT figures={"gapSol":0.09,"limitSol":0.0625,"consecGap":2,"pool":"P2"}
PASS  K8 fee at execution: v1 any fee > 0 bps trips; v2 50 bps ok, 51 bps trips
      v1 checkFeeBps(50) -> {"ok":false,"reason":"K8 fee 50 bps > 0 bps (open)","criterion":"K8","action":"STOP"} (patched fee is 0 bps; a restored 50 bps upstream fee trips before any swap is sent)
      v2 checkFeeBps(50) -> ok (disclosed 50 bps); checkFeeBps(51) -> {"ok":false,"reason":"K8 fee 51 bps > 50 bps (open)","criterion":"K8","action":"STOP"}
PASS  K8 gate state: LIVE_CONFIRMED=1 while PAPER=1 trips; clean live gate passes
      checkGate({paper:true, liveConfirmed:true}) -> {"ok":false,"reason":"K8 gate state: LIVE_CONFIRMED=1 while PAPER/DRY_RUN=1","criterion":"K8","action":"STOP"}
      checkGate({paper:false, dryRun:false, liveConfirmed:true}) -> ok
      note: "STOP absent while live" is NOT implemented literally — see BUILD-NOTE.md ambiguity A1
PASS  NEGATIVE full real Book E window (13 legs, net positive) — no halt, opens proceed
      seed (real paper): Book E 13 legs scaled, net 0.0636 SOL, worst leg -0.2698 SOL, 1 emergency stop (not 3), longest loss run 1
      refuseOpen={"ok":true}; checkOpen(equitySol=5.0636)={"ok":true}
      files: HALT=false STOP=false NO_NEW=false; alerts=0; log HALT lines=0
      counter-check: replaying real B7 alone DOES trip K7-daily (day net -0.5287 SOL <= -0.375) — a true trip, not a false one (see K7 scenario)
PASS  LATCH restart never auto-clears; HALT file alone re-latches
      after K1 trip, a +0.50 SOL win: refuseOpen still refuses (figures improving does not clear the latch)
      simulated restart (new instance, same dir): still refused, tripped=K1
      halt-state.json deleted, HALT file kept: new instance re-latches from HALT file (recoveredFromHaltFile) and refuses; log: "halt: HALT file present without state — re-latched trip K1"
      manual reset path (not automated): sole removes HALT + STOP after review — the module never deletes them itself
PASS  FEED stale feed refuses opens; 3 stale polls -> feed-degraded NO_NEW; fresh price lifts it
      last good SOL/USD + scan 15 min ago (> 2 polls / 10 min): refuseOpen={"ok":false,"reason":"feed-stale: no new opens (SOL/USD age 900s, scan age 900s)","criterion":"feed-stale","action":"NO_NEW"}
      checkFeed x3 stale polls: NO_NEW written=true; feed-degraded alert captured=true; log: "halt: feed stale 3 consecutive polls — feed-degraded alert + NO_NEW until a fresh price arrives"
      fresh price + scan: feed NO_NEW lifted, refuseOpen ok again (NO_NEW file present=false)
      note: exits are NOT blocked by a stale feed (they use the quote -> 10-poll on-chain-estimate order and are flagged); only new opens are refused
PASS  RESHAPE_MAX per-leg cap of 5 enforced by the live trigger; settings honour it
      v1 trigger reshapes 0..6 (down=5, N=5, MAX=5): 0:due 1:due 2:due 3:due 4:due 5:CAPPED 6:CAPPED -> cap enforced
      v1 explicit RESHAPE_MAX=3, reshapes=3: CAPPED (setting honoured)
      v2 trigger reshapes 0..6 (down=5, N=5, MAX=5): 0:due 1:due 2:due 3:due 4:due 5:CAPPED 6:CAPPED -> cap enforced
      v2 explicit RESHAPE_MAX=3, reshapes=3: CAPPED (setting honoured)
      v1 patched currentValues().RESHAPE_MAX=5
      v1 PRISTINE currentValues().RESHAPE_MAX=undefined (no settings.json present)
      v2 patched currentValues().RESHAPE_MAX=5
      v2 PRISTINE currentValues().RESHAPE_MAX=null (no settings.json present)
      v2 pristine returns null here: the 23 Nov port set the FIELDS default to 5 but left DEFAULTS null, and the running v2 paper tree has no settings.json — the paper freeze gate never fired there. The v2 paper-settings patch (DEFAULTS null -> 5) closes that.
      v1 pristine has no RESHAPE_MAX key at all (only variant-E VARIANT_SETTINGS); the v1 paper-settings patch adds DEFAULTS + FIELDS entries.

16/16 scenarios PASS, 0 FAIL
```

## Per-criterion table

| Criterion | Result | Seed (what is real vs synthetic) |
|---|---|---|
| P0 parameters | PASS | Derived SOL figures from fractions match D-0c Rev 1 exactly (K1 0.375, K2 0.75, K4 0.50, K5 1.50, K6 0.75, daily 0.375) |
| K1 | PASS | Real worst paper leg: B7 DCTY-USDC emergency_stop −$139.29 → −0.3639 SOL scaled — NO trip (correct: K1 sits beyond the worst known cliff). Synthetic −0.40 SOL leg → TRIP STOP, HALT file + alert captured |
| K2 | PASS | Real B7 window (10 legs, net −0.5287 SOL) split over 3 CET days + synthetic −0.30 leg → equity 4.1713, drawdown 0.8287 > 0.75 → TRIP STOP |
| K3 | PASS | Three REAL emergency_stop legs (B7 DCTY −0.3639, B7 STANK −0.2928, E STANK −0.2698 — same STANK event 19 Nov 17:45 WIB, three books); consecutiveness is synthetic. 3rd → TRIP STOP |
| K4 | PASS | Five REAL losing legs fed consecutively (B7 three + A two; consecutiveness synthetic), sum −0.7542 < −0.50 → TRIP STOP |
| K5 | PASS | Real B7 worst-3 single-leg clusters sum −0.7045 SOL — no real paper window trips K5 at pilot scale. Demo: 3 clusters × 2 legs of −0.28 SOL, wins interleaved, one leg/day → worst-3 −1.68 < −1.50 → TRIP STOP. See reachability finding below |
| K6 (30 legs) | PASS | Real B7 10 legs over days 1–2 + 20 synthetic −0.013 legs day 3 → 30 legs, net −0.7887 < −0.75 → TRIP STOP |
| K6 (7-day) | PASS | Restart simulation: pilotStartAt rewound 8 days, net −0.80, open unrealised +0.10 (keeps K2 silent) → TRIP STOP on the time branch |
| K7 | PASS | Real B7 window, one CET day, net −0.5287 ≤ −0.375 → breach 1: NO_NEW + alert, opens refused rest of day; day 2 synthetic −0.40 → breach 2 → TRIP K7 STOP |
| K8 gap | PASS | Live-only quantity (paper has no fills): gap 0.080 SOL → no trip (consecGap=1); second gap 0.090 → TRIP STOP |
| K8 fee | PASS | v1: 50 bps → TRIP (max 0); v2: 50 bps → ok (disclosed), 51 bps → TRIP |
| K8 gate | PASS | LIVE_CONFIRMED=1 + PAPER=1 → TRIP; clean live gate → ok |
| NEGATIVE | PASS | Full real Book E window (13 legs, net +0.0636 SOL): refuseOpen ok, checkOpen ok, no HALT/STOP/NO_NEW, 0 alerts |
| LATCH | PASS | After K1 trip a +0.50 win does not clear it; simulated restart still refuses; halt-state.json deleted → HALT file alone re-latches |
| FEED | PASS | Price + scan 15 min stale → opens refused; 3 stale polls → feed-degraded NO_NEW + alert; fresh price → NO_NEW lifted, opens proceed |
| RESHAPE_MAX | PASS | Patched live trigger (v1 + v2): reshapes 0–4 due, 5–6 CAPPED; explicit RESHAPE_MAX=3 honoured; patched currentValues().RESHAPE_MAX=5 on both trees (pristine: v1 undefined, v2 null) |

## Findings from the simulations (not failures of the build)

1. **K1 sits beyond the worst known cliff — by design.** The worst real paper
   leg scaled to a 1.25 SOL leg is −0.3639 SOL (B7 DCTY, −$139.29); K1 trips
   at −0.375. The pilot spec's K1 intent question (−0.375 vs −0.35 to catch
   a repeat of the worst known cliff −0.349) is visible here: at −0.375 the
   worst known cliff does NOT trip K1. Sole's call at finalisation.
2. **K5 is unreachable with single-leg clusters unless K1 fires first.**
   Worst-3 single legs without tripping K1 sum to at most 3 × 0.375 = 1.125
   SOL < the 1.50 bar. K5 can only trip via multi-leg clusters (e.g. a
   reposition re-entering the same pool in the same entry minute). The K5
   mechanism (cluster summation + trip) is demonstrated and passes; whether
   the K5 bar is reachable as specified is a question for Warlock Head, not
   a code defect.
3. **A real bad paper day trips the daily breaker.** Replaying the real B7
   window (net −$202.65) at pilot scale gives a CET-day net of −0.5287 SOL,
   past the −0.375 daily limit — breach 1, NO_NEW rest of day. That is the
   breaker working as specified, not a false trip.
4. **K2 subsumes K6 when open unrealised is zero.** With net −0.80 and no
   open positions, the K6 7-day branch is never reached because K2 (drawdown
   0.80 > 0.75) trips first. The K6 time branch was isolated by adding
   +0.10 SOL open unrealised. Correct behaviour; the harness documents it.
5. **K1 scenario also tripped the daily breaker.** Two cliff legs in one day
   (−0.3639 + −0.40 = −0.764 day net) exceed the daily limit, so the K1 run
   captured 2 alerts (K1 STOP + K7-daily NO_NEW). The STOP latch is K1
   (first STOP trip wins); the extra alert is correct, not duplicate.
6. **Feed staleness is a live property, not a paper one.** The negative test
   initially failed on feed-stale only because the harness replayed 13 legs
   without refreshing the price — in production `solUsd()` is called every
   poll and `noteSolUsdAt` refreshes. The harness now notes a fresh price
   at check time, matching production behaviour.

## What was NOT simulated here (out of scope for this item)

- A live close through the real `liveClose`/`liveValuation` chain (needs a
  chain + wallet; the harness tests the halt module and the trigger, which
  are the new code — the bot.js call sites are thin wiring, verified by
  code read + `node --check`). The rehearsal clone (Item 2, R-2/R-3) is
  where the wired path is exercised end to end.
- Telegram delivery to a real chat (the stub captures the exact
  `notifyEmergency` payload; delivery itself is Item 4a's alert-flow
  verification).
- The on-chain-estimate exit flag in a live alert (v1 has no live close
  notify call site today — OPEN-4, Item 4a; the row + log flag are in this
  build, see BUILD-NOTE.md).

---

## Fix record — REVIEW.md N1–N6 + N14 (2026-11-24, appended; original results above untouched)

Fixes applied to `live-halt.js` (root + both patched trees, byte-identical)
and to the `bot.js` wiring via `apply-patches.py`; all 10 patches
regenerated and verified to apply cleanly and reproduce `patched/`
byte-for-byte. Full per-note record: BUILD-NOTE.md §8.

### Re-run results (this revision)

```
node test-halt-sim.js        -> exit 0, 16/16 scenarios PASS, 0 FAIL
node test-n1-wiring.js       -> exit 0, 14/14 wiring checks PASS, 0 FAIL
node review-runs/adversarial.js -> exit 1, 14 PASS, 4 FAIL (A5a-d only, see below)
node --check (all patched .js + root live-halt.js + test-halt-sim.js + test-n1-wiring.js) -> all OK
patch -p1 dry-run, all 10 patches -> exit 0 each; scratch apply + diff -r vs patched/ -> v1 byte-identical, v2 byte-identical
```

### New: `test-n1-wiring.js` — 14/14 PASS (N1/N14), exit 0

```
PASS  W0 live-halt.js exposes openUnrealisedSol (N1 fix present) :: halt.openUnrealisedSol is a function
PASS  W1 A7: -$1 USDC-leg wobble converted at $75 does NOT trip K2 :: openUnrealised=-0.013333 SOL equity=4.986667 checkOpen={"ok":true}
PASS  W1-control: the same -$1 fed RAW (pre-fix line) DOES false-trip K2 :: rawSum=-1 equity=4.0 checkOpen={"ok":false,"reason":"K2 drawdown 1.0000 SOL > 0.75 SOL","criterion":"K2","action":"STOP"} (this control proves the test would have caught N1)
PASS  W2 A7b: -$1 correctly converted (-0.0133 SOL) does NOT trip K2 :: checkOpen={"ok":true}
PASS  W3 masking: +$5 USDC win + realised -0.85 trips K2 once converted :: openUnrealised=0.066667 equity=4.216667 checkOpen={"ok":false,"reason":"K2 drawdown 0.7833 SOL > 0.75 SOL","criterion":"K2","action":"STOP"}
PASS  W3-control: the same +$5 fed RAW masks the drawdown (K2 silent) :: raw equity=9.15 checkOpen={"ok":true}
PASS  W4 SOL leg -0.5 passes through with no price :: openUnrealisedSol=-0.5
PASS  W5 USDC leg + no SOL price returns null (no guess) :: openUnrealisedSol=null
PASS  W6 mixed legs SOL -0.2 + USDC -$15 @ $75 = -0.4, no trip :: openUnrealised=-0.400000 equity=4.600000 checkOpen={"ok":true}
PASS  W7 entry without quoteMint returns null (no silent SOL default) :: openUnrealisedSol=null
PASS  W8 lastSolUsdPx persists across restart :: lastSolUsdPx=75.5
PASS  W9 v1 liveCycle calls halt.openUnrealisedSol + stamps quoteMint, raw sum gone :: file=read callsHelper=true stampsQuote=true rawSumGone=true
PASS  W9 v2 liveCycle calls halt.openUnrealisedSol + stamps quoteMint, raw sum gone :: file=read callsHelper=true stampsQuote=true rawSumGone=true
PASS  W9 live-halt.js identical in root and both patched trees :: byte-identical

14/14 wiring checks PASS, 0 FAIL
```

Fail-on-pre-fix demonstration (same file, `ITEM1_DIR=<pre-fix fixture>`
built from the reviewer's `review-runs/scratch/` pre-fix trees):

```
FAIL  W0 live-halt.js exposes openUnrealisedSol (N1 fix present) :: live-halt.js has no openUnrealisedSol — liveCycle still sums lives[].pnlSol raw (N1 unfixed); remaining checks skipped

0/1 wiring checks PASS
```
Exit 1 on pre-fix code, exit 0 post-fix — the test would have caught N1.

### Builder sim still 16/16 (exit 0) — with two scenarios extended

- **K8-fee scenario (8b)** now also asserts the N4 fail-closed rule:
  `checkFeeBps(null/undefined/NaN/'abc')` all trip K8 STOP (was `ok:true`
  fail-open); `recordClose` with `feeBps='abc'` supplied trips K8, while
  `recordClose` with `feeBps` absent does not trip (absent = no
  observation; the open/swap-time gate is what sees `ROUTE_FEE_BPS`).
- **LATCH scenario (10)** now also asserts the N6 fix: corrupt
  `halt-state.json` with NO HALT file captures a `halt-state-corrupt`
  alert via `notifyEmergency`, and the new instance is NOT halted
  (accounting restarts fresh, `closedLegs` 0, `refuseOpen` ok) —
  alert-only, nothing refused.

### Adversarial suite re-run: 14/18 (exit 1) — ONLY A5a–d fail, as intended

```
FAIL  A5a checkFeeBps(null) returns ok:true (fail-open) :: {"ok":false,"reason":"K8 fee unreadable (swap): cannot verify the swap fee is within 0 bps — refusing (fail-closed)","criterion":"K8","action":"STOP"}
FAIL  A5b checkFeeBps(undefined) returns ok:true (fail-open) :: {"ok":false,"reason":"K8 fee unreadable (swap): ... (fail-closed)","criterion":"K8","action":"STOP"}
FAIL  A5c checkFeeBps(NaN) returns ok:true (fail-open) :: {"ok":false,"reason":"K8 fee unreadable (swap): ... (fail-closed)","criterion":"K8","action":"STOP"}
FAIL  A5d checkFeeBps("abc") returns ok:true (fail-open) :: {"ok":false,"reason":"K8 fee unreadable (swap): ... (fail-closed)","criterion":"K8","action":"STOP"}
```

A5a–d assert the OLD fail-open behaviour that N4 deliberately removed;
they now return `ok:false` + K8 trip, which is the fixed behaviour. The
reviewer's `review-runs/adversarial.js` was NOT edited (reviewer-owned);
the re-review should update the A5 expectations to fail-closed. All
other 14 adversarial cases pass unchanged, including A3b/A3c
(corrupt-state re-latch / fresh start) and A7/A7b (K2 units).
