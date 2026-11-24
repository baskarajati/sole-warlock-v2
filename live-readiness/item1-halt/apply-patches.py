#!/usr/bin/env python3
"""Apply Item 1 (halt enforcement) edits to pristine v1/v2 copies.
Copies pristine/<bot>/*.js -> patched/<bot>/*.js, then edits with exact-match
anchors. Any anchor that does not match exactly once aborts loudly.
Run from ~/workspace/warlock-division/live-readiness/item1-halt/."""
import shutil, sys
from pathlib import Path

BASE = Path(__file__).resolve().parent

def load(bot, name):
    p = BASE / 'patched' / bot / name
    return p.read_text()

def save(bot, name, text):
    p = BASE / 'patched' / bot / name
    p.write_text(text)

def rep(text, old, new, count=1, label=''):
    n = text.count(old)
    assert n == count, f'{label}: anchor found {n}x, expected {count}x:\n{old[:160]!r}'
    return text.replace(old, new)

def fresh(bot):
    src = BASE / 'pristine' / bot
    dst = BASE / 'patched' / bot
    dst.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        shutil.copy2(f, dst / f.name)

# ---------------------------------------------------------------- v1 bot.js
fresh('v1')
t = load('v1', 'bot.js')

t = rep(t,
"""const liveControl = require('./live-control');""",
"""const liveControl = require('./live-control');
const liveHalt = require('./live-halt');   // Item 1: per-book safety-halt enforcement (K1-K8, latch, feed rules)""",
label='v1 require')

t = rep(t,
"""const historyArchivePolicy=entryPolicy.readArchivePolicy(PAPER_DIR);""",
"""const historyArchivePolicy=entryPolicy.readArchivePolicy(PAPER_DIR);
// Item 1 (halt): one instance per process. Reads thresholds from
// <DIR>/halt-params.json (D-0c table) when present, else D-0c Rev 1 defaults.
// v1 pays no swap fee (13 Nov patch): maxFeeBps 0 — any fee trips K8.
const halt = liveHalt.create({ dir: DIR, bot: 'v1', log, notifyEmergency: (rec) => telegram.notifyEmergency(rec), maxFeeBps: 0 });""",
label='v1 halt instance')

t = rep(t,
"""  RESHAPE: process.env.RESHAPE === '1',""",
"""  RESHAPE: process.env.RESHAPE === '1',
  RESHAPE_MAX: +(process.env.RESHAPE_MAX || 5),   // Item 1: per-leg reshape cap (closes OPEN-3); settings.json wins via applyPaperSettings""",
label='v1 CFG RESHAPE_MAX')

t = rep(t,
"""    if (px > 0) { solUsdCache = { t: Date.now(), px }; return px; }""",
"""    if (px > 0) { solUsdCache = { t: Date.now(), px }; halt.noteSolUsdAt(Date.now(), px); return px; }   // Item 1: feed freshness for the stale-feed rule + last-good price for the N1 conversion / N2 close fallback""",
count=2, label='v1 solUsd hook')

# liveOpen choke point
t = rep(t,
"""  const policy = { ...CFG, ...(opts.strategySettings || {}) };   // a reposition keeps the settings the position was opened with, like paperOpenSingle""",
"""  const policy = { ...CFG, ...(opts.strategySettings || {}) };   // a reposition keeps the settings the position was opened with, like paperOpenSingle
  // Item 1 (halt): THE choke point. Every open route — scan cycle, manual
  // open, reposition openNew — funnels through liveOpen(), so no route
  // bypasses this check. Refuses before any chain call is made.
  {
    const gate = halt.checkGate({ paper: CFG.PAPER, dryRun: CFG.DRY_RUN, liveConfirmed: process.env.LIVE_CONFIRMED === '1' });
    if (!gate.ok) return { skipped: gate.reason };
    const fee = halt.checkFeeBps(swapRoute.ROUTE_FEE_BPS, 'open');
    if (!fee.ok) return { skipped: fee.reason };
    const open = halt.refuseOpen(Date.now(), { scanAt: state.lastScan && state.lastScan.at ? Date.parse(state.lastScan.at) : null, pollSec: CFG.POLL_SEC, stopPresent: fs.existsSync(path.join(DIR, 'STOP')), noNewPresent: fs.existsSync(path.join(DIR, 'NO_NEW')) });
    if (!open.ok) { log('OPEN ditolak ' + p.name + ': ' + open.reason); return { skipped: open.reason }; }
  }""",
label='v1 liveOpen gate')

