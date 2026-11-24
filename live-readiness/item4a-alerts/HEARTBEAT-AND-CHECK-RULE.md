# Item 4a — Heartbeat & Check Rule (daily heartbeat + 6h-check alert-flow rule + feed-health reporting)

- **Item:** 4a — Warlock live system-readiness
- **Date:** 2026-11-24
- **Status:** BUILD ONLY — spec + code, no QC / Security verdict claimed. The 6h-check rule in §2 is a **cron-body change for later** (not a VPS write, not this item) — this document is the rule spec the cron change implements.
- **Applies to:** the future live instance (v1 and v2), after the rehearsal-clone install. Nothing here runs on paper.

## §1 Daily heartbeat

### What it is

One alert per day proving the live alert path is alive. A missing heartbeat day is itself visible — that is the point: the pristine notifier kept no record of anything it sent, so a dead Telegram path was invisible.

### When

- **21:00 WIB**, via the existing `maybeDailySummary` gate (`dailyDue()`: hour ≥ 21, once per calendar day, deduped by `lastDailySummaryDate` in the Telegram config file).
- The live main loop calls `telegram.maybeDailySummary(telegram.statusFromLiveState(state, {...}))` on every 5-second sleep step (v1 `bot.js:2612`, v2 `bot.js:3025`); the gate itself decides whether today is due. Same cadence mechanism as the paper branch — no new timer, no new cron.
- The heartbeat fires **even on a flat, no-trade day** (open count 0, no closes). A flat day still proves the bot is up and the alert path works. `maybeDailySummary` must NOT skip a live day for inactivity — v2's `maybeDailyCard` (07:00 card) does skip an inactive live day (`if (!t.closed.length && !t.open.length) continue`); the 21:00 heartbeat is the separate, always-fires signal. Do not "optimise" the heartbeat away on quiet days.

### Content (per heartbeat)

Built by `statusFromLiveState(state, extra)` — v1 `telegram-notify.js:913`, v2 `:929`. Live state is `positions[]` + `history[]`; the paper `statusFromState` reads `state.books.N5`, which a live state does not have (it would report zero trades and zero PnL — the exact failure this builder exists to prevent).

| Field | Source | Notes |
|---|---|---|
| Opens today / total trades | `history` length; today's closes via WIB-day grouping (`wibDate` on `closedAt`; v2 also `todayAgg` from `pnl-period.aggregate`) | v2 `todayAgg` reuses the same builder as the 07:00 daily card, so the two agree |
| Realised P&L today + total | Sum of history `pnlUsd` (v2 also SOL-capital `pnlCapital` via `liveRealisedSol`) | Computed after the day's last close; the close alert's own running total uses the same helpers |
| Open positions | `positions[]` (name + pool + capital asset) | Open positions are NOT valued in the heartbeat (no quote-PnL fragment — live positions have no `bins`; `quotePnl.fromPosition` would value them at 0, a fake huge loss). The heartbeat reports realised PnL + open count, not a marked equity. `equityUsd` is null by design. |
| Fees paid | `feesPaidUsd: null` | **Gap G-6:** live rows record no swap/gas costs, so the heartbeat renders "not recorded per leg (live rows do not store swap/gas costs)" until live rows record costs. Do not invent a number. |
| Feed health (rolling hour) | `feedHealth.status()` — see §3 | Rendered on the heartbeat (v1 `telegram-notify.js` daily-summary feed line; v2 `tg-format.js:192`) |
| STOP present | `fs.existsSync(<DIR>/STOP)` | So the operator sees at a glance that live is locked |
| Wallet | `REAL_WALLET` | Identity check on the startup/heartbeat path |

### Install note (not code)

The live instance must set **`TELEGRAM_CFG_FILE=<live-dir>/telegram.json`** (outside `paper/`) so the daily-summary dedup state (`lastDailySummaryDate`) does not violate the design rule that the live instance's `paper/` stays empty. If the variable is unset, the notifier falls back to its default config path — the reviewer/installer must confirm which path the live instance actually uses, or the dedup state lands in the wrong place and the heartbeat may double-fire or never fire after a restart.

### Missing-heartbeat rule

- If no heartbeat alert is observed for a calendar day (WIB) on which the live instance was supposed to be running, the 6h check flags it the same way as a trade-without-alert (§2): **investigate the alert path first, the bot second** — a silent bot and a dead Telegram path look identical from the outside, and the heartbeat exists to tell them apart.

## §2 6-hourly check — alert-flow rule

