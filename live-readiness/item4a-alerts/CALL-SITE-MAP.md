# Item 4a — Alert Call-Site Map (Warlock live system-readiness)

- **Item:** 4a — alert call-site map + heartbeat + feed-health reporting
- **Date built:** 2026-11-24 (evening CET)
- **Status:** BUILD ONLY. No QC / Security verdict is claimed here — a separate independent reviewer checks this work afterwards. **Fix round 2026-11-24 evening CET (§8):** REVIEW.md's fix-before-DONE notes N1 + N2 and Low note N9 are closed in this revision (4 diffs changed, 12 byte-identical); N3/N4/N8 remain Item 2 install gates.
- **Scope:** v1 tree `~/DLMM/audit/repo/sol-lp-bot` and v2 tree `~/apps/warlock-v2`, read from the VPS (read-only SSH) on 2026-11-24. No VPS writes were made. Code enters the VPS only later, through the rehearsal-clone install.
- **Base (pristine) trees:** fetched read-only and md5-verified — v1 `bot.js` `72ee8c539db13a0b0b6bdf88277821fe`, v1 `telegram-notify.js` `5b522922a8cfd8078876453d0ae54ac6`; v2 `bot.js` `018e2307eb819995e9e1c04cab331212`, v2 `telegram-notify.js` `fec076ea3169869ce11300e5ecfd05b3`.
- **Fork targets (for committing later, not blocking):** v1 → `baskarajati/Sol-Warlock-Meteora-LP-Bot`, v2 → `baskarajati/sole-warlock-v2` (forks made by sole 2026-11-24, v1 HEAD `22a59b43`, v2 HEAD `ef66daa0` per MEMORY.md). **Caveat:** the fork contents were NOT verified against the VPS trees in this item — the coordinator/QC must confirm the fork HEADs match these pristine md5s before committing the diffs.
- **Line numbers** below are for the PATCHED files in `patched-v1/` / `patched-v2/`, unless marked "(pristine)" or "(pre-existing)".

## §1 Counts

| | v1 | v2 |
|---|---|---|
| Events in scope | 16 | 16 |
| Call site existed before this item | 0 | 4 |
| Partial (alert exists but content or routing incomplete) | 0 | 3 |
| Missing before this item | 16 | 9 |
| **Wired by this item (call site + content)** | **13** | **13** |
| **Built, caller belongs to Item 1 (see §4)** | **3** | **3** |
| Events unmapped at the end | **0** | **0** |

The 16 events: open, close, swap-back complete, swap-back fail, reshape, reposition, emergency exit, error (cycle error), kill-switch STOP, kill-switch NO_NEW, startup, daily heartbeat, circuit-breaker trip, feed-degraded, halt trip, halt reset.

**Before → after, v2 detail (the 4 existing / 3 partial / 9 missing):**

- Existing (4): open (`liveNotifyOpen`), close (`liveNotifyClose`), reposition (`liveRepositionNotify`), emergency exit (`liveNotifyClose` routes `emergency_stop` → `notifyEmergency`). All four were content-incomplete (no sigs, no running realised P&L) — fixed by this item.
- Partial (3): swap-back complete, swap-back fail (close alert fired but did not render `swapBackComplete`/`swapBackErrors`, and sigs never reached the row), kill-switch STOP (close alerts with reason `STOP file` only when a position was open; silent when flat; no distinct kill-switch alert).
- Missing (9): reshape (deliberate stub — see §5), error in the live loop, kill-switch NO_NEW, startup, daily heartbeat, circuit-breaker trip, feed-degraded, halt trip, halt reset.

**v1 detail:** 0 existing / 0 partial / 16 missing. Paper call sites exist in v1 (`bot.js:1329, 1358, 1496, 1822` open; `1755, 1821` close/emergency; `1666` reshape gated on `CFG.NOTIFY_RESHAPE`; `1790` reposition; `1990` window end; `1992, 2495` daily; `2451` startup; `2456` capital change; `2482` cycle error) — but the live paths (`liveOpen`, `liveOpenUsdcPool`, `liveClose`, `livePositionCycle`, `liveCycle`, live main loop) contained **no notify calls at all**. Paper notifiers are reused; live call sites are new.

## §2 The table

`→` = status before this item → after. "Wired" = call site added and content added. "Specified" = alert function built, caller is Item 1's code (see §4).