# jupiterSwapLive fee check at execution (K8)
t = rep(t,
"""  log(`  jupiter ${label}: ${q.inUi} -> ${q.outUi} (quote)`);
  if (CFG.DRY_RUN || CFG.PAPER || process.env.LIVE_CONFIRMED !== '1') {""",
"""  log(`  jupiter ${label}: ${q.inUi} -> ${q.outUi} (quote)`);
  { const fee = halt.checkFeeBps(swapRoute.ROUTE_FEE_BPS, `swap:${label}`); if (!fee.ok) return { ok: false, error: fee.reason }; }   // Item 1 (K8): fee check at execution, before any swap is sent
  if (CFG.DRY_RUN || CFG.PAPER || process.env.LIVE_CONFIRMED !== '1') {""",
label='v1 swap fee check')

# liveClose: stamp estimate flag + feed halt accounting (non-intermediate only)
t = rep(t,
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +realized.toFixed(5), usdcIn: basisUsdc, usdcOut: sb.usdcOut, legUsdcIn: pos.usdcIn, legUsdcOut: sb.usdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, pnlCapital: pnlUsd, pnlCapitalPct: pnlPct, solPile: sb.solPile, swapBackComplete: sb.complete, swapBackErrors: sb.errors };
  if (!opts.intermediate) { state.history.push(row); state.position = null; saveState(state, path.join(DIR, 'state.json')); }""",
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +realized.toFixed(5), usdcIn: basisUsdc, usdcOut: sb.usdcOut, legUsdcIn: pos.usdcIn, legUsdcOut: sb.usdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, pnlCapital: pnlUsd, pnlCapitalPct: pnlPct, solPile: sb.solPile, swapBackComplete: sb.complete, swapBackErrors: sb.errors };
  // Item 1 (§3.1.7): an exit taken on an on-chain estimate is flagged in the
  // history row (quoted=false + valuationBasis) and in the log line. The
  // Telegram flag rides on Item 4a's live close call site, which reads
  // row.quoted (v1 liveClose has no notify call today — OPEN-4). The halt
  // accounting below runs for real closed legs only; intermediate
  // reposition legs are excluded (the final close carries the leg PnL).
  if (opts.valuation) { row.quoted = !!opts.valuation.quoted; row.valuationBasis = opts.valuation.basis || null; if (!opts.valuation.quoted) log(`  CLOSE ${pos.name}: exit on on-chain estimate (quoted=false, basis=${row.valuationBasis}) — flagged in history row`); }
  if (!opts.intermediate) {
    // Item 1 (N2 fix): never skip halt accounting for a missing price.
    // solUsd() already returns its last-good cached price; if even that
    // is 0, fall back to the last-good price the halt module remembers
    // (persisted in halt-state.json, so it survives a restart mid-outage).
    // Only when no SOL price was ever seen is pnlSol booked as 0 — the
    // leg is still counted (closedLegs / K3 / K4 / K5 / K7 all see it)
    // and the row is flagged priceFallback. A price older than the 60 s
    // solUsd cache window is flagged too.
    // Item 1 (N3 fix): realisedSol must be the USDC actually realised
    // FROM THE POSITION. sb.usdcOut also contains the sale of the
    // out-of-position SOL pile (leftover gas reserve + refunded rent),
    // so subtract those pile components — otherwise the K8 gap carries a
    // systematic positive bias of leftoverSol + rent refund against a
    // 0.0625 SOL threshold. Close fees inside receivedSol stay in (they
    // shrink the gap slightly — the safe direction). No gap observation
    // when the swap-back is incomplete (partial fills are not a
    // quote-vs-fill observation) or when no price exists.
    const pxHalt = (await solUsd().catch(() => 0)) || halt.lastSolUsdPx() || 0;
    const priceFallback = pxHalt === 0 || (Date.now() - solUsdCache.t >= 60_000);
    if (priceFallback) { row.priceFallback = true; log(`  CLOSE ${pos.name}: halt accounting on ${pxHalt === 0 ? 'NO SOL/USD price ever seen (pnlSol booked as 0 — leg still counted)' : 'fallback SOL price $' + pxHalt.toFixed(2)} — row flagged priceFallback`); }
    const pileOutsideSol = (pos.leftoverSol || 0) + (pos.rentRefundableSol || 0);
    const gap = (pxHalt > 0 && sb.complete)
      ? { quotedSol: pos.quoteMint === USDC ? v.value / pxHalt : v.value, realisedSol: sb.usdcOut / pxHalt - pileOutsideSol }
      : { quotedSol: null, realisedSol: null };
    halt.recordClose({ pnlSol: pxHalt > 0 ? pnlUsd / pxHalt : 0, legSol: pxHalt > 0 ? (pos.quoteMint === USDC ? (pos.depositQuote ?? pos.usdcIn ?? 0) / pxHalt : (pos.depositSol || 0)) : undefined, reason, pool: pos.pool, openedAt: pos.openedAt, quotedSol: gap.quotedSol, realisedSol: gap.realisedSol, feeBps: swapRoute.ROUTE_FEE_BPS });
    state.history.push(row); state.position = null; saveState(state, path.join(DIR, 'state.json'));
  }""",
