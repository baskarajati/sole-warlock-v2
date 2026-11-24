#!/usr/bin/env node
// Item 1 wiring-level regression test — REVIEW N1 + N14.
//
// The builder sims (test-halt-sim.js) call checkOpen()/recordClose()
// directly with hand-built equity figures, so they never exercised the
// liveCycle equity computation — that is how N1 escaped 16/16 green.
// This test exercises the EXACT function liveCycle calls for its equity
// computation (halt.openUnrealisedSol) with lives[] shaped EXACTLY as
// livePositionCycle builds them ({ pnlSol, quoteMint }), feeds the result
// into the REAL checkOpen(), and statically checks that both patched
// bot.js trees actually call it (and no longer sum lives[].pnlSol raw).
//
// N1 in one line: lives[].pnlSol is in QUOTE units per leg — SOL for SOL
// pools, USDC for USDC pools (liveOpenUsdcPool books depositSol in USDC,
// liveValuation().value is in quote units). Summing it raw treats USDC as
// SOL: a -$1 wobble reads as -1 SOL and false-trips K2; a +$5 win masks
// real drawdown. The fix converts USDC legs at the SOL price.
//
// Pre-fix behaviour (demonstrate with ITEM1_DIR=<pre-fix copy>):
//   live-halt.js has no openUnrealisedSol and both patched bot.js files
//   still sum lives[].pnlSol raw -> this test FAILS (exit 1).
// Post-fix: all checks PASS (exit 0).
//
// Usage: node test-n1-wiring.js [ITEM1_DIR env override for the pre-fix demo]
// Exit 0 = all pass, 1 = any fail.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const HERE = process.env.ITEM1_DIR || __dirname;
const haltMod = require(path.join(HERE, 'live-halt.js'));
const T0 = Date.parse('2026-11-24T10:00:00Z'); // CET 11:00, 24 Nov 2026
const PX = 75; // SOL/USD price used by the A7/A7b template cases

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} :: ${detail}`);
}

function freshDir(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `n1-wire-${tag}-`));
  fs.copyFileSync(path.join(HERE, 'halt-params-v1.json'), path.join(d, 'halt-params.json'));
  return d;
}
function makeHalt(dir, bot = 'v1') {
  const logs = [], alerts = [];
  const h = haltMod.create({
    dir, bot, log: (m) => logs.push(m),
    notifyEmergency: (rec) => { alerts.push(rec); return Promise.resolve({ ok: true }); },
    maxFeeBps: bot === 'v2' ? 50 : 0,
  });
  return { h, logs, alerts };
}
// Exactly what patched liveCycle does with the helper's output.
function liveCycleEquity(h, lives, px) {
  const openUnrealised = h.openUnrealisedSol(lives, px);
  if (openUnrealised == null) return { openUnrealised: null, equity: null };
  return { openUnrealised, equity: h.params().bookSol + h.status().netSol + openUnrealised };
}
function freshPrice(h, t) { h.noteSolUsdAt(t); h.noteScanAt(t); }

// W0: the fix exists. On pre-fix code this fails and the run stops here
// with a FAIL (exit 1) instead of crashing — the pre-fix demonstration.
{
  const probe = makeHalt(freshDir('probe'));
  if (typeof probe.h.openUnrealisedSol !== 'function') {
    check('W0 live-halt.js exposes openUnrealisedSol (N1 fix present)', false,
      'live-halt.js has no openUnrealisedSol — liveCycle still sums lives[].pnlSol raw (N1 unfixed); remaining checks skipped');
    console.log(`\n${results.filter((r) => r.pass).length}/${results.length} wiring checks PASS`);
    process.exit(1);
  }
  check('W0 live-halt.js exposes openUnrealisedSol (N1 fix present)', true, 'halt.openUnrealisedSol is a function');
}

// W1 — A7 template: a -$1 unrealised wobble on a USDC leg, fed as pnlSol.
// Legacy (pre-fix liveCycle): raw sum -1 -> equity 4.0 -> K2 FALSE-TRIPS.
// Fixed: converted at $75 -> -0.0133 SOL -> equity 4.9867 -> no trip.
{
  const lives = [{ pnlSol: -1, quoteMint: 'USDC' }]; // -$1 on a USDC leg, as livePositionCycle builds it
  const { h } = makeHalt(freshDir('w1-fixed'));
  freshPrice(h, T0);
  const { openUnrealised, equity } = liveCycleEquity(h, lives, PX);
  const r = h.checkOpen(T0, { equitySol: equity, openUnrealisedSol: openUnrealised, scanAt: T0 });
  check('W1 A7: -$1 USDC-leg wobble converted at $75 does NOT trip K2', Math.abs(openUnrealised + 1 / 75) < 1e-9 && Math.abs(equity - (5 - 1 / 75)) < 1e-9 && r.ok === true,
    `openUnrealised=${openUnrealised.toFixed(6)} SOL equity=${equity.toFixed(6)} checkOpen=${JSON.stringify(r)}`);
  const { h: hLegacy } = makeHalt(freshDir('w1-legacy'));
  freshPrice(hLegacy, T0);
  const rawSum = lives.reduce((s, l) => s + (Number(l.pnlSol) || 0), 0); // pre-fix liveCycle line, verbatim
  const rLegacy = hLegacy.checkOpen(T0, { equitySol: 5 + 0 + rawSum, openUnrealisedSol: rawSum, scanAt: T0 });
  check('W1-control: the same -$1 fed RAW (pre-fix line) DOES false-trip K2', rawSum === -1 && rLegacy.ok === false && rLegacy.criterion === 'K2',
    `rawSum=${rawSum} equity=4.0 checkOpen=${JSON.stringify(rLegacy)} (this control proves the test would have caught N1)`);
}

// W2 — A7b: the same -$1 move correctly converted (-0.0133 SOL) does not trip.
{
  const { h } = makeHalt(freshDir('w2'));
  freshPrice(h, T0);
  const r = h.checkOpen(T0, { equitySol: 5 + (-1 / 75), openUnrealisedSol: -1 / 75, scanAt: T0 });
  check('W2 A7b: -$1 correctly converted (-0.0133 SOL) does NOT trip K2', r.ok === true, `checkOpen=${JSON.stringify(r)}`);
}

// W3 — masking direction: realised net -0.85 SOL plus a +$5 USDC-leg win.
// Raw sum: equity 5 - 0.85 + 5 = 9.15 — the win masks the drawdown, K2 silent.
// Converted: equity 5 - 0.85 + 5/75 = 4.2167, drawdown 0.7833 > 0.75 — K2 TRIPS.
{
  const lives = [{ pnlSol: 5, quoteMint: 'USDC' }]; // +$5 on a USDC leg
  // Seed realised net -0.85 SOL by writing state directly (recordClose
  // would trip K1 first on a single -0.85 leg — the state write is the
  // same restart-simulation technique test-halt-sim.js uses for K6-time).
  const dir = freshDir('w3-state');
  const { h: hSeed } = makeHalt(dir);
  freshPrice(hSeed, T0);
  hSeed.checkOpen(T0, { equitySol: 5, scanAt: T0 }); // sets pilotStartAt
  const sfile = path.join(dir, 'halt-state.json');
  const s = JSON.parse(fs.readFileSync(sfile, 'utf8'));
  s.netSol = -0.85; s.closedLegs = 12; s.dayKey = '2026-11-24'; s.dayNetSol = 0; s.dayBreaches = 0; s.dayBreachDates = [];
  fs.writeFileSync(sfile, JSON.stringify(s, null, 2));
  const { h: h2 } = makeHalt(dir);
  freshPrice(h2, T0);
  const { openUnrealised, equity } = liveCycleEquity(h2, lives, PX);
  const r = h2.checkOpen(T0, { equitySol: equity, openUnrealisedSol: openUnrealised, scanAt: T0 });
  check('W3 masking: +$5 USDC win + realised -0.85 trips K2 once converted', Math.abs(openUnrealised - 5 / 75) < 1e-9 && Math.abs(equity - (5 - 0.85 + 5 / 75)) < 1e-9 && r.ok === false && r.criterion === 'K2',
    `openUnrealised=${openUnrealised.toFixed(6)} equity=${equity.toFixed(6)} checkOpen=${JSON.stringify(r)}`);
  const { h: hRaw } = makeHalt(freshDir('w3-raw'));
  freshPrice(hRaw, T0);
  const rRaw = hRaw.checkOpen(T0, { equitySol: 5 - 0.85 + 5, openUnrealisedSol: 5, scanAt: T0 });
  check('W3-control: the same +$5 fed RAW masks the drawdown (K2 silent)', rRaw.ok === true, `raw equity=9.15 checkOpen=${JSON.stringify(rRaw)}`);
}

// W4 — SOL legs are price-independent: -0.5 SOL converts to -0.5 with no price.
{
  const { h } = makeHalt(freshDir('w4'));
  const v = h.openUnrealisedSol([{ pnlSol: -0.5, quoteMint: 'SOL' }], null);
  check('W4 SOL leg -0.5 passes through with no price', v === -0.5, `openUnrealisedSol=${v}`);
}

// W5 — USDC leg with no price: null (fail-safe — never guess a conversion).
{
  const { h } = makeHalt(freshDir('w5'));
  const v = h.openUnrealisedSol([{ pnlSol: -1, quoteMint: 'USDC' }], null);
  check('W5 USDC leg + no SOL price returns null (no guess)', v === null, `openUnrealisedSol=${v}`);
}

// W6 — mixed book: SOL leg -0.2 plus USDC leg -$15 at $75 -> -0.4 exactly.
{
  const { h } = makeHalt(freshDir('w6'));
  freshPrice(h, T0);
  const lives = [{ pnlSol: -0.2, quoteMint: 'SOL' }, { pnlSol: -15, quoteMint: 'USDC' }];
  const { openUnrealised, equity } = liveCycleEquity(h, lives, PX);
  const r = h.checkOpen(T0, { equitySol: equity, openUnrealisedSol: openUnrealised, scanAt: T0 });
  check('W6 mixed legs SOL -0.2 + USDC -$15 @ $75 = -0.4, no trip', Math.abs(openUnrealised + 0.4) < 1e-9 && Math.abs(equity - 4.6) < 1e-9 && r.ok === true,
    `openUnrealised=${openUnrealised.toFixed(6)} equity=${equity.toFixed(6)} checkOpen=${JSON.stringify(r)}`);
}

// W7 — entry without quoteMint: null (a future caller that forgets the
// field must not silently reintroduce the raw-sum bug).
{
  const { h } = makeHalt(freshDir('w7'));
  const v = h.openUnrealisedSol([{ pnlSol: -1 }], PX);
  check('W7 entry without quoteMint returns null (no silent SOL default)', v === null, `openUnrealisedSol=${v}`);
}

// W8 — last-good price (N2 support): noteSolUsdAt stores the price and a
// new instance in the same dir reads it back (restart mid-outage).
{
  const dir = freshDir('w8');
  const { h } = makeHalt(dir);
  h.noteSolUsdAt(T0, 75.5);
  const { h: h2 } = makeHalt(dir);
  check('W8 lastSolUsdPx persists across restart', h2.lastSolUsdPx() === 75.5, `lastSolUsdPx=${h2.lastSolUsdPx()}`);
}

// W9 — static wiring: both patched trees call the helper from liveCycle,
// stamp quoteMint in livePositionCycle, and no longer sum lives raw.
{
  for (const bot of ['v1', 'v2']) {
    const p = path.join(HERE, 'patched', bot, 'bot.js');
    let text = '';
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { text = ''; }
    const callsHelper = text.includes('halt.openUnrealisedSol(lives,');
    const stampsQuote = text.includes("quoteMint: state.position.quoteMint === USDC ? 'USDC' : 'SOL'");
    const rawSumGone = !text.includes('lives.reduce((s, l) => s + (Number(l.pnlSol) || 0), 0)');
    check(`W9 ${bot} liveCycle calls halt.openUnrealisedSol + stamps quoteMint, raw sum gone`,
      text.length > 0 && callsHelper && stampsQuote && rawSumGone,
      `file=${text ? 'read' : 'MISSING'} callsHelper=${callsHelper} stampsQuote=${stampsQuote} rawSumGone=${rawSumGone}`);
  }
  const root = fs.readFileSync(path.join(HERE, 'live-halt.js'), 'utf8');
  const same = ['v1', 'v2'].every((bot) => {
    try { return fs.readFileSync(path.join(HERE, 'patched', bot, 'live-halt.js'), 'utf8') === root; } catch { return false; }
  });
  check('W9 live-halt.js identical in root and both patched trees', same, same ? 'byte-identical' : 'MISMATCH');
}

const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} wiring checks PASS, ${fails.length} FAIL`);
if (fails.length) { console.log('FAILING: ' + fails.map((f) => f.name).join(' | ')); process.exit(1); }
