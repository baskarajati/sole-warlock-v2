# Item 4a — Independent Review (QA / QC / Security)

- **Item:** 4a — alert call-site map + heartbeat + feed-health reporting (v1 + v2)
- **Reviewed:** 2026-11-24 evening CET, by the Independent Reviewer (not the builder)
- **Inputs read in full:** `CALL-SITE-MAP.md`, `HEARTBEAT-AND-CHECK-RULE.md`, `diffs/DIFFS-README.md`, `SYSTEM-READINESS-PLAN-2026-11-24.md` §7 (acceptance bar), all 16 diffs, `patched-v1/` + `patched-v2/`, `pristine-v1/` + `pristine-v2/`, Item 1's `live-halt.js` + patches (for the merge / double-alert questions only)
- **Method:** no trust in builder outputs. Every claim below was re-run or re-read by the reviewer from the pristine trees. The builder filed no smoke-test output files; all smoke evidence here is the reviewer's own runs in `review-runs/`.
- **No files edited:** builder files and the track record were not modified. Review artefacts live only in `review-runs/` + this file.

## Verdicts

| Verdict | Result |
|---|---|
| **QA test** | **PASS** — all 16 diffs apply cleanly to fresh pristine copies and reproduce the patched trees byte-for-byte; `node --check` passes on every patched file; reviewer's own smoke suites pass (v1 31/31 checks, v2 26/26 checks on re-run). |
| **QC verify** | **FAIL (narrow — 2 notes)** — N1: v2 card-path alerts render `🔴 LIVE`, not the literal `[LIVE-v2]` prefix the plan §7.1 bar and the map §3 claim; N2 (G-5): reposition alerts omit tx sigs although the data is in scope, against the same bar ("sigs where available"). Everything else in the map verified. |
| **Security countersign** | **PASS WITH NOTES** — no new network/exec/secret path, no key handling, no retry-queue change; alert failure is recorded, not retried, as designed; the 5-min `notifyError` cooldown is key-based and cannot suppress a distinct critical alert. Notes N6/N7/N12/N13 are Low and accepted in writing. |

## Final line

**Item 4a is NOT DONE.** What remains: **N1 + N2 fixes by the Builder** (revised diffs + reviewer re-verification of the changed files), after which 4a can be DONE. The Item 1 ↔ 4a `bot.js` hand-merge (N3), the `notifyHalt` no-caller decision (N4), and the `test-tg-reposition-notify.js` update (N8) are **Item 2 / Item 1-fix gates at install**, not 4a build defects — they do not block 4a's own DONE, but the merged tree must not be accepted until they are closed. Clone-proven criteria (alert latency ≤ 5 min, heartbeat observed, dropped-alert demo) are **not yet proven** — they belong to Item 2 and were never claimable from this build alone.

---

## 1. QA — test (PASS)

### 1.1 Patch reproduction (reviewer's own run, `review-runs/qa-reproduction.log`, script `review-runs/run-qa.sh`)

- 16 diffs inventoried; all 16 `patch -p0 --batch --dry-run` **OK** against fresh copies of the pristine trees.
- All 16 applied; `diff -r` of the result against `patched-v1/` and `patched-v2/` — **IDENTICAL, byte-for-byte, both trees** (including the two new `feed-health.js` files).
- Pristine md5s re-confirmed by the reviewer: v1 `bot.js` `72ee8c539db13a0b0b6bdf88277821fe`, v1 `telegram-notify.js` `5b522922a8cfd8078876453d0ae54ac6`, v2 `bot.js` `018e2307eb819995e9e1c04cab331212`, v2 `telegram-notify.js` `fec076ea3169869ce11300e5ecfd05b3` — matching the map header, and the v1/v2 `bot.js` md5s also match Item 1's pristine trees (same base).
- `node --check` (node v24.22.1) passes on **all 21 patched `.js` files** (11 v1 + 10 v2), exit 0 throughout.

### 1.2 Smoke tests — reviewer's own runs, isolated dirs, no token

Harness: `review-runs/setup-smoke.sh` + `review-runs/smoke-v1.js` / `smoke-v2.js`, run by `review-runs/run-smoke.sh`. Patched files copied into `review-runs/smoke-v1/` and `smoke-v2/`; missing non-diffed modules stubbed and labelled as test stubs (`env-config.js`, `bot-wallet-address.js`, `bin-shape.js`; v2 additionally `paper-quote-pnl.js`, `bin-model.js` with `forCard`, `card-logo.js`). Telegram transport stubbed via the notifiers' own `setMessageTransport` (captures text, returns `{ok:true, messageId}`), so rendering + `alerts.jsonl` recording are exercised with **no network and no token**. A second no-token run (transport cleared) exercises the `token not set` path.

**v1 — `review-runs/smoke-v1.log`, exit 0, 31/31 PASS**, including:

- `feed-health.js`: 2 CoinGecko 429s counted; quote-wait counted **once** for polls 1/3/10 with max 10; stale counter 3 then reset by a fresh price; `recordQuoteWait(0)` counts one event (builder-noted edge, confirmed).
- `statusFromLiveState`: realised 5 + (−2) = **3**; trades 2, tradesToday 2, openCount 1; `live:true`, `feesPaidUsd:null` (G-6), `stopPresent`/wallet pass through.
- `dailyDue`: 21:30 WIB due, 20:59 WIB not due (explicit dates).
- `notifyKillSwitch` STOP + NO_NEW, `notifyHalt` + reset, `notifyFeedDegraded`, `notifyStartup`, `notifyError` — all resolve `{ok:true}` via transport; captured texts all carry `[LIVE]`; halt text carries `K1`; feed-degraded text carries the stale count; startup text carries cumulative realised.
- `alerts.jsonl` grew by exactly 7, all lines `ok:true` with `messageId` + `ts`; `lastAlert()` returns the newest entry.
- Cooldown: repeat of the same error → `{skipped:'error notify cooldown'}`; a distinct error sends; `alerts.jsonl` grew by exactly 1 — **the cooldown suppression is NOT logged** (see N7).
- `notifyOpen` / `notifyClose` render sigs + running realised; close renders the swap-back-incomplete warning + swap sigs.
- `maybeDailySummary` off-hours returns skipped with no send.