label='v1 liveClose halt')

# livePositionCycle: pass the exit valuation into liveClose
t = rep(t,
"""  if (exitReason) await liveClose(state, exitReason);""",
"""  if (exitReason) await liveClose(state, exitReason, { valuation: decisionVal ? { quoted: !!decisionVal.quoted, basis: decisionVal.valuationBasis || null } : null });   // Item 1: exit-valuation flag for the close row (§3.1.7)""",
label='v1 positionCycle valuation')

# livePositionCycle: stamp the quote units of pnlSol on the live object
# (N1 fix). pnlSol = v.value - depositSol is in QUOTE units — SOL for
# SOL pools, USDC for USDC pools — and liveCycle's K2 conversion reads
# this field. The mint is mapped to its symbol here; the halt module
# stays mint-agnostic (it converts on 'USDC').
t = rep(t,
"""  const live = { valueSol: +v.value.toFixed(5), pnlSol: +(v.value - state.position.depositSol).toFixed(5), pnlPct: +(v.pnl * 100).toFixed(2), feesSol: +v.fees.toFixed(5), ageH: +ageH.toFixed(2), price: v.price, inRange: v.inRange };""",
"""  const live = { valueSol: +v.value.toFixed(5), pnlSol: +(v.value - state.position.depositSol).toFixed(5), quoteMint: state.position.quoteMint === USDC ? 'USDC' : 'SOL', pnlPct: +(v.pnl * 100).toFixed(2), feesSol: +v.fees.toFixed(5), ageH: +ageH.toFixed(2), price: v.price, inRange: v.inRange };   // Item 1 (N1): quote units of pnlSol — liveCycle converts USDC legs at the SOL price""",
label='v1 live object quoteMint')

# livePositionCycle reshape: log the freeze once (cap itself is in the trigger)
t = rep(t,
"""        const trg = liveReshapeExec.trigger({ pos: pos0, activeBinId: v.activeBinId, settings: pol, stop });""",
"""        const trg = liveReshapeExec.trigger({ pos: pos0, activeBinId: v.activeBinId, settings: pol, stop });
        if (trg.capped && !pos0.reshapeFreezeLogged) { pos0.reshapeFreezeLogged = true; log(`  reshape FROZEN ${pos0.name}: ${pos0.reshapes} reshapes (RESHAPE_MAX=${trg.max}); position stays, -20% backstop live`); }   // Item 1: per-leg cap (closes OPEN-3)""",
label='v1 reshape frozen log')

# liveCycle: per-cycle feed + K2/K6 evaluation before any open
t = rep(t,
"""  if (state.positions.length >= CFG.MAX_POSITIONS) { await writeLiveStatusPointer(state, { lives }); return false; }   // slots full, like the dry run""",
"""  // Item 1 (halt): once per cycle, before any open. Feed check first (a
  // stale feed writes NO_NEW after 3 stale polls); then K2 drawdown and the
  // K6 7-day branch, evaluated with open unrealised PnL included. A trip
  // writes STOP and refuses opens from here on (latched).
  // N1 fix: lives[].pnlSol is in QUOTE units per leg (SOL for SOL pools,
  // USDC for USDC pools). halt.openUnrealisedSol() converts USDC legs at
  // the SOL price (fresh solUsd(), else the last-good price the halt
  // module remembers) — summing it raw would false-trip K2 on a -$1 USDC
  // wobble and mask real drawdown on a USDC win. If no price exists at
  // all, the K2/K6 verdict is skipped this poll (logged); the liveOpen
  // gate (latch / STOP / NO_NEW / feed) still applies to every open.
  {
    const feed = halt.checkFeed(Date.now(), { scanAt: scan.last ? scan.last.at : null, pollSec: CFG.POLL_SEC });
    if (!feed.ok) log('feed-stale: no new opens this poll');
    const pxHalt = (await solUsd().catch(() => 0)) || halt.lastSolUsdPx() || 0;
    const openUnrealised = halt.openUnrealisedSol(lives, pxHalt > 0 ? pxHalt : null);
    if (openUnrealised == null) {
      log('HALT K2/K6 skipped this cycle: no SOL/USD price to convert USDC open unrealised');
    } else {
      const equity = halt.params().bookSol + halt.status().netSol + openUnrealised;
      const open = halt.checkOpen(Date.now(), { equitySol: equity, openUnrealisedSol: openUnrealised, scanAt: scan.last ? scan.last.at : null, pollSec: CFG.POLL_SEC });
      if (!open.ok) { log('HALT refuses opens this cycle: ' + open.reason); await writeLiveStatusPointer(state, { lives, halt: halt.status() }); return false; }
    }
  }
  if (state.positions.length >= CFG.MAX_POSITIONS) { await writeLiveStatusPointer(state, { lives }); return false; }   // slots full, like the dry run""",
label='v1 liveCycle halt')