| # | Event | v1 — notify function → location (patched) | v1 before → after | v2 — notify function → location (patched) | v2 before → after |
|---|---|---|---|---|---|
| 1 | Open | `notifyOpen` via new `liveAlertOpen` — `bot.js:2049` (helper), called `bot.js:2124` (SOL) and `:2159` (USDC) | missing → **wired** | `notifyOpen` via `liveNotifyOpen` — `bot.js:1950` (def), called `:2120` (SOL) and `:2157` (USDC) | existing → **wired (content added)** |
| 2 | Close | `notifyClose` — `bot.js:2230` (in `liveClose`) | missing → **wired** | `notifyClose` via `liveNotifyClose` — `bot.js:1982` (def), called from `finishLiveClose` `:2361` and `liveCloseSol` `:2408` | existing → **wired (content added)** |
| 3 | Swap-back complete | rendered inside the close alert (`closeBody`, `telegram-notify.js`) — sigs from `live-close-exec.js` `swapBack` | missing → **wired** | rendered inside the close alert (`closeHtml`, `tg-format.js:46–49`) — sigs from `live-close-exec.js` `swapBack`/`swapBackSol` | partial → **wired** |
| 4 | Swap-back fail | same as #3 + `swapBackComplete === false` warning line; leftover retried every cycle (v2 pending-sell alerts later) | missing → **wired** | same as #3 (`tg-format.js:47`); v2 pending-sell failure after 3 tries alerts via pre-existing raw `notifyTg` (`bot.js:2796` pristine) | partial → **wired** |
| 5 | Reshape | `notifyReshape` — `bot.js:2411`, unconditional for v1 live (plan §7.1: every live trade event alerts) | missing → **wired** | `notifyReshape` — `bot.js:2653`, **gated on `CFG.NOTIFY_RESHAPE === true`** (default `false`) | missing (stub) → **wired but gated OFF by default — see §5** |
| 6 | Reposition | `notifyReposition` — `bot.js:2385` (success); failed reopen → `notifyClose(rr.row)` (`:2387`) since it is booked as a normal close | missing → **wired** | `notifyReposition` / `notifyRepositionFailed` via `liveRepositionNotify` — `bot.js:1970` (def), called from `live-reposition-exec.js` | existing → **wired (duplicate-alert defect fixed, §5)** |
| 7 | Emergency exit | `notifyEmergency` — `bot.js:2230` (`reason === 'emergency_stop'` routes there) | missing → **wired** | `notifyEmergency` — `liveNotifyClose` `:1982` routes `emergency_stop` there | existing → **wired (content added)** |
| 8 | Error (cycle error) | `notifyError` — live main loop `bot.js:2607`; crash handlers via `installProcessHandlers` (`:2600`) | missing → **wired** | `notifyError` — live main loop `bot.js:3018`; crash handlers via `installProcessHandlers` (`:3010`) | missing → **wired** |
| 9 | Kill-switch STOP | `notifyKillSwitch({kind:'STOP'})` — `bot.js:2445`, once per episode (`state.killSwitchNotified`) | missing → **wired** | `notifyKillSwitch({kind:'STOP'})` — `bot.js:2827`, once per episode | partial → **wired** |
| 10 | Kill-switch NO_NEW | `notifyKillSwitch({kind:'NO_NEW'})` — `bot.js:2450`, once per episode | missing → **wired** | `notifyKillSwitch({kind:'NO_NEW'})` — `bot.js:2829`, once per episode | missing → **wired** |
| 11 | Startup | `notifyStartup(statusFromLiveState(...))` — live main loop `bot.js:2601` | missing → **wired** | `notifyStartup(statusFromLiveState(...))` — live main loop `bot.js:3012` | missing → **wired** |
| 12 | Daily heartbeat | `maybeDailySummary(statusFromLiveState(...))` — live main loop `bot.js:2612` (21:00 WIB gate) | missing → **wired** | `maybeDailySummary(statusFromLiveState(...))` — live main loop `bot.js:3025` (21:00 WIB gate) | missing → **wired** |
| 13 | Circuit-breaker trip | `notifyHalt` — `telegram-notify.js:722` (v1) | missing → **specified (Item 1 caller)** | `notifyHalt` — `telegram-notify.js:800` (v2) | missing → **specified (Item 1 caller)** |
| 14 | Feed-degraded | `notifyFeedDegraded` — `bot.js:2459` (fires at 3 consecutive stale reads) | missing → **wired** | `notifyFeedDegraded` — `bot.js:2839` (same threshold) | missing → **wired** |
| 15 | Halt trip | `notifyHalt` — `telegram-notify.js:722` (v1) | missing → **specified (Item 1 caller)** | `notifyHalt` — `telegram-notify.js:800` (v2) | missing → **specified (Item 1 caller)** |
| 16 | Halt reset | `notifyHalt({reset:true})` — `telegram-notify.js:722` (v1) | missing → **specified (Item 1 caller)** | `notifyHalt({reset:true})` — `telegram-notify.js:800` (v2) | missing → **specified (Item 1 caller)** |

### Notes on rows