**v2 — `review-runs/smoke-v2.log` (re-run), exit 0, 26/26 PASS**, including:

- Same `feed-health.js` behaviour as v1 (the two files are identical apart from diff headers — verified by diff).
- `statusFromLiveState`: realised USD 5 + (−2) = 3; `todayAgg` built via `pnl-period.aggregate` (2 trades, 1W/1L, pnlSol +0.03, pnlUsd +3).
- `closeHtml` renders the estimate flag, swap-back-incomplete warning, shortened sig (`Clos…3333`), running realised `+$3.00`; `openHtml` renders sigs + running realised; `dailySummaryHtml` renders feed-health + "fees not recorded" lines.
- `notifyReshape` resolves `{ok:true}` with a real reshape card — **the stub is gone** (was `{ok:false, skipped:'reshape notifications are off'}`).
- Kill-switch / halt / feed-degraded / startup / close all resolve `{ok:true}`; text-path notifiers carry the literal `[LIVE-v2]` prefix; `alerts.jsonl` grew by 5; `lastAlert()` returns the newest entry.
- No-token path: `{ok:false, skipped:'token not set'}` **and the outcome IS recorded** in `alerts.jsonl`.
- **First-run failure, diagnosed and re-run:** the first v2 run failed 1/26 — `todayAgg` came back `null`. Root cause was the **reviewer's own stub**, not the build: the stub `bin-model.js` (`{}`) lacked `forCard`, which `warlock-card.closedCardData` calls inside `pnl-period.aggregate`; `statusFromLiveState` catches the throw and returns `todayAgg:null`. Stub fixed (`forCard: () => null` — the real v2 tree ships `bin-model.js`), re-run passes 26/26. The first-run log is superseded by `smoke-v2.log` (re-run); the failure and its cause are recorded here, not hidden. A corollary worth noting: if `aggregate` ever throws on the real tree, the heartbeat silently reports 0 trades today (`todayAgg:null` → `tradesToday:0`, `pnlToday:null`) — graceful degradation, but silent. Low; no action (see §4).

### 1.3 What QA did NOT prove (carried forward, not failed)

- No end-to-end Telegram delivery (no token in this review — same limit as the builder). Delivery to Telegram's API, alert latency ≤ 5 min, the daily heartbeat observed on a running instance, and the deliberately-dropped-alert demonstration are **Item 2 (rehearsal clone)** proofs. The transport-stubbed smoke proves the notifiers attempt the right sends with the right content and record the outcomes; it does not prove Telegram receives them.

---

## 2. QC — verify (FAIL, narrow)

### 2.1 Counts against the PRISTINE trees — verified

- **v1: 0 live notify calls before — CONFIRMED.** Every notify-related line in pristine v1 `bot.js` (15 lines: 1329, 1358, 1496, 1666, 1755, 1790, 1821, 1822, 1990, 1992, 2449, 2451, 2456, 2482, 2495) sits in a paper function or the paper main-loop branch (`statusFromState` / `paperCycle`). The live functions (lines 2016–2440) contain **zero** notify calls (one comment mentions "notify" only), and the live main loop's catch only logs. Paper call sites exist exactly as the map lists. (The track record's "12 hits" differs from my 15 by counting convention; immaterial — the 0-live finding is what matters and it holds.)
- **v2: 4 existing / 3 partial / 9 missing — CONFIRMED in substance.** Existing: `liveNotifyOpen` (1941), `liveNotifyClose` (1972, routes `emergency_stop` → `notifyEmergency`), `liveRepositionNotify` (1970), plus raw `notifyTg` sends. All four were content-incomplete (no sigs / no running realised) — fixed. Partial: swap-back rendering (close fired but sigs never reached the row), kill-switch STOP (close alert only when a position was open). Missing: reshape (stub at `telegram-notify.js:686` returning `{skipped:'reshape notifications are off'}` — confirmed), live-loop error, NO_NEW, startup, heartbeat, breaker, feed-degraded, halt trip, halt reset. The pristine v2 live loop (from 2988) has **no** `notifyStartup`, **no** `notifyError` (catch only logs), **no** `maybeDailySummary` — only the two raw state-unreadable sends. Same for v1's live loop.
- **16-row table: 26 of 27 cited line numbers exact** (full audit in `review-runs/qc-final-spots.log`). One error: the map says v2 `liveRepositionNotify` is at `bot.js:1960` (def) — line 1960 is `liveRepositionReason`; the def is at **1970**. (N9, Low, doc fix.)

### 2.2 Fixes verified by re-reading patched code (not by trusting the map)