save('v1', 'bot.js', t)

# ------------------------------------------------------- v1 live-reshape-exec
t = load('v1', 'live-reshape-exec.js')
t = rep(t,
"""function trigger({ pos, activeBinId, settings, stop }) {
  if (stop || settings.RESHAPE_ENABLED === false) return { due: false };
  const n = settings.RESHAPE_N ?? 5, anchor = pos.lastReshapeActiveBin ?? pos.entryActiveBin, down = anchor - activeBinId;
  return { due: down >= n, down, n, anchor };
}""",
"""function trigger({ pos, activeBinId, settings, stop }) {
  if (stop || settings.RESHAPE_ENABLED === false) return { due: false };
  // Item 1 (closes OPEN-3): per-leg reshape cap RESHAPE_MAX. The pristine
  // live trigger has no cap — only the paper variant-E freeze gate does
  // (bot.js paperCycle). Unset setting = D-0c default 5; an explicit
  // positive integer in settings wins. A frozen leg stays open; the -20%
  // emergency stop, TP and max-age exits stay live.
  const max = Number.isFinite(settings.RESHAPE_MAX) ? settings.RESHAPE_MAX : 5;
  if ((pos.reshapes || 0) >= max) return { due: false, capped: true, max, reshapes: pos.reshapes || 0 };
  const n = settings.RESHAPE_N ?? 5, anchor = pos.lastReshapeActiveBin ?? pos.entryActiveBin, down = anchor - activeBinId;
  return { due: down >= n, down, n, anchor };
}""",
label='v1 reshape trigger cap')
save('v1', 'live-reshape-exec.js', t)

# --------------------------------------------------------- v1 paper-settings
t = load('v1', 'paper-settings.js')
t = rep(t,
"""  RESHAPE_N: 5,""",
"""  RESHAPE_N: 5,
  RESHAPE_MAX: 5,  // Item 1 (closes OPEN-3): per-leg reshape cap; the live trigger defaults to 5 when unset, settings.json wins""",
label='v1 settings DEFAULTS')
t = rep(t,
"""  RESHAPE_N: { type: 'integer', min: 1, max: 50, integer: true, default: DEFAULTS.RESHAPE_N, label: 'Reshape setiap N bin', unit: 'bin', displayScale: 1 },""",
"""  RESHAPE_N: { type: 'integer', min: 1, max: 50, integer: true, default: DEFAULTS.RESHAPE_N, label: 'Reshape setiap N bin', unit: 'bin', displayScale: 1 },
  RESHAPE_MAX: { type: 'integer', min: 1, max: 10000, integer: true, default: DEFAULTS.RESHAPE_MAX, label: 'Maks reshape per posisi (freeze: posisi tetap open, exit lain tetap jalan)', unit: 'kali', displayScale: 1 },""",
label='v1 settings FIELDS')
save('v1', 'paper-settings.js', t)

# ---------------------------------------------------------------- v2 bot.js
fresh('v2')
t = load('v2', 'bot.js')

t = rep(t,
"""const liveControl = require('./live-control');""",
"""const liveControl = require('./live-control');
const liveHalt = require('./live-halt');   // Item 1: per-book safety-halt enforcement (K1-K8, latch, feed rules)""",
label='v2 require')

t = rep(t,
"""const DIR = process.env.LP_BOT_DIR || '/workspace/lp-bot';""",
"""const DIR = process.env.LP_BOT_DIR || '/workspace/lp-bot';
// Item 1 (halt): one instance per process. Reads thresholds from
// <DIR>/halt-params.json (D-0c table) when present, else D-0c Rev 1 defaults.
// v2 pays the disclosed 50 bps Jupiter referral fee: maxFeeBps 50.
const halt = liveHalt.create({ dir: DIR, bot: 'v2', log, notifyEmergency: (rec) => telegram.notifyEmergency(rec), maxFeeBps: 50 });""",
label='v2 halt instance')