This rule is implemented as a **change to the 6h-check cron body** (later, by the track coordinator — not a VPS write, not this item). This section is the exact spec.

### Sources (both must exist; if either is missing, that is itself a flag)

1. **Last-alert timestamp:** the last line of `<live-instance-root>/alerts.jsonl`, written by `recordAlertOutcome` in `telegram-notify.js` (both bots) on EVERY `send()` / `sendPhoto()` outcome — success or failure. Format per line: `{"ts": "<ISO>", "ok": true|false, "error": "<redacted>|null", "skipped": "<reason>|null", "messageId": <id>|null}`. Read it with the exported `lastAlert()` helper where the check runs in-process, or by reading the file's last line. Rotation: trimmed to the last 1,000 lines past 200 KB, so the file always has a tail.
2. **Last-trade timestamp:** the last `closedAt` in live `state.json` `history[]` (and, for opens, the last `openedAt` in `positions[]`). The state file is the source of trade truth, not the bot log.

### Rule

> **For every live trade (open or close) in `state.json`, there must be a corresponding alert in `alerts.jsonl` within 5 minutes of the trade timestamp. A trade with no alert inside 5 minutes is flagged immediately (not at the next 6h boundary — the check runs every 6 hours, but the flag is raised as soon as the check sees it).**

Concretely, at each 6h check:

1. Read the last trade timestamp `T_trade` (latest `closedAt`, else latest `openedAt`) and the last alert timestamp `T_alert` (last `alerts.jsonl` line with `"ok": true`).
2. If `T_trade` is newer than `T_alert` by more than 5 minutes → **FLAG: trade without alert**. Include the trade (pool, direction, time) and the last alert's timestamp and outcome.
3. If the last `alerts.jsonl` line has `"ok": false` → **FLAG: alert path failing**, with the recorded `error`/`skipped` value. (A token-not-set or queue-full outcome is a finding, not background.)
4. If `alerts.jsonl` does not exist or is empty while `history` is non-empty → **FLAG: alert logging missing** (the notifier may be an unpatched build).
5. If no heartbeat was observed for the previous calendar day (WIB) while the instance was supposed to be running → **FLAG: missing heartbeat** (§1).
6. Compare the feed-health snapshot in `status.json` (`feedHealth`, written by `writeLiveStatusPointer` on live only) against the paper baseline (§3). Worse than baseline → **FLAG: feed health degraded** (a finding, not background).

### Deliberately-dropped-alert demonstration (required on the clone)

Before the live instance is declared alert-ready, the rehearsal clone must demonstrate the rule works end to end:

1. Run the clone, let it make at least one paper-twin trade (or inject a synthetic history row with a fresh `closedAt`).
2. Deliberately drop the alert (e.g. point the clone at a revoked token, or stop its Telegram path) while the trade lands in `state.json`.
3. Confirm the next 6h check flags **trade-without-alert inside 5 minutes** (per the rule above) and that the flag names the trade and the last alert.
4. Restore the alert path, confirm the next heartbeat arrives, and confirm the flag clears on the following check.

If the demonstration cannot flag a dropped alert, the alert-flow rule is not proven and the live instance is not alert-ready — regardless of how many alerts were observed to arrive.

### v1 RPC errors/hour (no in-process counter)

v1 has no fetch wrapper around its RPC `Connection`, so `feedHealth.rpcErrors` is always 0 for v1. For v1, the 6h check counts RPC errors from `bot.log` instead: count lines matching `rpc` + (`429` | `rate limit` | `timeout` | `ECONN` | `fetch failed`) in the last hour. If the count is materially above the v2-measured rate for the same hour, flag it as feed degradation. (v2 counts RPC errors in-process — see §3.)

### What the rule does NOT do

- It does not retry alerts and does not page anyone by itself. It flags; escalation follows the Oversight ladder.
- It does not read the Telegram chat to confirm delivery — `alerts.jsonl` records what the notifier *attempted and what Telegram's API returned* (`ok` / `messageId`). A `messageId` is delivery to Telegram's API, not a read receipt. That is the honest boundary of what this item can prove.

## §3 Feed-health reporting spec

### Metrics (per check, rolling 60-minute window)

Produced by `feed-health.js` (new file in both trees, reporting only — it counts, it never gates a trade) and surfaced in the daily heartbeat and in `status.json` (`feedHealth`, live only).