- **#3/#4 (swap-back):** there is deliberately NO separate swap-back alert. The close alert IS the swap-back report: it carries `swapBackComplete`, `swapBackErrors`, the swap sigs, and (v2) the pending-sell estimate flag. A separate message would double-alert every close.
- **#5 (v2 reshape):** the wiring is built and the notifier is real, but the call site is gated on `CFG.NOTIFY_RESHAPE === true` and the flag defaults to `false` (`paper-settings.js:32`). Until the operator flips the flag, v2 live reshapes stay silent — by the operator's own decision, not by omission. See §5.
- **#6 (v2 duplicate-alert defect, fixed):** before this item, a reposition reopen fired BOTH `liveNotifyOpen` (the reopen passed no `intermediate` flag) and `notifyReposition` — two alerts for one economic event. Fixed by passing `intermediate: true` in the reposition reopen (`live-reposition-exec.js`, both bots; v1 `liveOpen` already honoured `opts.intermediate` for the notify guard, v2 `liveOpen` uses it only for the notify guard — verified by grep). v1 paper avoided this with `silent:true`; v1 live now matches.
- **#8 (error):** `notifyError` has a 5-minute cooldown per key in both bots (pre-existing). A crash loop therefore alerts at most once per 5 minutes per distinct error — by design, not a gap.
- **#9/#10 (kill-switch):** the per-position closes alert separately with reason `STOP file`; `notifyKillSwitch` is the event-level alert (once per episode, flags on state, reset when the file disappears). When flat and STOP appears, only the event alert fires (there is no position to close) — this is the case v2 previously missed entirely.
- **#13/#15/#16 (breaker / halt):** see §4. The alert functions exist and are exported; no trip code exists to call them yet.
- **Not alerted, by judgement (recorded, not omitted silently):**
  - v2 `liveClose` early return for a never-funded position (`bot.js:2257` pristine: `depositSol` 0, rent back only) — no funds at risk, logged only. Reviewer to confirm.
  - v2 `finishGhostClose` (interrupted close finished without the position account): alerts via the pre-existing raw `notifyTg` (`bot.js:2533` pristine, "interrupted close finished"); `opts` is `{}` so `quoted` is null — accepted, noted here.
  - v1/v2 reshape `resumePending` completion: log-only (it completes an already-alerted reshape).
  - v2 reconcile events (unknown/adopted positions, `bot.js:2677–2708` pristine) and pending-sell failure (`:2796` pristine) and state-unreadable startup fallback (`:2971` pristine): pre-existing raw `notifyTg` sends. This item adds the `[LIVE-v2]` prefix to all of them (via `notifyTg`) but does not restructure them — they are not in the 16-row scope.

## §3 Content minimum — per alert

Minimum per alert (plan §7.1): `[LIVE]` / `[LIVE-v2]` prefix, pool/token, direction, size (USDC/SOL in, out), realised P&L in native units and %, reason, transaction signature(s) where available, running live realised P&L.

| Alert | Prefix | Pool/token | Direction | Size in/out | Realised PnL native + % | Reason | Tx sig(s) | Running realised |
|---|---|---|---|---|---|---|---|---|
| v1 `notifyOpen` | `[LIVE]` (pre-existing `PREFIX`, correct) | ✓ (pool + name) | ✓ (open) | ✓ (USDC in, deposit SOL) | n/a (open) | ✓ (`openContext`/source) | **added** (`dep.sigs`, `telegram-notify.js` short-sig line) | **added** (`runningRealisedUsd`) |
| v1 `notifyClose` / `notifyEmergency` | `[LIVE]` | ✓ | ✓ (close) | ✓ (USDC in → out) | ✓ (native + %) | ✓ incl. **added `STOP file` mapping** (paper-history has no `'STOP file'` case — it returned `'tidak diketahui'`) | **added** (close remove/claim sigs + swap sigs) | **added** |
| v1 `notifyReshape` | `[LIVE]` | ✓ | ✓ | ✓ (token re-add X, compounded) | n/a | ✓ | **added** | n/a |
| v1 `notifyReposition` | `[LIVE]` | ✓ | ✓ | ✓ (leg in/out) | ✓ (leg) | ✓ | **added** (`sigs: legRow.sigs` passed at `bot.js:2385`; rendered by `notifyReposition`, `telegram-notify.js:656` — fix round §8) | **added** (`runningRealisedUsd: liveRealisedUsd(state)` at `bot.js:2385`) |
| v1 `notifyKillSwitch` / `notifyHalt` / `notifyFeedDegraded` | `[LIVE]` | n/a (event-level) | n/a | n/a (open count + names) | n/a | ✓ (kind / criterion / figures) | n/a | n/a |
| v1 `notifyError` / `notifyStartup` | `[LIVE]` | n/a | n/a | n/a | startup: **added** cumulative realised | n/a | n/a | startup ✓ |
| v1 `notifyDailySummary` | `[LIVE]` | ✓ (per-position lines) | n/a | ✓ | ✓ (today + total) | n/a | n/a | ✓ (total) + feed-health lines |
| v2 `notifyOpen` | **`[LIVE-v2]` (changed from `[LIVE]`)** | ✓ | ✓ | ✓ | n/a | ✓ | **added** (`dep.sigs` via `liveNotifyOpen`, `tg-format.js:76`) | **added** (`runningRealisedUsd`, `tg-format.js:77`) |
| v2 `notifyClose` / `notifyEmergency` | **`[LIVE-v2]`** | ✓ | ✓ | ✓ | ✓ (SOL-first) | ✓ (`closeReasonOf` / `closeReasonText`) | **added** (`tg-format.js:48`) | **added** (`tg-format.js:49`) |
| v2 `notifyReshape` | **`[LIVE-v2]`** | ✓ | ✓ | ✓ (token re-add X, fee) | n/a | ✓ | **added** (`tg-format.js:137`) | n/a |
| v2 `notifyReposition` / `notifyRepositionFailed` | **`[LIVE-v2]`** (card renders `🔴 [LIVE-v2]` via `mode()` — fix round §8) | ✓ | ✓ | ✓ (leg + proceeds) | ✓ (leg) | ✓ | **added** (event carries `sigs: leg.row.sigs` from `live-reposition-exec.js`; rendered in `repositionHtml` + `repositionFailedHtml`, `tg-format.js:106,122`) | — (v2 reposition card has no running-realised line; the leg close is intermediate, so no running total is booked at that point) |
| v2 `notifyKillSwitch` / `notifyHalt` / `notifyFeedDegraded` | **`[LIVE-v2]`** | n/a | n/a | n/a | n/a | ✓ | n/a | n/a |
| v2 `notifyError` / `notifyStartup` | **`[LIVE-v2]`** | n/a | n/a | n/a | startup: **added** cumulative realised | n/a | n/a | startup ✓ |
| v2 `notifyDailySummary` | **`[LIVE-v2]`** (card renders `🔴 [LIVE-v2]` via `mode()`; text-path raw sends carry the `[LIVE-v2]` prefix) | ✓ | n/a | ✓ | ✓ (todayAgg) | n/a | n/a | ✓ (total) + feed-health lines |