t = rep(t,
"""  RESHAPE: process.env.RESHAPE === '1',""",
"""  RESHAPE: process.env.RESHAPE === '1',
  RESHAPE_MAX: +(process.env.RESHAPE_MAX || 5),   // Item 1: per-leg reshape cap (closes OPEN-3); settings.json wins via applyPaperSettings""",
label='v2 CFG RESHAPE_MAX')

t = rep(t,
"""    if (px > 0) { solUsdCache = { t: Date.now(), px }; return px; }""",
"""    if (px > 0) { solUsdCache = { t: Date.now(), px }; halt.noteSolUsdAt(Date.now(), px); return px; }   // Item 1: feed freshness for the stale-feed rule + last-good price for the N1 conversion / N2 close fallback""",
count=2, label='v2 solUsd hook')

t = rep(t,
"""  const policy = { ...CFG, ...(opts.strategySettings || {}) };   // a reposition keeps the settings the position was opened with, like paperOpenSingle""",
"""  const policy = { ...CFG, ...(opts.strategySettings || {}) };   // a reposition keeps the settings the position was opened with, like paperOpenSingle
  // Item 1 (halt): THE choke point. Every open route — scan cycle, manual
  // open (liveManualOpen), reposition openNew — funnels through liveOpen(),
  // so no route bypasses this check. Refuses before any chain call is made.
  {
    const gate = halt.checkGate({ paper: CFG.PAPER, dryRun: CFG.DRY_RUN, liveConfirmed: process.env.LIVE_CONFIRMED === '1' });
    if (!gate.ok) return { skipped: gate.reason };
    const fee = halt.checkFeeBps(swapRoute.ROUTE_FEE_BPS, 'open');
    if (!fee.ok) return { skipped: fee.reason };
    const open = halt.refuseOpen(Date.now(), { scanAt: state.lastScan && state.lastScan.at ? Date.parse(state.lastScan.at) : null, pollSec: CFG.POLL_SEC, stopPresent: fs.existsSync(path.join(DIR, 'STOP')), noNewPresent: fs.existsSync(path.join(DIR, 'NO_NEW')) });
    if (!open.ok) { log('OPEN ditolak ' + p.name + ': ' + open.reason); return { skipped: open.reason }; }
  }""",
label='v2 liveOpen gate')

t = rep(t,
"""  log(`  jupiter ${label}: ${q.inUi} -> ${q.outUi} (quote)`);
  if (CFG.DRY_RUN || CFG.PAPER || process.env.LIVE_CONFIRMED !== '1') {""",
"""  log(`  jupiter ${label}: ${q.inUi} -> ${q.outUi} (quote)`);
  { const fee = halt.checkFeeBps(swapRoute.ROUTE_FEE_BPS, `swap:${label}`); if (!fee.ok) return { ok: false, error: fee.reason }; }   // Item 1 (K8): fee check at execution, before any swap is sent
  if (CFG.DRY_RUN || CFG.PAPER || process.env.LIVE_CONFIRMED !== '1') {""",
label='v2 swap fee check')