- **v2 `closeSigs` fix — CONFIRMED.** Pristine v2 collected `pos.closeSigs` via `onSig` but `clearCloseMarks(pos)` (pristine 2345/2391) deleted them before the row was built. Patched v2 captures `const closeSigs = …` at **2355** and **2402**, calls `clearCloseMarks` on the next line (2356/2403), and the row is built after with explicit `closeSigs, sigs: [...closeSigs, ...(sb.sigs||[])]`. v1 collects sigs directly from `send()` returns (2205–2206). Swap-back sigs flow via `sb.sigs` in both bots.
- **Duplicate-alert fix — CONFIRMED, both bots.** Reposition reopens pass `intermediate:true` (`live-reposition-exec.js` v1:38, v2:40); `liveOpen` guards its open alert on `!opts.intermediate` (v1 2124/2159, v2 2120/2157 via `liveNotifyOpen`'s `if (opts.intermediate) return` at 1983); the close leg already passed `intermediate:true` pre-existing. One alert per reposition event.
- **`[LIVE-v2]` prefix mechanism — CONFIRMED as a constant, with a real gap (N1).** The coordinator's grep ("only 1 line containing `LIVE-v2` in patched-v2 `telegram-notify.js`") is literally true but misleading: that one line is the constant definition `const PREFIX = IS_LIVE ? '[LIVE-v2]' : '[DRY RUN]'` (line 27), used in 20 places via `${PREFIX}`. Text-path notifiers (kill-switch, halt, feed-degraded, error, startup) and raw `notifyTg` sends (hardcoded `'[LIVE-v2] '` in `bot.js:1999` + the fatal send at 3006) **do** carry the literal prefix — verified in smoke. **But** all v2 card-path alerts (open/close/reshape/reposition/daily) render through `tg-format.js` `mode(paper)`, which returns `'🔴 LIVE'` — **no literal `[LIVE-v2]` anywhere in the card HTML** (verified: `closeHtml` contains `🔴 LIVE`, does not contain `[LIVE-v2]`; `warlock-card.js` contains no `LIVE` string at all, so the PNG card carries no version marker either — only the caption does). The map §3 claims `[LIVE-v2]` for those rows; that claim is wrong. See N1.
- **Reshape gate — CONFIRMED.** `CFG.NOTIFY_RESHAPE` defaults to `false` in the **pre-existing** `paper-settings.js` (v1:31, v2:32) — no diff needed, correctly none shipped. v2 call site gated at 2653; v1 unconditional at 2411. Net effect today: zero behaviour change for v2 reshapes, as stated.
- **`alerts.jsonl` + `lastAlert` — CONFIRMED, with a gap (N7).** `recordAlertOutcome` appends `{"ts","ok","error","skipped","messageId"}` on every `send()`/`sendPhoto()` outcome incl. queue-full (text path); rotation at >200 KB keeps the last 1,000 lines; `lastAlert()` exported in both bots and returns the newest entry (smoke-verified). Two outcome classes are **not** recorded: `notifyError` cooldown suppressions (return before `fire()`), and `sendPhoto` queue-full (returns without recording). The card-path queue-full case is defused — `sendCardOrText` falls back to a text `send()` when the photo fails, which is logged; only the pure-photo path (07:00 daily card) can vanish unlogged, and that is not the heartbeat path.
- **Heartbeat gate — CONFIRMED.** `dailyDue` = WIB hour ≥ 21 and `lastDailySummaryDate` ≠ today; `maybeDailySummary`/`notifyDailySummary` have **no inactivity skip** — the 21:00 heartbeat fires on flat days. v2's `maybeDailyCard` (07:00 card) **does** skip inactive live days (`if (!t.closed.length && !t.open.length) continue`) — a different function with a different dedup key; the heartbeat path is separate, as the spec says. Live-loop call sites at v1:2612 / v2:3025, startup at v1:2601 / v2:3012, live-loop error at v1:2607 / v2:3018 — all verified in place.
- **`TELEGRAM_CFG_FILE` install note — CONFIRMED correct.** Default is `path.join(ROOT, 'paper', 'telegram.json')` in both notifiers (pre-existing). Unset on live, the dedup state (`lastDailySummaryDate`) lands in `paper/telegram.json` — exactly the risk stated. The same env-var discipline applies to `alerts.jsonl` via `LP_BOT_DIR` (default `/workspace/lp-bot`), but that is already covered by `LIVE-INSTANCE-DESIGN.md` ("set explicitly per instance") — no new requirement, just state the 6h-check path (`<live-dir>/alerts.jsonl`) in the install note (N14, Low).
- **HEARTBEAT §2 rule implementable as a cron-body change — CONFIRMED.** Sources exist: `alerts.jsonl` (written by the notifier), live `state.json` `history[].closedAt` / `positions[].openedAt`, `status.json` `feedHealth` (written by `writeLiveStatusPointer` on live only — v1:2272, v2:2451, both `...(CFG.PAPER ? {} : {feedHealth…})`). One wording point: `lastAlert()` returns the last line regardless of `ok`; the rule's step 1 ("last line with `ok:true`") requires the cron body to filter lines itself. No new VPS code is needed.
- **`decisionVal` to close — CONFIRMED** (v1:2422, v2:2665: `liveClose(state, exitReason, { val: decisionVal })`); rows carry `quoted` / `valuationBasis` and `riskPolicyVersion: 'net-usdc-v2-quote-wait10'`.

### 2.3 Coordinator findings — adjudicated (each verified independently)

**(a) Merge conflict Item 1 vs Item 4a — CONFIRMED, but NARROWER than the coordinator stated (N3).**
Reproduced both orders on the common pristine base (`review-runs/merge-both-orders.log`, `merge-hunks.log`):

- Order A (Item 1 patches applied first, then 4a diffs dry-run): **only `v1-bot.js.diff` and `v2-bot.js.diff` fail**; the other 14 diffs dry-run OK. v1 bot.js: 3/16 hunks fail (#2 @247 `solUsd`, #10 @2221 live-close row, #14 @2403 live-position-cycle); v2 bot.js: 4/16 fail (#2 @235 `solUsd`, #8 @2351 `finishLiveClose`, #9 @2397 `liveCloseSol`, #13 @2659 reshape call site). The remaining hunks succeed only with offsets (up to 45 lines).
- Order B (4a first, then Item 1 patches dry-run): same result — **only the two `bot.js` patches fail**; all other Item 1 patches (halt-params, live-halt, live-reshape-exec, paper-settings) dry-run OK.
- The coordinator's track-record wording ("Item 1 then 4a fails all 6 v1 non-new-file diffs") does **not** reproduce on the common pristine base — it presumably reflects testing against Item 1's own patched tree, which lacks files Item 1 never touched (`telegram-notify.js` etc.), so those diffs fail trivially for missing files. The accurate finding: **only `bot.js` conflicts, in either order.**
- **Install implication (unchanged in substance):** the two `bot.js` patch sets must be merged by hand against the FIXED Item 1 patch, then re-verified (patch-apply + `node --check` + smoke on the merged tree). Do not attempt a sequential apply. This is Item 2 / W-1 work, not a 4a defect.

**(b) Double feed-degraded alert — ADJUDICATED: ACCEPTABLE, with a merge-time decision to record (N5).**
Verified both mechanisms: Item 1's `live-halt.checkFeed` counts stale **polls** (once per `liveCycle`, age-based, incl. scan age) and at 3 consecutive stale polls writes `NO_NEW` and fires `alert('feed-degraded', …)` → `notifyEmergency` with an emergency-titled `HALT feed-degraded` message (once per episode, guarded by `feedNoNew`). Item 4a's path counts stale **`solUsd()` reads** (per position per cycle + once per cycle, 60 s cache) and at `stalePollsConsecutive ≥ 3` fires the dedicated `notifyFeedDegraded` (once per episode, `feedDegradedNotified`). On the merged tree both can fire for the same underlying event — but they are different triggers on different counters (they will not necessarily fire at the same moment), different content (enforcement action vs feed-health counters), and each fires once per episode, so this is two informative messages, not spam. **Acceptable as-is for 4a DONE.** Recommended (not required) merge-time option: route Item 1's `checkFeed` feed-degraded alert through `notifyFeedDegraded` so the merged tree sends one message carrying both the counters and the `NO_NEW` action. Item 2 to record whichever it chooses.

**(c) G-5 reposition alerts carry no tx sigs — JUDGED: FIX BEFORE DONE (N2).**
Verified the data is in scope and the renderers are ready everywhere except one place: v1's caller has `legRow` (with `legRow.sigs`) at `bot.js:2385` but passes no `sigs` and no `runningRealisedUsd` on the success path (the failed-reopen path at 2387 **does** pass `runningRealisedUsd` via `notifyClose`); v1 `notifyReposition` **does** render sigs if passed (`telegram-notify.js:631`). v2's exec returns `leg` and builds an `event` object with no `sigs` field, and `repositionHtml` has **no sigs line at all** (checked lines 94–135). A reposition closes a leg on-chain for real money; the plan bar requires sigs "where available", and they are available. The fix is small (v1: pass `sigs: legRow.sigs, runningRealisedUsd` in the call; v2: add `sigs` to the event + a sigs line in `repositionHtml`). Fix before DONE.

**(d) Ghost close + never-funded close — JUDGED: ACCEPT IN WRITING (N12, N13).**
- *Never-funded position* (v2 `liveClose` early return, pristine 2257: `depositSol` 0, rent back only, log only, no history row, no alert): **accepted.** No funds were at risk. Noted blind spot: no history row means the 6h-check rule cannot see this close either — acceptable precisely because nothing traded.
- *Ghost close* (`finishGhostClose`, patched v2:2541): the builder's note is incomplete. It does **not** alert only via raw `notifyTg` — `finishLiveClose` (called with `opts={}`) also fires the normal close alert via `liveNotifyClose`, so the operator gets two messages for one close (close card + "interrupted close finished" note). The real defect is smaller: `opts={}` means `quoted` is `null` on the row, so the close card carries **no estimate flag** even though the value is an estimate (`closeEstimate`/`lastValuation`). The raw message compensates by naming the interruption. **Accepted in writing**; recommended one-line merge-time fix (pass `{val:{quoted:false}}`) — optional, not a DONE-blocker.

**(e) Builder's three failed execs (exit 1, exit 1, exit 2) — NOT DETERMINABLE (N10).**
No handoff, log, or run-output file from the builder exists anywhere in `item4a-alerts/` or the track record beyond the coordinator's one-line mention ("unexplained"). Nothing in the delivered files explains them, and the build itself reproduces cleanly in the reviewer's hands, so they left no trace in the artefacts. Recorded as **UNKNOWN**. Process consequence: builds must file run logs (this review files its own in `review-runs/`).

### 2.4 Gaps / dependencies — judgements

- **G-1/G-2 (halt/breaker, no caller) — CONFIRMED as stated.** `notifyHalt` has **no caller** in either patched tree (def + export only, v1:722/1108, v2:800/1184). No trip detection was built here — correct, that is Item 1's. Insertion points are exact (`telegram.notifyHalt({criterion, figures})` at trip, `{criterion, reset:true}` at reset; exported from both notifiers). **But see N4:** Item 1 as built does not call `notifyHalt` either — its `live-halt.js` `alert()` routes halts through `notifyEmergency` (verified: zero `notifyHalt` references in Item 1's `live-halt.js` and patched bot.js files). `notifyHalt` is currently dead code on both sides of the merge; the merged tree needs an explicit decision.
- **G-3 (feed-RULE code is Item 1's) — ACCEPTED.** 4a built reporting + the alert only; no-open rule, `NO_NEW` write, estimate flagging, never-close-on-guessed-price are untouched here. Correct scope split.
- **G-4 (3-stale-reads threshold is an approximation) — ACCEPTED.** Reads (≈1–3 polls depending on open positions) vs Item 1's poll-precise rule for enforcement. The alert text says it is reporting. Item 1 defines the precise rule.
- **G-5 — FIX BEFORE DONE (N2, see §2.3c).**
- **G-6 (fees paid "not recorded") — ACCEPTED, data gap not alert gap.** Verified: live close rows (v1:2227, v2:2357/2402) carry no `swapCostUsd`/`gasUsedSol` fields while paper rows do (v1:1747–48). The heartbeat renders the honest "not recorded" line instead of inventing a number. Owner for the data gap: whoever owns live-row fields (Warlock Head / live-row spec) — outside 4a.
- **G-7 (v1 RPC errors via log pattern-counting) — ACCEPTED with a validation note (N11).** Verified: v1 uses a direct web3.js `Connection` (`bot.js:223` pristine, `new Connection(CFG.RPC, …)`), no fetch wrapper — there is nowhere in-process to count. v2's `rpc-config.js` diff adds `recordRpcError()` on 429/5xx/network in `makeFetch` (two call sites, both guarded). The 6h-check's `bot.log` pattern rule (`rpc` + `429|rate limit|timeout|ECONN|fetch failed`) is the only v1 coverage and its pattern is **unproven against real v1 log lines** — validate it on the clone (Item 2 / R-4).
- **`test-tg-reposition-notify.js` update need — CONFIRMED as a real need, owner Item 2 (N8).** The file does **not exist anywhere in `~/workspace/warlock-division`** (searched) — it lives only on the VPS v2 tree, so the reviewer could not read the assertion at line 39. The diff itself flags it (`patched-v2/telegram-notify.js:717–718`: "must be updated by QC when the flag is flipped"). Whether it fails against the patched tree today depends on what it asserts (the stub response vs end-to-end silence with the flag off) — unverifiable from here. Item 2 must read it at install and update it before running that test on the merged tree.

---

## 3. Security — countersign (PASS WITH NOTES)

Read in full: `feed-health.js` (both copies — identical), the `telegram-notify.js` diffs, the `bot.js` diffs, `rpc-config.js` diff.

- **No new network path.** The only network calls in the diffs are the pre-existing Telegram `https.request` paths (`api.telegram.org`) and the pre-existing `telegram.send` for the state-unreadable fatal. No new host, no new endpoint, no new transport. `feed-health.js` is pure in-memory counting — no I/O, no network, no `require` of anything.
- **No key/secret handling.** No diff touches token loading, `loadToken`, `redact`, `TELEGRAM_BOT_TOKEN`, or any secret file. The new `alerts.jsonl` lines contain only `{ts, ok, error, skipped, messageId}`; errors pass through the pre-existing `redact()`, which strips the token and Telegram API URLs. No secret is written to the log.
- **Only new writes: `alerts.jsonl`.** `appendFileSync` + rotation rewrite (`writeFileSync`, last 1,000 lines past 200 KB), both inside `try/catch` so a logging failure can never break alerting. The one other `+writeFileSync` in the diffs is the pre-existing state-unreadable marker file with only the `[LIVE-v2]` prefix added to its message. No other file is written, no file is executed, no `child_process`/`eval`/dynamic `require` added.
- **No retry-queue ordering change.** `send()`/`sendPhoto()` queue logic (`MIN_GAP_MS`, `MAX_QUEUE`, `queueLen`) appears in the diffs only as context around the added `recordAlertOutcome` calls; the queue mechanics are untouched. No retry queue was built (accepted design — see below).
- **Alert failure is recorded, not retried — accepted design.** `send()` resolves `{ok:false}` with no retry and no persistence (pre-existing). The new outcome log + daily heartbeat + 6h-check rule is the backstop, as the plan requires. A retry queue would change delivery ordering under the 2 s gap / 25-deep queue and belongs to a separate reliability decision, as the builder states.
- **5-min `notifyError` cooldown cannot suppress a distinct critical alert — CONFIRMED.** The key is `kind + ':' + first-80-chars-of-message` (`telegram-notify.js:747` v1 / 825 v2); suppression requires the **same** key within 5 minutes. A distinct error (different kind or different message) sends. Caveat (Low): two different errors sharing kind + first 80 chars would be treated as one — a narrow collision, accepted. The suppression itself is unlogged (N7).
- **Once-per-episode flags** (kill-switch, feed-degraded) prevent spam on a stuck condition; the flags reset when the condition clears. Note N6: v2 sets these flags without an explicit `saveState` at the set site (v1 does save); a restart mid-episode re-fires the alert once — benign, arguably desirable, accepted.
- **`feed-health.js` cannot gate a trade.** It exports counters + `status()` + `reset()` only; nothing in it is read by any decision path in the diffs (callers only record counts and read `status()` for reporting). The stale-feed rules remain Item 1's.
- **No exfiltration path.** Nothing in the diffs sends state, history, wallet addresses, or any user data anywhere except the Telegram alerts themselves, which are the specified deliverable.

---

## 4. Notes table

| # | Severity | Note | Owner | Close-out |
|---|---|---|---|---|
| N1 | Medium | **v2 card alerts lack the literal `[LIVE-v2]` prefix.** Open/close/reshape/reposition/daily render `🔴 LIVE` via `tg-format.mode()`; `warlock-card.js` has no `LIVE` string at all. Plan §7.1 requires `[LIVE]/[LIVE-v2]`; map §3 wrongly claims `[LIVE-v2]` for these rows. Text-path alerts do carry it. | 4a Builder | **Fix before DONE** (preferred: `mode()` live branch emits `[LIVE-v2]`; re-verify diff + smoke) — or written acceptance by the coordinator + map correction stating `🔴 LIVE` is the v2 card marker. |
| N2 | Medium | **G-5: reposition alerts omit tx sigs** (and v1 success path omits running realised). Data is in scope: v1 caller has `legRow.sigs`; v2 exec returns `leg`; v1 `notifyReposition` already renders sigs if passed; v2 `repositionHtml` has no sigs line. Plan bar: sigs "where available". | 4a Builder | **Fix before DONE** (v1: pass `sigs` + `runningRealisedUsd`; v2: add `sigs` to the event + a sigs line in `repositionHtml`); re-verify. |
| N3 | Medium | **Item 1 ↔ 4a `bot.js` merge conflict, both orders — but only `bot.js`.** Correction to the coordinator's "all 6 v1 diffs fail": on the common pristine base only the two `bot.js` diffs fail (v1: 3/16 hunks; v2: 4/16 hunks — see §2.3a). All other files compose. | Item 2 / W-1 | Hand-merge against the FIXED Item 1 patch, then re-verify (patch-apply + `node --check` + smoke on the merged tree). Install gate, not a 4a defect. |
| N4 | Medium | **`notifyHalt` has no caller on either side of the merge.** Item 1's `live-halt.alert()` routes halts via `notifyEmergency`, not `notifyHalt` (zero references in Item 1's files). `notifyHalt` is dead code until someone wires it. | Item 1-fix batch / Item 2 merge | Decision before merged-tree acceptance: rewire `live-halt` to `notifyHalt`, or accept `notifyEmergency` as the halt alert and retire `notifyHalt`. |
| N5 | Low | **Double feed-degraded alert on the merged tree** (4a `notifyFeedDegraded` + Item 1 `checkFeed` → `notifyEmergency`). Adjudicated acceptable: different counters/triggers/content, once per episode each. | Item 2 merge | Accept in writing; record the choice. Optional merge-time improvement: route Item 1's feed alert through `notifyFeedDegraded` for one message. |
| N6 | Low | **v2 once-per-episode flags not explicitly persisted** at the set site (no `saveState` call; v1 saves). A restart mid-episode re-fires the alert once. | — | Accept in writing (benign, arguably desirable). |
| N7 | Low | **`alerts.jsonl` misses two outcome classes:** `notifyError` cooldown suppressions (verified in smoke: unlogged) and `sendPhoto` queue-full (card-path falls back to a logged text send; only the pure-photo 07:00 card can vanish unlogged). Also `lastAlert()` returns the last line regardless of `ok` — the §2 rule must filter for `ok:true` itself. | 6h-check implementer (coordinator) | Accept in writing; note the filter requirement for the cron-body change. |
| N8 | Low | **`test-tg-reposition-notify.js` must be updated at install.** File exists only on the VPS v2 tree (not in workspace — could not read the assertion). Diff flags it at `telegram-notify.js:717`. | Item 2 install / Engineering | Fix before merged-tree acceptance: read it, update the reshape-silence assertion to the new behaviour (real notifier + gated call site). |
| N9 | Low | **Map line-number error:** v2 `liveRepositionNotify` def is at `bot.js:1970`, not 1960 (1960 is `liveRepositionReason`). All other 26 cited lines verified exact. | 4a Builder | Doc fix riding with the N1/N2 revision. |
| N10 | Low | **Builder's three failed execs (exit 1, 1, 2) undeterminable** — no handoff/log filed; build reproduces cleanly. | — | Recorded UNKNOWN. Process: builds must file run logs. |
| N11 | Low | **G-7 v1 log-pattern rule unproven** against real v1 `bot.log` lines (pattern: `rpc` + `429\|rate limit\|timeout\|ECONN\|fetch failed`). | Item 2 (R-4) | Validate the pattern on the clone; accept for 4a. |
| N12 | Low | **Ghost close renders `quoted:null`** on an estimate-valued close (`finishGhostClose` passes `opts={}`); close card + raw `notifyTg` message both fire. Raw message compensates. | Item 2 (optional) | Accept in writing; optional one-line merge-time fix (`{val:{quoted:false}}`). |
| N13 | Low | **Never-funded-position close stays un-alerted** (log only, no history row). No funds at risk; 6h-check cannot see it either. | — | Accept in writing. |
| N14 | Low | **Install note completeness:** `TELEGRAM_CFG_FILE` note confirmed correct; state the 6h-check path (`<live-dir>/alerts.jsonl`, i.e. `LP_BOT_DIR`) in the same note. `LP_BOT_DIR` per-instance setting is already required by `LIVE-INSTANCE-DESIGN.md`. | Item 2 install note | Add one line to the install note. |

Accepted without a note (verified, no action): G-1/G-2 (no trip code built; insertion points exact), G-3 (reporting only), G-4 (approximation; Item 1 defines the precise rule), G-6 (honest "not recorded" wording), reshape gate (pre-existing default `false`, no diff needed), heartbeat always fires incl. flat days, cooldown key-based, `feed-health.js` identical v1/v2 and reporting-only, `statusFromLiveState` arithmetic (incl. `todayAgg` via `pnl-period`).

## Acceptance criteria (§7.3) — 4a scope only

| Criterion | Status |
|---|---|
| Complete call-site table, zero unmapped, zero missing call sites | **Met as a map** — 16/16 mapped; 13 wired + 3 specified with exact Item 1 insertion points (N4 records that Item 1 does not yet call `notifyHalt`). |
| Alert latency ≤ 5 min on the clone, for every event | **Not yet proven** — Item 2 (no clone run exists yet). |
| Daily heartbeat observed on the clone; 6h-check flags a dropped alert (demonstrated) | **Not yet proven** — Item 2. The rule itself is implementable as specified (§2.2). |
| Tracker/Monitor show the clone as a separate `LIVE` entry; divergence demonstrated | **Not this item** — 4b / Item 2. |

## Run outputs (reviewer's own evidence)

All under `review-runs/` alongside this file:

- [REVIEW.md](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/REVIEW.md) (this file)
- [review-runs/qa-reproduction.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qa-reproduction.log) — 16-diff dry-run/apply + byte-identical + `node --check` (script: [review-runs/run-qa.sh](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/run-qa.sh))
- [review-runs/smoke-v1.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/smoke-v1.log) — v1 smoke, exit 0, 31/31 ([review-runs/smoke-v1.js](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/smoke-v1.js))
- [review-runs/smoke-v2.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/smoke-v2.log) — v2 smoke re-run, exit 0, 26/26 ([review-runs/smoke-v2.js](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/smoke-v2.js)); first-run failure (stub artifact, diagnosed in §1.2) is recorded in §1.2, not in a separate file
- [review-runs/merge-both-orders.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/merge-both-orders.log) + [review-runs/merge-hunks.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/merge-hunks.log) — merge-conflict reproduction, both orders
- [review-runs/double-feed.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/double-feed.log) — Item 1 `checkFeed` vs 4a `notifyFeedDegraded` evidence
- [review-runs/qc-counts.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-counts.log), [review-runs/qc-live-span.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-live-span.log), [review-runs/qc-specifics.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-specifics.log), [review-runs/qc-specifics2.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-specifics2.log), [review-runs/qc-specifics3.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-specifics3.log), [review-runs/qc-specifics4.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-specifics4.log), [review-runs/qc-gaps.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-gaps.log), [review-runs/qc-final-spots.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/qc-final-spots.log) — QC read-backs (counts, prefix, closeSigs, cooldown, heartbeat, gaps)
- `review-runs/smoke-v1/` + `review-runs/smoke-v2/` — the isolated smoke dirs (patched files + labelled test stubs + generated `alerts.jsonl`)

**Item 4a is NOT DONE.** Remaining for DONE: N1 + N2 Builder fixes with reviewer re-verification. Install gates for Item 2: N3 (hand-merge `bot.js`), N4 (`notifyHalt` caller decision), N8 (test-file update).

---

## 5. Close-out re-review — fix round N1 + N2 + N9 (2026-11-24 evening CET)

- **Re-reviewer:** independent close-out re-reviewer (not the builder, not the coordinator). No builder file was edited; no builder or coordinator scratch was reused.
- **Method:** every claim below was re-run or re-read by the re-reviewer from the pristine/patched trees. Own scratch dir `/tmp/i4a-closeout-qa` (fresh pristine copies, not the builder's `/tmp/i4a-fix-qa`); own isolated smoke dirs `review-runs/closeout-v1/` + `closeout-v2/` with own harnesses `review-runs/closeout-smoke-v1.js` / `closeout-smoke-v2.js` (scripts `closeout-qa.sh`, `closeout-setup.sh`, `run-closeout.sh`); the builder's own fix harnesses were also re-run by the re-reviewer in those same isolated dirs (copies of `smoke-fix-v1.js` / `smoke-fix-v2.js`, outputs to new `closeout-builder-rerun-*.log` files — the builder's `fix-smoke-*.log` files were not overwritten). No token, no network, no VPS writes anywhere in this re-review. Earlier verdicts above are left as written; this section judges only the fix round.

### 5.1 N1 — CLOSED

- **Fix site read:** `patched-v2/tg-format.js:10` — `mode()` live branch is now the literal `'🔴 [LIVE-v2]'` (paper branch unchanged `'🧪 DRY RUN'`); pristine was `'🔴 LIVE'` (verified at `pristine-v2/tg-format.js:10`).
- **Own functional probe (closeout-smoke-v2, 36/36 PASS, exit 0):** `mode(false) === '🔴 [LIVE-v2]'` exactly; `mode(true) === '🧪 DRY RUN'` exactly. All six live card paths — `closeHtml`, `openHtml`, `repositionHtml`, `repositionFailedHtml`, `reshapeHtml`, `dailySummaryHtml` — each contain the literal `[LIVE-v2]` and none matches bare `🔴 LIVE` (regex `/🔴 LIVE(?!-v2)/`). Paper `closeHtml` still renders `🧪 DRY RUN` with no `[LIVE-v2]`.
- **PNG card:** `ref-deps-v2/warlock-card.js` contains zero occurrences of `LIVE` (grep count 0) — the PNG card itself still carries no marker; only the caption does, as the map's "What renders where" paragraph states. That paragraph was read in full and matches the code: v1 text `[LIVE]` via `PREFIX` (`telegram-notify.js:23`), v2 text `[LIVE-v2]` via `PREFIX` (`telegram-notify.js:27`), v2 cards `🔴 [LIVE-v2]` via `mode()`.
- Builder harness re-run by the re-reviewer: `closeout-builder-rerun-v2.log`, 29 PASS / 0 FAIL, exit 0 (the map §8 says "28/28" — the log actually contains 29 passing checks; the extra check is real, the count in §8 is off by one, in the passing direction).

### 5.2 N2 — CLOSED

- **v1 caller read:** `patched-v1/bot.js:2385` — success-path `notifyReposition` now passes `sigs: legRow.sigs` and `runningRealisedUsd: liveRealisedUsd(state)`; the failed-reopen path at `:2387` still passes running realised via `notifyClose`, as before.
- **v1 renderer — REVIEW.md §2.3c premise correction, CONFIRMED:** §2.3c said v1 `notifyReposition` "already renders sigs if passed (`telegram-notify.js:631`)". That citation is wrong in both trees. In the **patched** tree, line 631 is the sigs splice inside `notifyOpen` (`if (arguments[0]?.sigs?.length) lines.splice(...)`, `notifyOpen` spans 610–635); in the **pristine** tree, line 631 is inside `closeBody` (`return [`). `notifyReposition` itself (pristine 624–627, patched 656–663) rendered **neither** sigs nor running realised before this fix. The fix round's fourth changed diff is therefore necessary, not redundant: patched `telegram-notify.js:660–661` add both splice lines (`🔗 Tx: <shortSigList>` + `📈 Realisasi kumulatif (live)`) to `notifyReposition`, in the same pattern as `notifyOpen`/`notifyReshape`. The builder's inline comment at patched `:658–659` states this correction, and it is accurate.
- **v1 probe (closeout-smoke-v1, 15/15 PASS, exit 0):** `notifyReposition` with sigs renders `Closeout…1111, SwapSigB…2222` + `Realisasi kumulatif (live): $12`; without sigs, no `🔗 Tx` line; without running realised, no `Realisasi` line; `notifyOpen` regression still renders sigs + running realised; the Tx line is spliced before the dry-run note. Builder harness re-run: `closeout-builder-rerun-v1.log`, 11/11 PASS, exit 0.
- **v2 exec read — `reason` intact, CONFIRMED explicitly:** `patched-v2/live-reposition-exec.js:57` — the event literal carries `sigs: (leg.row && Array.isArray(leg.row.sigs)) ? leg.row.sigs.filter(Boolean) : [], reason: deps.reasonText || null, oldMinBinId: …` on one statement; the `// Item 4a fix N2` comment sits at end-of-line after `oldMaxBinId`, after `reason`, so it cannot comment `reason` out. Source-level check in the harness (regex `sigs: \(leg\.row[^;]*reason: deps\.reasonText` plus a no-commented-`reason` check) passes, and the functional probe proves it: both the success event and the failed-reopen event carry `reason === 'OOR kanan closeout'` exactly as passed in (`deps.reasonText`), alongside the leg sigs.
- **v2 renders read:** `patched-v2/tg-format.js:106` (`repositionHtml`) and `:122` (`repositionFailedHtml`) both render a shortened-sig `🔗 Tx` line (`Repo…7777` / `Swap…5555` style, same `short()` as the close card). Probe: with sigs, both cards show the line; without sigs, neither shows a Tx line. End-to-end via `live-reposition-exec.reposition()` with stubbed deps: success (`done:true, reopened:true`) and failed-reopen (`done:true, reopened:false`, kind `reopen_failed`) events both carry the leg sigs, and the rendered cards show sigs + `[LIVE-v2]`; `notifyReposition` via `telegram-notify.js` resolves `{ok:true}` with the same rendering. v2 reposition has no running-realised line, as the map states (intermediate leg close, no running total booked) — no such line was expected or found.
- **Close regression:** v2 `closeHtml` still renders shortened sig + `Running realised`.

### 5.3 N9 — CLOSED

- Map §2 row 6, v2 column, now cites `liveRepositionNotify` at `bot.js:1970`. Read-back of the patched tree: line 1970 (`botLines[1969]`) is `async function liveRepositionNotify(kind, e) {`; line 1960 is `liveRepositionReason` (`function liveRepositionReason(pos, val) {`), not the def. The §8 note that 1960 was the def in the pristine tree before the 4a diffs shifted it 10 lines is consistent with the pristine layout. All other 26 cited lines were verified exact in the original review and are untouched (no other map row changed).

### 5.4 QA reproduction (own run) — PASS

- `review-runs/closeout-qa.log` (script `closeout-qa.sh`, own scratch `/tmp/i4a-closeout-qa`): 16 diffs inventoried; all 16 `patch -p0 --batch --dry-run` **OK** against fresh pristine copies; all 16 applied; `diff -r` vs `patched-v1/` and `patched-v2/` — **IDENTICAL, byte-for-byte, both trees**; `node --check` (node v24.22.1) passes on **all 21 patched `.js` files**, exit 0 throughout.
- **Exactly 4 diffs changed vs the original review, 12 untouched — CONFIRMED.** `md5sum` comparison against the builder-filed pre-fix md5 list (`/tmp/i4a-fix-diffs-before.md5`, 2026-11-24 17:48) differs in exactly 4 lines: `v1-bot.js.diff`, `v1-telegram-notify.js.diff`, `v2-live-reposition-exec.js.diff`, `v2-tg-format.js.diff`; the other 12 md5s are identical. Corroborated independently of that file: line counts are v1-bot 263 (unchanged count, one line lengthened), v1-telegram-notify 248 → 253, v2-tg-format 43 → 70, v2-live-reposition-exec 19 → 28, matching map §8; and `grep "Item 4a fix N"` across `diffs/` hits only those same 4 diffs.

### 5.5 N3/N4/N8 + acceptances — CONFIRMED UNTOUCHED, still open / accepted as before

- **N3 (Item 1 ↔ 4a `bot.js` merge conflict):** untouched — no merge was attempted in this round; the 4 changed diffs still apply only against the pristine base. Still an **Item 2 install gate**.
- **N4 (`notifyHalt` has no caller):** untouched and still true — `grep notifyHalt(` in `patched-v1/bot.js` and `patched-v2/bot.js` returns nothing; `notifyHalt` appears in each `telegram-notify.js` only as the def (v1:726, v2:800) and the export (v1:1112, v2:1184). Still an **Item 1-fix / Item 2 merge decision**.
- **N8 (`test-tg-reposition-notify.js` update):** untouched — the flag comment still stands at `patched-v2/telegram-notify.js:717–718` ("must be updated by QC when the flag is flipped"); the file still does not exist anywhere in the workspace. Still an **Item 2 install gate**.
- **N5/N6/N7/N11/N12/N13 (accepted in writing):** untouched — all 12 non-fix diffs are byte-identical to the pre-fix versions (§5.4), so no accepted item was re-opened or silently changed. No code change rides with any of them, as the map §8 states.
- **No VPS writes, no key material, no live-mode flag in anything touched:** no added line in the 4 changed diffs mentions a private key, token, seed, password, or `LIVE_CONFIRMED` (grep of `^+` lines); the only `token`-matching added lines anywhere in the 16 diffs are the pre-existing original-review `tokenSwapped` / token-account-close identifiers, not secrets. No file outside `item4a-alerts/` was touched by this re-review; the re-review's own outputs are new files under `review-runs/` only.

### 5.6 Close-out verdict

| Note | Judgement |
|---|---|
| N1 (v2 card `[LIVE-v2]`) | **CLOSED** — literal marker on all six card paths, paper unchanged, PNG card unmarked |
| N2 (reposition sigs) | **CLOSED** — v1 caller + renderer (premise correction confirmed), v2 exec event + both card renders, `reason` verified intact in source and in probe |
| N9 (map line 1970) | **CLOSED** — row 6 cites `bot.js:1970`, verified against the patched def |
| N3 / N4 / N8 | **Still open, Item 2 install gates** (unchanged — they never blocked 4a's own DONE) |
| N5 / N6 / N7 / N11 / N12 / N13 | **Still accepted in writing, untouched** |

**Item 4a is DONE** (4a build scope). The original review's fix-before-DONE notes N1 + N2 and the riding Low note N9 are all closed on the re-reviewer's own evidence. What remains is outside 4a: the Item 2 install gates N3 (hand-merge `bot.js` against the fixed Item 1 patch, then re-verify), N4 (`notifyHalt` caller decision), N8 (`test-tg-reposition-notify.js` update) — the merged tree must not be accepted until they are closed. Clone-proven criteria (alert latency ≤ 5 min, heartbeat observed, dropped-alert demo) remain **not yet proven** and belong to Item 2, as before.

### 5.7 Close-out run outputs (re-reviewer's own evidence)

All under `review-runs/` alongside this file (new files only; no existing file overwritten):

- [review-runs/closeout-qa.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-qa.log) — 16-diff dry-run/apply + byte-identical + `node --check` + 4-changed-diffs check (script: [review-runs/closeout-qa.sh](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-qa.sh))
- [review-runs/closeout-smoke-v1.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-smoke-v1.log) — re-reviewer's own v1 smoke, exit 0, 15/15 ([review-runs/closeout-smoke-v1.js](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-smoke-v1.js))
- [review-runs/closeout-smoke-v2.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-smoke-v2.log) — re-reviewer's own v2 smoke, exit 0, 36/36 ([review-runs/closeout-smoke-v2.js](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-smoke-v2.js))
- [review-runs/closeout-builder-rerun-v1.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-builder-rerun-v1.log) — builder's `smoke-fix-v1.js` re-run by the re-reviewer in the closeout dir, exit 0, 11/11
- [review-runs/closeout-builder-rerun-v2.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-builder-rerun-v2.log) — builder's `smoke-fix-v2.js` re-run by the re-reviewer in the closeout dir, exit 0, 29/29 (map §8 says 28/28; the log has 29 passing checks — see §5.1)
- [review-runs/run-closeout.sh](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/run-closeout.sh) + [review-runs/closeout-setup.sh](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-setup.sh) + [review-runs/closeout-smoke-setup.log](sandbox://workspace/warlock-division/live-readiness/item4a-alerts/review-runs/closeout-smoke-setup.log) — close-out runner/setup
- `review-runs/closeout-v1/` + `review-runs/closeout-v2/` — the isolated close-out smoke dirs (patched files + labelled test stubs + generated `alerts.jsonl`)