### What renders where — the `[LIVE]` / `[LIVE-v2]` prefix, stated exactly (fix round, §8)

- **v1 text alerts:** the literal `[LIVE]` from the pre-existing `PREFIX` constant (`telegram-notify.js:23`, live when `DRY_RUN=0` and `PAPER!=1`).
- **v2 text-path alerts** (kill-switch, halt, feed-degraded, error, startup, raw `notifyTg` sends): the literal `[LIVE-v2]` from the `PREFIX` constant (`telegram-notify.js:27`).
- **v2 card-path alerts** (open / close / reshape / reposition / reposition-failed / daily / period / history cards): the caption HTML renders `🔴 [LIVE-v2]` via `tg-format.js` `mode(paper)` (live branch `🔴 [LIVE-v2]`, paper branch `🧪 DRY RUN`). Before the fix round this was `🔴 LIVE` with no literal marker — a v1 `🔴 LIVE` card and a v2 `🔴 LIVE` card were indistinguishable. The PNG card itself (`warlock-card.js`) carries no version marker; only the caption does.
- **v2 `notifyTg` raw sends** additionally prepend `[LIVE-v2] ` (verified in the reviewer's smoke).

### How sigs now flow (the part that was broken before)

- **Open:** `live-open-exec.js` `openDeposit` now returns `sigs[]` (every `send()` return collected, incl. the v2 `sendLeg` chunk sends). `liveOpen`/`liveOpenUsdcPool` pass `dep.sigs` to the open alert.
- **Close remove/claim:** v2 `bot.js` already collected `pos.closeSigs` via the `onSig` hook (`:2276`) — but `clearCloseMarks(pos)` deleted `closeSigs` BEFORE the history row was built in `finishLiveClose`/`liveCloseSol`, so sigs never reached the row or alert. Fixed: captured into a local `closeSigs` before clearing (v2 `bot.js:2355`, `:2402`). v1 `liveClose` collects `closeSigs` the same way (`bot.js:2205`).
- **Close swap-back:** `live-close-exec.js` `swapBack`/`swapBackSol` now return `sigs[]` (Jupiter swap results carry `.sig`; guarded by `if (r.sig)`). Row `sigs = [...closeSigs, ...sb.sigs]`.
- **Reshape:** `live-reshape-exec.js` `reshape` returns `sigs[]`; `readd()` returns its sigs.
- **Reposition (fix round, §8):** v1's success-path call passes `sigs: legRow.sigs` + `runningRealisedUsd`; v2's `live-reposition-exec.js` event carries `sigs: leg.row.sigs` (remove/claim + swap-back sigs from the intermediate close row) and both `repositionHtml` and `repositionFailedHtml` render a shortened-sig `🔗 Tx` line.
- **Running realised:** new helpers `liveRealisedUsd` / `liveRealisedSol` (v1 `bot.js`, v2 `bot.js`) sum history `pnlUsd` / SOL-capital `pnlCapital`. Computed AFTER the history push, so the close's own PnL is included. Before this item, `statusFromState` read the paper books (`state.books.N5`) — a live state has none, so it would have reported zero trades and zero PnL. New `statusFromLiveState` (v1 `telegram-notify.js:913`, v2 `:929`) reads live `positions[]` + `history[]` instead.

### Wording fixes (both bots)

- `notifyError` / `notifyStartup` / `notifyWindowEnd` hardcoded dry-run wording ("Live tidak dijalankan", "Window dry run sudah berakhir") — false on live. `notifyError` and `notifyStartup` are now live-aware (live branch when `status.live` / `IS_LIVE`). `notifyWindowEnd` is a paper-only notifier and was left alone.
- v2 `notifyTg` (raw sends) now prepends `[LIVE-v2] `; `notifyPartialShape` dropped its hardcoded `[LIVE]` (it would otherwise read `[LIVE-v2] ⚠️ [LIVE] Open …`); the state-unreadable fatal `telegram.send` gains the `[LIVE-v2]` prefix. All `notifyTg` call sites are live-only (verified), so the unconditional prefix is safe.
- v1 `notifyDailySummary` positions map is guarded: live positions have no `bins`, so `quotePnl.fromPosition(pos)` would value the position at 0 — a fake huge loss. The map now skips the quote-PnL fragment when `format()` returns `'PnL quote belum tersedia'`. (v2's `dailySummaryHtml` already had this guard.)
- v2 `closeHtml`/`openHtml` previously had no sigs / running-total / estimate-flag lines; added (`tg-format.js:46–49`, `:76–77`). v2 `dailySummaryHtml` gains a fees-paid line + feed-health lines (`:192–193`).
- Live close rows now carry `riskPolicyVersion: 'net-usdc-v2-quote-wait10'` (both bots), so `emergency_stop` no longer renders the old-rule text, and `quoted` / `valuationBasis` (v2 derives `valuationBasis` from `quoted`; v1 takes `opts.val.valuationBasis` when the decision val carries it, else null). `decisionVal` is passed to the close as `{val: decisionVal}` (v1 `bot.js`, v2 `bot.js:2649` — previously `liveClose` was called without it, so the row could not know whether the exit was valued on a live quote or an on-chain estimate).

## §4 Gaps for Item 1 (not built here — recorded, not improvised)

| # | Gap | Detail |
|---|---|---|
| G-1 | No circuit-breaker / daily-loss / halt code exists in either tree | Grep for breaker/daily-loss/halt returns nothing outside tests. The trip/detection code (K1–K9 accounting, latch, `STOP`/`NO_NEW` writes, reset procedure) is Item 1's (plan §3.1). This item built ONLY the alert functions `notifyHalt` (+ `notifyKillSwitch`/`notifyFeedDegraded`) and the exact insertion points below. Do NOT build trip detection here — that would duplicate Item 1 and risk conflicts. |
| G-2 | Halt/breaker insertion points for Item 1 | Call `telegram.notifyHalt({ criterion, figures })` at the trip point (criterion e.g. `K1`, `K5`, `daily-loss`; figures = the numbers that tripped it, e.g. `leg -0.4 SOL`), and `telegram.notifyHalt({ criterion, reset: true })` at the manual reset. The functions are exported from `telegram-notify.js` in both bots. Until Item 1 lands, `notifyHalt` has no caller — that is expected, not a defect. |
| G-3 | Feed-RULE code is Item 1's (plan §3.1.7) | This item owns feed-health REPORTING (metrics) only. The stale-feed no-open rule, the `NO_NEW` write on feed degradation, on-chain-estimate flagging and never-close-on-guessed-price are NOT built here. The feed-degraded ALERT (3 consecutive stale reads) IS wired, because detection (stale-read counting) is mine; the enforcement stays Item 1's. The alert text says this plainly. |
| G-4 | Feed-degraded threshold is an approximation | 3 consecutive stale `solUsd()` *reads* (≈1–3 polls depending on open positions, since `solUsd()` is called per position per cycle plus once per cycle). Item 1 defines the poll-precise rule for the `NO_NEW` enforcement. |
| G-5 | Reposition alerts carry no tx sigs (and v1 success path no running realised) — **FIXED in the fix round (§8)** | Was: the leg's sigs lived on the close row, which the reposition alert did not re-render. Now: v1 passes `sigs: legRow.sigs` + `runningRealisedUsd: liveRealisedUsd(state)` at `bot.js:2385` and `notifyReposition` renders both; v2's reposition event carries `sigs: leg.row.sigs` and `repositionHtml` / `repositionFailedHtml` render the shortened-sig line. |
| G-6 | Fees PAID cannot be summed for live | Live close rows have no `swapCostUsd`/`gasUsedSol` fields (paper rows do). The heartbeat therefore reports fees paid as "not recorded per leg (live rows do not store swap/gas costs)" until live rows record costs. This is a data gap, not an alert gap — flag for the owner of live-row fields. |
| G-7 | v1 RPC errors/hour has no in-process counter | v1 uses a direct web3.js `Connection` (single URL, no fetch wrapper), so there is nowhere to count. The 6h-check spec (HEARTBEAT-AND-CHECK-RULE.md §2) defines v1 RPC errors/hour via `bot.log` pattern-counting instead. v2 counts it in `rpc-config.js` `makeFetch` (429 / 5xx / network → `feed-health.recordRpcError()`). |

## §5 Operator decisions & judgements (stated, not improvised)

1. **v2 reshape silence is preserved, not overridden.** The stub was a deliberate operator decision (t238u: too noisy; `test-tg-reposition-notify.js:39` asserts reshape is silent). The diff un-stubs `notifyReshape` into a real implementation BUT gates the call site on `CFG.NOTIFY_RESHAPE === true`, default `false` (`paper-settings.js:32`). Net effect today: zero behaviour change for v2 reshapes. The operator flips one flag to re-enable. **QC must update `test-tg-reposition-notify.js`** (it encodes the old silence decision and will fail after the un-stub).
2. **v1 reshape alerts unconditionally.** Plan §7.1 says every live trade event alerts; v1 has no operator silence decision on record, so the v1 call site is unconditional.
3. **Halt/breaker call sites cannot be wired yet** (G-1/G-2 above) — the exception is honest and explicit: alert functions built + insertion points specified, no trip detection built.
4. **Alert failure is recorded, not retried.** `send()` resolves `{ok:false}` on failure with no retry and no persistence (pre-existing). This item adds the outcome log (`alerts.jsonl`, rotation at ~200 KB keeping the last 1,000 lines) and the daily heartbeat + 6h-check rule as the backstop (HEARTBEAT-AND-CHECK-RULE.md). A retry queue was NOT built: it would change delivery ordering under the 2 s gap / 25-deep queue and belongs to a separate reliability decision.
5. **Ghost closes / empty-position closes:** see §2 notes. Judgement calls, flagged for the reviewer.
6. **Quote-wait counting edge:** `recordQuoteWait(polls)` increments the event count only when `polls === 1` (first failed poll of a streak) and tracks the max. If the position's `quoteUnavailablePolls` field is missing, the caller passes 0, which counts as a first-poll event — a 1-count overstatement per streak at most; accepted and noted.
7. **`notifyWindowEnd` left paper-only.** It is not a live event; no live call site was added.
8. **Mini App `notifyLiveChange` route is NOT a bot-path alert.** It exists (`miniapp/server.js:224–234`, arm/start/stop/no-new) but the Mini App is disabled at install, so it is not counted as a live call site in this map.

## §6 Diffs index & verification evidence

Diffs in `diffs/` (unified, against the pristine trees above; see `diffs/DIFFS-README.md` for fork targets and apply instructions):

| Diff | File | Lines |
|---|---|---|
| `v1-bot.js.diff` | v1 `bot.js` | 263 |
| `v1-telegram-notify.js.diff` | v1 `telegram-notify.js` | 253 |
| `v1-feed-health.js.diff` | v1 `feed-health.js` (NEW) | 109 |
| `v1-live-open-exec.js.diff` | v1 `live-open-exec.js` | 44 |
| `v1-live-close-exec.js.diff` | v1 `live-close-exec.js` | 26 |
| `v1-live-reshape-exec.js.diff` | v1 `live-reshape-exec.js` | 54 |
| `v1-live-reposition-exec.js.diff` | v1 `live-reposition-exec.js` | 19 |
| `v2-bot.js.diff` | v2 `bot.js` | 213 |
| `v2-telegram-notify.js.diff` | v2 `telegram-notify.js` | 224 |
| `v2-tg-format.js.diff` | v2 `tg-format.js` | 70 |
| `v2-feed-health.js.diff` | v2 `feed-health.js` (NEW) | 109 |
| `v2-live-open-exec.js.diff` | v2 `live-open-exec.js` | 61 |
| `v2-live-close-exec.js.diff` | v2 `live-close-exec.js` | 59 |
| `v2-live-reshape-exec.js.diff` | v2 `live-reshape-exec.js` | 62 |
| `v2-live-reposition-exec.js.diff` | v2 `live-reposition-exec.js` | 28 |
| `v2-rpc-config.js.diff` | v2 `rpc-config.js` | 18 |

**Verification performed in this build (evidence, not claims):**

- `node --check` passes on every patched file (v1: `bot.js`, `telegram-notify.js`, `feed-health.js`, all 4 executors; v2: `bot.js`, `telegram-notify.js`, `tg-format.js`, `feed-health.js`, all 4 executors, `rpc-config.js`).
- All 16 diffs apply cleanly with `patch -p0 --batch` against fresh copies of the pristine trees and reproduce the patched trees byte-for-byte (`diff -r` identical, including the two new `feed-health.js` files).
- Smoke test v1 (isolated dir, no token): `statusFromLiveState` computes realised PnL correctly (5 + −2 = 3); `notifyKillSwitch` / `notifyHalt` / `notifyFeedDegraded` / `notifyDailySummary` all resolve `{ok:false, skipped:'token not set'}` and every outcome is appended to `alerts.jsonl`; `lastAlert()` returns the newest entry.
- Smoke test v2 (isolated dir, no token, full tree deps): same as v1, plus `notifyReshape` now sends (was a stub), `closeHtml` renders the estimate flag, swap-back-incomplete warning, shortened sigs and running realised (`+ $3.00`), `openHtml` renders sigs + running realised, `statusFromLiveState` `todayAgg` builds via `pnl-period.aggregate` (2 trades).
- `feed-health.js` unit smoke: 2 CoinGecko 429s counted, quote-wait event counted once for polls 1/3/10 with max 10, stale counter reset by a fresh price.
- NOT verified here (for the reviewer / rehearsal clone): end-to-end alert delivery to Telegram (no token in this build), alert latency ≤5 min on the clone, the 6h-check rule firing on a deliberately dropped alert, and the fork-HEAD match (see header caveat).

## §7 Files in this item

- `CALL-SITE-MAP.md` (this file)
- `HEARTBEAT-AND-CHECK-RULE.md` — daily heartbeat spec + 6h-check alert-flow rule + feed-health reporting spec
- `diffs/` — 16 unified diffs + `DIFFS-README.md`
- `pristine-v1/`, `pristine-v2/` — the base trees as read from the VPS (reference only; `ref-deps-v2/` holds extra v2 modules fetched only as smoke-test dependencies, not part of any diff)
- `patched-v1/`, `patched-v2/` — the patched working copies (diffs are the deliverable; these are the working copies they were generated from)
- `review-runs/` — reviewer evidence (`REVIEW.md`, `qa-reproduction.log`, `smoke-v1/v2.log`) plus this fix round's own runs (`fix-qa-reproduction.log`, `fix-smoke-v1.log`, `fix-smoke-v2.log`; scripts `run-fix-qa.sh`, `run-fix-smoke.sh`, `setup-fix-smoke.sh`, `smoke-fix-v1.js`, `smoke-fix-v2.js`)

## §8 Fix round — REVIEW.md notes N1, N2, N9 (2026-11-24 evening CET)

Independent review gave QA PASS, QC FAIL (narrow), Security PASS WITH NOTES. This round closes the two fix-before-DONE notes plus the Low doc note riding along. N3/N4/N8 are Item 2 install gates, not touched here; N5/N6/N7/N11/N12/N13 are accepted in writing — no code change.

### N1 (Medium) — v2 card-path alerts now render the literal `[LIVE-v2]`

- **Fix:** `patched-v2/tg-format.js:10` — `mode()` live branch changed from `'🔴 LIVE'` to `'🔴 [LIVE-v2]'` (paper branch unchanged, `'🧪 DRY RUN'`). Every card-path render goes through `mode()`, so open / close / reshape / reposition / reposition-failed / daily / period / history cards all now carry the literal marker in their caption HTML. Text-path alerts were already correct via the `PREFIX` constant and are untouched.
- **Map correction:** §3 now states exactly what renders where ("What renders where" paragraph above): card path `🔴 [LIVE-v2]`, text path `[LIVE-v2]` via `PREFIX`, v1 text `[LIVE]`. The old §3 claim (`[LIVE-v2]` for the card rows, with the daily row saying "via `mode()` → `🔴 LIVE`") was wrong and is corrected.
- **Proof:** `review-runs/smoke-fix-v2.js` — `mode(false) === '🔴 [LIVE-v2]'`, all six live card renders contain `[LIVE-v2]` and none matches bare `🔴 LIVE`; paper render still `🧪 DRY RUN` with no `[LIVE-v2]`. 29/29 checks pass (`fix-smoke-v2.log`, exit 0).

### N2 (Medium, G-5) — reposition alerts now carry tx sigs

- **v1:** `patched-v1/bot.js:2385` — success-path `notifyReposition` call now passes `sigs: legRow.sigs` and `runningRealisedUsd: liveRealisedUsd(state)` (matching the failed-reopen path at `:2387`, which already passed running realised via `notifyClose`).
- **v1 renderer correction (reviewer premise corrected):** REVIEW.md §2.3c states v1 `notifyReposition` "already renders sigs if passed (`telegram-notify.js:631`)". That line is inside `notifyOpen`, not `notifyReposition` — `notifyReposition` (patched `telegram-notify.js:656–663`, pristine `:624`) rendered neither sigs nor running realised. Passing sigs alone would have rendered nothing, so this round also adds the two splice lines to `notifyReposition` (same pattern as `notifyOpen`/`notifyReshape`: `🔗 Tx: <shortSigList>` + `📈 Realisasi kumulatif (live)` before the dry-run note). This is why `v1-telegram-notify.js.diff` is a fourth changed diff.
- **v2:** `patched-v2/live-reposition-exec.js:57` — the reposition `event` now carries `sigs: (leg.row && Array.isArray(leg.row.sigs)) ? leg.row.sigs.filter(Boolean) : []` (remove/claim + swap-back sigs from the intermediate close row). `patched-v2/tg-format.js:106,122` — `repositionHtml` and `repositionFailedHtml` both render a shortened-sig `🔗 Tx` line (`Repo…1111` style, same `short()` as the close card). The failed-reopen card gets the line too because it is the only alert for that close (no separate close alert fires on the intermediate leg). v2 reposition has no running-realised line: the leg close is intermediate, so no running total is booked at that point.
- **Caught during this round:** the first edit put the `// Item 4a fix N2` comment mid-line in the exec's event literal, which would have commented out `reason: deps.reasonText` (valid JS, silently wrong — `node --check` passed). Spotted on re-read of the regenerated diff, fixed by moving the comment to end-of-line, and guarded by a smoke check asserting `event.reason` survives (`smoke-fix-v2.js`, "exec event keeps the reason").
- **Proof:** `review-runs/smoke-fix-v1.js` — `notifyReposition` with sigs renders `RepoSigA…1111, SwapSigB…2222` + `Realisasi kumulatif (live): $8`; without sigs no `🔗 Tx` line; 11/11 checks pass (`fix-smoke-v1.log`, exit 0). `review-runs/smoke-fix-v2.js` — `live-reposition-exec.reposition()` end-to-end with stubbed deps: success and failed-reopen events both carry the leg sigs, rendered cards show `Repo…1111`/`Swap…2222` + `[LIVE-v2]`; 29/29 checks pass. One first-run failure in this round was the smoke harness's own, not the build: the runner initially omitted the reviewer's `DRY_RUN=0 PAPER=0` env, so the v1 notifier rendered `[DRY RUN]` and one assertion expected `$8.00` where v1 `fmtUsd` renders `$8` — both fixed in the harness (`run-fix-smoke.sh`, `smoke-fix-v1.js`) and re-run green; the sig rendering itself passed on the first run.

### N9 (Low) — map line-number error

- **Fix:** §2 row 6, v2 column: `liveRepositionNotify` def is `bot.js:1970`, not `:1960` (1960 is `liveRepositionReason` in the patched tree; 1960 was the def in the pristine tree before the 4a diffs shifted it 10 lines). All other 26 cited lines were verified exact by the reviewer and are untouched.

### What changed, in full (diff inventory)

- **Changed diffs (4 of 16):** `v1-bot.js.diff` (263 lines, same count — one line lengthened), `v1-telegram-notify.js.diff` (248 → 253), `v2-tg-format.js.diff` (43 → 70), `v2-live-reposition-exec.js.diff` (19 → 28). Verified by md5 comparison against the pre-fix diffs: exactly these four differ; the other 12 regenerate byte-identical.
- **Untouched:** N3/N4/N8 (Item 2 gates), N5/N6/N7/N11/N12/N13 (accepted in writing), `REVIEW.md`, the track record, `HEARTBEAT-AND-CHECK-RULE.md`, all pristine trees.

### Fix-round verification (evidence, not claims)

- All 16 diffs `patch -p0 --batch --dry-run` OK and apply cleanly against fresh pristine copies, reproducing `patched-v1/` + `patched-v2/` byte-for-byte (`diff -r` IDENTICAL both trees) — `review-runs/fix-qa-reproduction.log` (script `review-runs/run-fix-qa.sh`), exit 0.
- `node --check` (node v24.22.1) passes on all 21 patched `.js` files, exit 0 throughout — same log.
- Smoke re-runs: v1 11/11, v2 29/29, both exit 0 — `review-runs/fix-smoke-v1.log`, `review-runs/fix-smoke-v2.log` (scripts `review-runs/run-fix-smoke.sh`, `setup-fix-smoke.sh`). (Count corrected 2026-11-24 by the coordinator per the close-out re-review §5.1/§5.7: the v2 harness runs 29 checks, not 28 — the log contains 29 PASS lines + the ALL PASS summary; §8 had miscounted by one, in the passing direction.)
- NOT re-proven here (same limit as the original build and review): end-to-end Telegram delivery (no token), alert latency ≤ 5 min on the clone, heartbeat / dropped-alert demonstration — all Item 2.