# v2 finishLiveClose (USDC-capital path): stamp + recordClose
t = rep(t,
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +realized.toFixed(5), usdcIn: basisUsdc, usdcOut: sb.usdcOut, legUsdcIn: pos.usdcIn, legUsdcOut: sb.usdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, pnlCapital: pnlUsd, pnlCapitalPct: pnlPct, solPile: sb.solPile, swapBackComplete: sb.complete, swapBackErrors: sb.errors };""",
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +realized.toFixed(5), usdcIn: basisUsdc, usdcOut: sb.usdcOut, legUsdcIn: pos.usdcIn, legUsdcOut: sb.usdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, pnlCapital: pnlUsd, pnlCapitalPct: pnlPct, solPile: sb.solPile, swapBackComplete: sb.complete, swapBackErrors: sb.errors };
  // Item 1 (§3.1.7 + K1/K3-K8): flag on-chain-estimate exits in the row
  // (liveNotifyClose below renders the row, so the flag reaches the alert)
  // and feed the close into the halt accounting. Intermediate reposition
  // legs are excluded (the final close carries the leg PnL).
  if (opts.valuation) { row.quoted = !!opts.valuation.quoted; row.valuationBasis = opts.valuation.basis || null; if (!opts.valuation.quoted) log(`  CLOSE ${pos.name}: exit on on-chain estimate (quoted=false, basis=${row.valuationBasis}) — flagged in history row`); }
  if (!opts.intermediate) {
    // Item 1 (N2 fix): never skip halt accounting for a missing price.
    // solUsd() already returns its last-good cached price; if even that
    // is 0, fall back to the last-good price the halt module remembers
    // (persisted in halt-state.json, so it survives a restart mid-outage).
    // Only when no SOL price was ever seen is pnlSol booked as 0 — the
    // leg is still counted (closedLegs / K3 / K4 / K5 / K7 all see it)
    // and the row is flagged priceFallback. A price older than the 60 s
    // solUsd cache window is flagged too.
    // Item 1 (N3 fix): realisedSol must be the USDC actually realised
    // FROM THE POSITION. sb.usdcOut also contains the sale of the
    // out-of-position SOL pile (leftover gas reserve + refunded rent),
    // so subtract those pile components — otherwise the K8 gap carries a
    // systematic positive bias of leftoverSol + rent refund against a
    // 0.0625 SOL threshold. Close fees inside receivedSol stay in (they
    // shrink the gap slightly — the safe direction). No gap observation
    // when the swap-back is incomplete (partial fills — and the
    // pending-token estimate added to sb.usdcOut — are not a quote-vs-fill
    // observation) or when no price exists.
    const pxHalt = (await solUsd().catch(() => 0)) || halt.lastSolUsdPx() || 0;
    const priceFallback = pxHalt === 0 || (Date.now() - solUsdCache.t >= 60_000);
    if (priceFallback) { row.priceFallback = true; log(`  CLOSE ${pos.name}: halt accounting on ${pxHalt === 0 ? 'NO SOL/USD price ever seen (pnlSol booked as 0 — leg still counted)' : 'fallback SOL price $' + pxHalt.toFixed(2)} — row flagged priceFallback`); }
    const pileOutsideSol = (pos.leftoverSol || 0) + (pos.rentRefundableSol || 0);
    const gap = (pxHalt > 0 && sb.complete)
      ? { quotedSol: pos.quoteMint === USDC ? v.value / pxHalt : v.value, realisedSol: sb.usdcOut / pxHalt - pileOutsideSol }
      : { quotedSol: null, realisedSol: null };
    halt.recordClose({ pnlSol: pxHalt > 0 ? pnlUsd / pxHalt : 0, legSol: pxHalt > 0 ? (pos.quoteMint === USDC ? (pos.depositQuote ?? pos.usdcIn ?? 0) / pxHalt : (pos.depositSol || 0)) : undefined, reason, pool: pos.pool, openedAt: pos.openedAt, quotedSol: gap.quotedSol, realisedSol: gap.realisedSol, feeBps: swapRoute.ROUTE_FEE_BPS });
  }""",
label='v2 finishLiveClose halt')