| Metric | Counter | Where counted | Baseline (paper, 24 Nov 2026) |
|---|---|---|---|
| CoinGecko 429 / hour | `coingecko429` | `solUsd()` catch, both bots (`/429/.test(e.message)`) | **~90 / hour / instance** |
| Jupiter 429 / hour | `jupiter429` | live `jupiterQuote` catch, both bots (`/429/.test(e.message)`) | ~85 / hour keyless on lite-api (`jupiter-config.js:3` note) — live path only; paper quotes go through `paper-quote-client` (whose `failures` is a *consecutive*-failures counter, not a count/hour, and is not used here) |
| RPC errors / hour | `rpcErrors` | v2: `rpc-config.js` `makeFetch` (429 / 5xx / network) → `feed-health.recordRpcError()`; v1: `bot.log` pattern-counting by the 6h check (§2) | no baseline yet — first live-clone run sets it; any sustained >0 with failover churn is a finding |
| Stale-price polls | `stalePolls` (+ `stalePollsConsecutive`, `lastFreshPriceAt`, `lastStaleAt`) | `solUsd()` returning a stale cached price (cache older than 60 s, no fresh fetch). A fresh price (CoinGecko, DexScreener, or 60 s cache hit) resets the consecutive counter. Note: a stale cached price is returned indefinitely (age unbounded) — the counter, not the return value, is what this item adds. | 0 expected on a healthy feed; ≥3 consecutive stale reads fires the feed-degraded alert |
| Quote-wait events | `quoteWaits` (+ `quoteWaitMaxPolls`) | Exit decision with `val.quoted === false` (both exit-decision points in `livePositionCycle`, both bots). The EVENT count increments only on the first failed poll of a streak (`polls === 1`); the max polls of any streak is tracked separately, so the 10-poll counter (`QUOTE_FAILURE_POLLS: 10`, `paper-settings.js:89`) is visible. | 0 expected; any quote-wait event is a finding (the exit was valued on an on-chain estimate, and the close row carries `quoted: false`) |

### Per-check table (what the 6h check reports)

| Check | Value to report | Flag if |
|---|---|---|
| CoinGecko 429 / hour | `feedHealth.coingecko429` | materially above ~90 (paper baseline) |
| Jupiter 429 / hour | `feedHealth.jupiter429` | materially above ~85, or any sustained 429 storm that coincides with quote-wait events |
| RPC errors / hour | `feedHealth.rpcErrors` (v2) / log count (v1) | any sustained rate, or failover churn (slots flipping) |
| Stale-price polls | `feedHealth.stalePolls`, `stalePollsConsecutive` | `stalePollsConsecutive ≥ 3` (already alerted) or a rising hourly count |
| Quote-wait events | `feedHealth.quoteWaits`, `quoteWaitMaxPolls` | any event; `quoteWaitMaxPolls` approaching 10 means exits are being decided on estimates near the policy limit |

### Rules

- **If live feed health is worse than the paper baseline, that is a finding, not background.** Report the numbers, the baseline, and the delta — do not normalise it away as "the feed is always like this".
- Counters are in-memory rolling-60-minute buckets; **a bot restart resets them**. The heartbeat reports what it saw this hour. A restart followed by a quiet hour is not evidence of a healthy feed — note restarts in the check.
- `feed-health.js` contains no trading rule. The stale-feed no-open rule, the `NO_NEW` write on degradation, on-chain-estimate flagging and never-close-on-guessed-price are plan §3.1.7 and belong to Item 1. If a future reader is tempted to gate a trade on these counters, that is Item 1's decision, not this module's.
- The feed-degraded alert threshold (3 consecutive stale reads) is an approximation (≈1–3 polls depending on open positions). Item 1 defines the poll-precise rule for enforcement.

## §4 Alert-failure handling (how a failed alert behaves)

- `send()` resolves `{ok:false}` on failure (timeout 15 s, queue full at 25, token missing). No retry, no persistence of the unsent message — by design (see CALL-SITE-MAP.md §5.4). The failure IS recorded in `alerts.jsonl` with its reason, so the 6h check can see it.
- `notifyError` has a 5-minute cooldown per distinct error key — a crash loop alerts at most once per 5 minutes per error. This is pre-existing and intentional.
- The kill-switch / feed-degraded alerts are once-per-episode (state flags, reset when the condition clears) so a stuck condition does not spam the chat every cycle.
- The daily heartbeat is the backstop for a silently dead alert path: no heartbeat for a day = the path is down or the bot is down, and the 6h check must distinguish the two by reading `alerts.jsonl` and `state.json` (§2), not by guessing.