# v2 liveCloseSol (SOL-capital path): stamp + recordClose
t = rep(t,
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +(solOut - capIn).toFixed(5), capitalAsset: 'SOL', solOut, solUsd: px, usdcIn: basisUsdc, usdcOut: basisUsdc + pnlUsd, legUsdcIn: pos.usdcIn, legUsdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, netPnlSol: pnlCapital, pnlCapital, pnlCapitalPct: pnlPct, solPile: solOut, swapBackComplete: sb.complete, swapBackErrors: sb.errors };""",
"""  const row = { ...pos, closedAt: now(), reason, estPnlPct: +(v.pnl * 100).toFixed(2), estValueSol: +v.value.toFixed(5), feesSol: +v.fees.toFixed(5), realizedSol: +(solOut - capIn).toFixed(5), capitalAsset: 'SOL', solOut, solUsd: px, usdcIn: basisUsdc, usdcOut: basisUsdc + pnlUsd, legUsdcIn: pos.usdcIn, legUsdcOut, pnlUsd, pnlPct, netPnlUsd: pnlUsd, netPnlPct: pnlPct, netPnlSol: pnlCapital, pnlCapital, pnlCapitalPct: pnlPct, solPile: solOut, swapBackComplete: sb.complete, swapBackErrors: sb.errors };
  // Item 1 (§3.1.7 + K1/K3-K8): SOL-capital path — PnL is natively SOL.
  if (opts.valuation) { row.quoted = !!opts.valuation.quoted; row.valuationBasis = opts.valuation.basis || null; if (!opts.valuation.quoted) log(`  CLOSE ${pos.name}: exit on on-chain estimate (quoted=false, basis=${row.valuationBasis}) — flagged in history row`); }
  // Item 1 (N3 fix): solOut is the position's own SOL pile PLUS the
  // out-of-position pile (leftover gas reserve + refunded rent), while
  // quotedSol (v.value) is the position only — subtract the pile
  // components so the K8 gap compares like with like. No gap observation
  // when the swap-back is incomplete (solOut then contains the
  // pending-token estimate, not a fill).
  if (!opts.intermediate) {
    const pileOutsideSol = (pos.leftoverSol || 0) + (pos.rentRefundableSol || 0);
    const gap = sb.complete
      ? { quotedSol: v.value, realisedSol: solOut - pileOutsideSol }
      : { quotedSol: null, realisedSol: null };
    halt.recordClose({ pnlSol: pnlCapital, legSol: basisSol, reason, pool: pos.pool, openedAt: pos.openedAt, quotedSol: gap.quotedSol, realisedSol: gap.realisedSol, feeBps: swapRoute.ROUTE_FEE_BPS });
    // Item 1 (N3): liveCloseSol is only reachable with capitalAsset SOL,
    // which implies quoteMint SOL (liveOpen sets both together; solMode
    // rejects non-SOL pools). Assert it here: a mismatch means the
    // position record is internally inconsistent and the SOL-native gap
    // above cannot be trusted. Trip K8 (fail-closed) AFTER the close is
    // counted, so a real K1 on this leg keeps latch priority; the breach
    // is always in the log line either way.
    if (pos.quoteMint !== SOL) { log(`  CLOSE ${pos.name}: quoteMint mismatch on the SOL-capital path (capitalAsset=SOL but quoteMint=${pos.quoteMint}) — K8 trip, position record inconsistent`); halt.trip('K8', { quoteMint: String(pos.quoteMint), capitalAsset: 'SOL', pool: pos.pool || null, reason: 'liveCloseSol quoteMint !== SOL' }, 'STOP'); }
  }""",
label='v2 liveCloseSol halt')

# v2 livePositionCycle: pass the exit valuation into liveClose
t = rep(t,
"""  if (exitReason) await liveClose(state, exitReason);""",
"""  if (exitReason) await liveClose(state, exitReason, { valuation: decisionVal ? { quoted: !!decisionVal.quoted, basis: decisionVal.valuationBasis || null } : null });   // Item 1: exit-valuation flag for the close row (§3.1.7)""",
label='v2 positionCycle valuation')

# livePositionCycle: stamp the quote units of pnlSol on the live object
# (N1 fix) — same as v1: pnlSol is in quote units, liveCycle's K2
# conversion reads this field.
t = rep(t,
"""  const live = { valueSol: +v.value.toFixed(5), pnlSol: +(v.value - state.position.depositSol).toFixed(5), pnlPct: +(v.pnl * 100).toFixed(2), feesSol: +v.fees.toFixed(5), ageH: +ageH.toFixed(2), price: v.price, inRange: v.inRange };""",
"""  const live = { valueSol: +v.value.toFixed(5), pnlSol: +(v.value - state.position.depositSol).toFixed(5), quoteMint: state.position.quoteMint === USDC ? 'USDC' : 'SOL', pnlPct: +(v.pnl * 100).toFixed(2), feesSol: +v.fees.toFixed(5), ageH: +ageH.toFixed(2), price: v.price, inRange: v.inRange };   // Item 1 (N1): quote units of pnlSol — liveCycle converts USDC legs at the SOL price""",
label='v2 live object quoteMint')

# v2 livePositionCycle reshape: log the freeze once
t = rep(t,
"""        const trg = pos0.reshapePending ? { due: false } : liveReshapeExec.trigger({ pos: pos0, activeBinId: v.activeBinId, settings: pol, stop });   // never start a new reshape on top of an unfinished re-add""",
"""        const trg = pos0.reshapePending ? { due: false } : liveReshapeExec.trigger({ pos: pos0, activeBinId: v.activeBinId, settings: pol, stop });   // never start a new reshape on top of an unfinished re-add
        if (trg.capped && !pos0.reshapeFreezeLogged) { pos0.reshapeFreezeLogged = true; log(`  reshape FROZEN ${pos0.name}: ${pos0.reshapes} reshapes (RESHAPE_MAX=${trg.max}); position stays, -20% backstop live`); }   // Item 1: per-leg cap (closes OPEN-3)""",
label='v2 reshape frozen log')

# v2 liveCycle: per-cycle feed + K2/K6 evaluation before any open
t = rep(t,
"""  if (await liveManualOpen(state, maxPos)) { saveState(state, path.join(DIR, 'state.json')); await writeLiveStatusPointer(state, { lives }); return false; }""",
"""  // Item 1 (halt): once per cycle, before any open (scan or manual).
  // Feed check first (a stale feed writes NO_NEW after 3 stale polls);
  // then K2 drawdown and the K6 7-day branch, evaluated with open
  // unrealised PnL included. A trip writes STOP and refuses opens from
  // here on (latched).
  // N1 fix: lives[].pnlSol is in QUOTE units per leg (SOL for SOL pools,
  // USDC for USDC pools). halt.openUnrealisedSol() converts USDC legs at
  // the SOL price (fresh solUsd(), else the last-good price the halt
  // module remembers) — summing it raw would false-trip K2 on a -$1 USDC
  // wobble and mask real drawdown on a USDC win. If no price exists at
  // all, the K2/K6 verdict is skipped this poll (logged); the liveOpen
  // gate (latch / STOP / NO_NEW / feed) still applies to every open.
  {
    const feed = halt.checkFeed(Date.now(), { scanAt: scan.last ? scan.last.at : null, pollSec: CFG.POLL_SEC });
    if (!feed.ok) log('feed-stale: no new opens this poll');
    const pxHalt = (await solUsd().catch(() => 0)) || halt.lastSolUsdPx() || 0;
    const openUnrealised = halt.openUnrealisedSol(lives, pxHalt > 0 ? pxHalt : null);
    if (openUnrealised == null) {
      log('HALT K2/K6 skipped this cycle: no SOL/USD price to convert USDC open unrealised');
    } else {
      const equity = halt.params().bookSol + halt.status().netSol + openUnrealised;
      const open = halt.checkOpen(Date.now(), { equitySol: equity, openUnrealisedSol: openUnrealised, scanAt: scan.last ? scan.last.at : null, pollSec: CFG.POLL_SEC });
      if (!open.ok) { log('HALT refuses opens this cycle: ' + open.reason); await writeLiveStatusPointer(state, { lives, halt: halt.status() }); return false; }
    }
  }
  if (await liveManualOpen(state, maxPos)) { saveState(state, path.join(DIR, 'state.json')); await writeLiveStatusPointer(state, { lives }); return false; }""",
label='v2 liveCycle halt')

save('v2', 'bot.js', t)

# ------------------------------------------------------- v2 live-reshape-exec
t = load('v2', 'live-reshape-exec.js')
t = rep(t,
"""function trigger({ pos, activeBinId, settings, stop }) {
  if (stop || settings.RESHAPE_ENABLED === false) return { due: false };
  const n = settings.RESHAPE_N ?? 5, anchor = pos.lastReshapeActiveBin ?? pos.entryActiveBin, down = anchor - activeBinId;
  return { due: down >= n, down, n, anchor };
}""",
"""function trigger({ pos, activeBinId, settings, stop }) {
  if (stop || settings.RESHAPE_ENABLED === false) return { due: false };
  // Item 1 (closes OPEN-3): per-leg reshape cap RESHAPE_MAX. The pristine
  // live trigger has no cap — the 23 Nov port added the cap only to the
  // paper freeze gate (bot.js paperCycle) and to paper-settings. Unset
  // setting = D-0c default 5; an explicit positive integer wins. A frozen
  // leg stays open; the -20% emergency stop, TP and max-age exits stay live.
  const max = Number.isFinite(settings.RESHAPE_MAX) ? settings.RESHAPE_MAX : 5;
  if ((pos.reshapes || 0) >= max) return { due: false, capped: true, max, reshapes: pos.reshapes || 0 };
  const n = settings.RESHAPE_N ?? 5, anchor = pos.lastReshapeActiveBin ?? pos.entryActiveBin, down = anchor - activeBinId;
  return { due: down >= n, down, n, anchor };
}""",
label='v2 reshape trigger cap')
save('v2', 'live-reshape-exec.js', t)

# --------------------------------------------------------- v2 paper-settings
t = load('v2', 'paper-settings.js')
t = rep(t,
"""  RESHAPE_MAX: null,  // null = unlimited (author behaviour); a positive integer freezes reshaping per position at that count (Warlock v1 Book E = 5)""",
"""  RESHAPE_MAX: 5,  // Item 1 (closes OPEN-3): was null (= unlimited, author behaviour). The 23 Nov port set the FIELDS default to 5 but left DEFAULTS null, so currentValues() returned null on any install whose settings.json does not set the key — the paper freeze gate never fired there. Default is now 5, matching the FIELDS default and the D-0c table; settings.json still wins.""",
label='v2 settings DEFAULTS')
save('v2', 'paper-settings.js', t)

print('all patches applied')
