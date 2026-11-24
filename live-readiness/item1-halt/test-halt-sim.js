#!/usr/bin/env node
// Item 1 simulation harness — runs the REAL live-halt.js and the REAL patched
// live-reshape-exec.js / paper-settings.js against paper data.
//
// Paper data: Batch 1 windows, ~/workspace/warlock-division/research/
// batch1-data-2026-11-20/history_{A,B7,D,E}.csv (13/10/11/10 legs, $500 legs,
// SOL ~$72-75). Pilot legs are 1.25 SOL, so each paper leg is scaled by
// 1.25 / (deposit_quote / sol_usd) — the leg-size ratio, per leg. Every
// scenario states what is real paper data and what is synthetic extension.
// A scenario PASSES only if the halt refuses exactly as specified; a
// criterion that does not refuse on simulation is a FAIL (plan §3.3).
//
// Usage: node test-halt-sim.js  (exit 0 = all PASS, 1 = any FAIL)
// Writes test-results.json next to this script.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const HERE = __dirname;
const haltMod = require(path.join(HERE, 'live-halt.js'));
const DATA = '/home/hatch/workspace/warlock-division/research/batch1-data-2026-11-20';
const PILOT_LEG_SOL = 1.25;
const T0 = Date.parse('2026-11-24T10:00:00Z'); // CET 11:00, 24 Nov 2026

const results = [];
function verdict(name, pass, evidence) {
  results.push({ name, pass: !!pass, evidence });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  for (const line of evidence) console.log(`      ${line}`);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readHistory(variant) {
  const text = fs.readFileSync(path.join(DATA, `history_${variant}.csv`), 'utf8');
  const grid = parseCsv(text).filter((r) => r.length > 1);
  const head = grid[0];
  const rows = grid.slice(1).map((cells) => {
    const o = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
  // chronological by entry_wib
  rows.sort((a, b) => String(a.entry_wib).localeCompare(String(b.entry_wib)));
  return rows;
}
// Scale a paper leg to a 1.25 SOL pilot leg. deposit_quote is in QUOTE
// units: SOL for SOL-quoted pools (depQ ~6.4 SOL), USDC for USDC pools
// (depQ ~478 USDC). Paper legs are ~6.4 SOL either way; pilot leg 1.25 SOL.
function scaleLeg(r) {
  const depQ = parseFloat(r.deposit_quote) || 0;
  const px = parseFloat(r.sol_usd) || 74;
  const isSol = (r.quote_symbol || '') === 'SOL';
  const legSolPaper = depQ > 0 ? (isSol ? depQ : depQ / px) : 6.4;
  const k = PILOT_LEG_SOL / legSolPaper;
  return {
    name: r.pair, pool: r.pool, reason: r.exit_reason,
    openedAt: (r.entry_wib || '').replace(' WIB', '').replace(' ', 'T') + ':00.000Z',
    pnlSol: (parseFloat(r.net_pnl_sol) || 0) * k,
    pnlUsdPaper: parseFloat(r.net_pnl_usd) || 0,
    scale: k, legSolPaper,
  };
}

function freshDir(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `halt-sim-${tag}-`));
  return d;
}
function makeHalt(dir, bot) {
  const logs = [], alerts = [];
  fs.copyFileSync(path.join(HERE, bot === 'v2' ? 'halt-params-v2.json' : 'halt-params-v1.json'),
    path.join(dir, 'halt-params.json'));
  const h = haltMod.create({
    dir, bot, log: (m) => logs.push(m),
    notifyEmergency: (rec) => { alerts.push(rec); return Promise.resolve({ ok: true, stubbed: true }); },
    maxFeeBps: bot === 'v2' ? 50 : 0,
  });
  return { h, logs, alerts };
}
const files = (dir) => ({
  HALT: fs.existsSync(path.join(dir, 'HALT')),
  STOP: fs.existsSync(path.join(dir, 'STOP')),
  NO_NEW: fs.existsSync(path.join(dir, 'NO_NEW')),
});
const haltFile = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'HALT'), 'utf8')); } catch { return null; }; };
const hasLog = (logs, re) => logs.some((l) => re.test(l));

// ------------------------------------------------------------------ data
const B7 = readHistory('B7').map(scaleLeg);
const E = readHistory('E').map(scaleLeg);
const A = readHistory('A').map(scaleLeg);
const b7net = B7.reduce((s, l) => s + l.pnlSol, 0);
const eNet = E.reduce((s, l) => s + l.pnlSol, 0);

// ------------------------------------------------------- 0. parameters
{
  const dir = freshDir('params');
  const { h } = makeHalt(dir, 'v1');
  const d = h.params().derived;
  const ok = Math.abs(d.k1Sol - 0.375) < 1e-9 && Math.abs(d.k2Sol - 0.75) < 1e-9
    && Math.abs(d.k4Sol - 0.50) < 1e-9 && Math.abs(d.k5Sol - 1.50) < 1e-9
    && Math.abs(d.k6Sol - 0.75) < 1e-9 && Math.abs(d.dailySol - 0.375) < 1e-9;
  verdict('P0 parameters derive D-0c Rev 1 figures from fractions', ok, [
    `derived: k1=${d.k1Sol} k2=${d.k2Sol} k4=${d.k4Sol} k5=${d.k5Sol} k6=${d.k6Sol} daily=${d.dailySol} SOL`,
    `expected: k1=0.375 k2=0.75 k4=0.50 k5=1.50 k6=0.75 daily=0.375 SOL`,
    `params source: halt-params.json in scenario dir (D-0c table); code default is the same Rev 1 table`,
  ]);
}

// ------------------------------------------------------- 1. K1
{
  const dir = freshDir('k1');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  const worst = B7.find((l) => l.name === 'DCTY-USDC' && l.reason === 'emergency_stop'); // real worst B7 leg
  const r1 = h.recordClose({ pnlSol: worst.pnlSol, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: worst.pool, openedAt: worst.openedAt }, T0);
  const noTripOnWorst = r1.trips.length === 0 && !h.isHalted();
  const r2 = h.recordClose({ pnlSol: -0.40, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: worst.pool, openedAt: worst.openedAt }, T0 + 60000);
  const tripped = h.isHalted() && h.status().tripped.criterion === 'K1';
  const open = h.refuseOpen(T0 + 120000, {});
  const hf = haltFile(dir);
  verdict('K1 single leg <= -30% of leg trips STOP', noTripOnWorst && tripped && !open.ok && files(dir).STOP && files(dir).HALT, [
    `seed (real paper): B7 DCTY-USDC emergency_stop ${worst.pnlUsdPaper} USD -> ${worst.pnlSol.toFixed(4)} SOL scaled (leg ${PILOT_LEG_SOL} SOL); limit -0.375 SOL`,
    `worst known cliff scaled: NO trip (correct — K1 sits beyond the worst known cliff by design)`,
    `synthetic leg -0.40 SOL (worst known +15%): TRIP K1; refuseOpen=${JSON.stringify(open)}`,
    `HALT file: ${JSON.stringify(hf)}; STOP present=${files(dir).STOP}; alert captured=${alerts.length} (criterion in Alasan line: "${(alerts[0] && alerts[0].closeReasonText || '').slice(0, 90)}")`,
    `log line: "${logs.find((l) => /HALT TRIP K1/.test(l)) || 'MISSING'}"`,
  ]);
}

// ------------------------------------------------------- 2. K2
{
  const dir = freshDir('k2');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  // Split the B7 window over CET days 1-2 so no single day breaches the
  // daily limit (day 1 net -0.196, day 2 net -0.329 — both above -0.375);
  // the synthetic leg lands on day 3 (day net -0.30, no breach). Only the
  // cumulative drawdown trips — K2 isolated from K7.
  let t = T0;
  for (const l of B7.slice(0, 5)) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  t = T0 + 26 * 3600e3; h.noteSolUsdAt(t); h.noteScanAt(t);
  for (const l of B7.slice(5)) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  t = T0 + 50 * 3600e3; h.noteSolUsdAt(t); h.noteScanAt(t);
  h.recordClose({ pnlSol: -0.30, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: 'SYNTH', openedAt: '2026-11-26T11:00:00.000Z' }, t);
  const net = h.status().netSol;
  const open = h.checkOpen(t + 60000, { equitySol: 5 + net, openUnrealisedSol: 0 });
  const hf = haltFile(dir);
  verdict('K2 drawdown > 15% of book trips STOP', !open.ok && open.criterion === 'K2' && h.isHalted(), [
    `seed (real paper): B7 window 10 legs scaled, net ${b7net.toFixed(4)} SOL; + synthetic -0.30 SOL leg -> net ${net.toFixed(4)} SOL`,
    `checkOpen(equitySol=${(5 + net).toFixed(4)}): drawdown ${(-net).toFixed(4)} SOL > 0.75 SOL -> ${JSON.stringify(open)}`,
    `HALT file criterion=${hf && hf.criterion}; STOP present=${files(dir).STOP}; alerts=${alerts.length}`,
  ]);
}

// ------------------------------------------------------- 3. K3
{
  const dir = freshDir('k3');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  const stops = [
    B7.find((l) => l.name === 'DCTY-USDC' && l.reason === 'emergency_stop'),
    B7.find((l) => l.name === 'STANK-SOL' && l.reason === 'emergency_stop'),
    E.find((l) => l.name === 'STANK-SOL' && l.reason === 'emergency_stop'),
  ];
  let t = T0; let trips = [];
  stops.forEach((l, i) => {
    const r = h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: l.pool, openedAt: l.openedAt }, t + i * 60000);
    trips = r.trips;
  });
  const ok = h.isHalted() && h.status().tripped.criterion === 'K3' && h.status().consecEmergency === 3;
  verdict('K3 three consecutive emergency stops trips STOP', ok, [
    `seed (real paper, three books, same STANK event 19 Nov 17:45 WIB): B7 DCTY ${stops[0].pnlSol.toFixed(4)} SOL, B7 STANK ${stops[1].pnlSol.toFixed(4)} SOL, E STANK ${stops[2].pnlSol.toFixed(4)} SOL — consecutiveness is synthetic (different books), the stops are real`,
    `consecEmergency=${h.status().consecEmergency}; HALT criterion=${haltFile(dir).criterion}; alerts=${alerts.length}`,
    `note: no K1 trip on these legs (all > -0.375 SOL) — K3 isolated`,
  ]);
}

// ------------------------------------------------------- 4. K4
{
  const dir = freshDir('k4');
  const { h } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  // Real B7 run of 3 consecutive losses (-270.23 USD) + 2 real losses from A.
  // NOTE: the 3 B7 losses are real legs fed consecutively — consecutiveness
  // itself is synthetic (in the real window wins sit between them).
  const run3 = B7.filter((l) => l.pnlSol < 0).slice(0, 3);
  const extra = A.filter((l) => l.pnlSol < 0).slice(0, 2);
  const legs = [...run3, ...extra];
  let t = T0;
  for (const l of legs) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  const sum = legs.reduce((s, l) => s + l.pnlSol, 0);
  const ok = h.isHalted() && h.status().tripped.criterion === 'K4';
  verdict('K4 five consecutive losses totalling < -10% of book trips STOP', ok, [
    `seed (real paper): B7 3-leg run ${run3.map((l) => l.pnlSol.toFixed(3)).join(', ')} + A losses ${extra.map((l) => l.pnlSol.toFixed(3)).join(', ')}`,
    `5-leg sum ${sum.toFixed(4)} SOL < -0.50 SOL -> TRIP K4; consecLosses=${h.status().consecLosses}; HALT criterion=${haltFile(dir).criterion}`,
  ]);
}

// ------------------------------------------------------- 5. K5
{
  const dir = freshDir('k5');
  const { h } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  // K5 can only trip via MULTI-leg clusters at this scale: with single-leg
  // clusters the worst-3 sum without tripping K1 is at most 3 x 0.375 =
  // 1.125 SOL, below the 1.50 bar — K1 subsumes K5 for single-leg clusters
  // (finding for Warlock Head; see TEST-EVIDENCE.md). So the demo builds
  // three 2-leg clusters of -0.28 SOL legs (each under the K1 tripwire),
  // interleaved with +0.01 wins and spread over days so K4 (run < 5) and
  // K7 (no day under -0.375) stay silent. Leg size -0.28 SOL = 22.4% of a
  // 1.25 SOL leg: a bad-but-not-cliff leg. K2 is not evaluated by
  // recordClose, so it cannot pre-empt K5 here.
  const legs = [];
  const pools = ['POOL-A', 'POOL-B', 'POOL-C'];
  for (let c = 0; c < 3; c++) {
    for (let j = 0; j < 2; j++) {
      legs.push({ pnlSol: -0.28, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: pools[c], openedAt: `2026-11-24T1${c}:00:00.000Z` }); // both legs of a cluster share pool + entry minute
      legs.push({ pnlSol: +0.01, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: `WIN-${c}-${j}`, openedAt: `2026-11-24T1${c}:1${j}:00.000Z` });
    }
  }
  let t = T0;
  for (const l of legs) {
    h.recordClose(l, t);
    t += 26 * 3600e3; // one leg per CET day: no daily breach, no loss run
    h.noteSolUsdAt(t); h.noteScanAt(t);
  }
  const ok = h.isHalted() && h.status().tripped.criterion === 'K5';
  verdict('K5 worst-3 entry clusters combined < -30% of book trips STOP', ok, [
    `seed (real paper): B7 worst-3 single-leg clusters DCTY -0.364, STANK -0.293, :3 -0.049 SOL; real sum -0.7045 SOL — far below the -1.50 bar, so NO real paper window trips K5 at pilot scale`,
    `reachability finding: with single-leg clusters the worst-3 sum without tripping K1 is at most 3 x 0.375 = 1.125 SOL < 1.50 — K1 subsumes K5 unless clusters hold multiple legs (e.g. a reposition re-entering the same pool in the same minute)`,
    `demo: 3 clusters x 2 legs of -0.28 SOL (under the K1 tripwire), +0.01 wins interleaved, one leg per CET day -> worst-3 sum -1.68 SOL < -1.50 -> TRIP K5; HALT criterion=${haltFile(dir).criterion}; figures=${JSON.stringify(h.status().tripped.figures)}`,
    `K4/K7 silent by construction (loss run never exceeds 1; no day under -0.375); K2 not evaluated by recordClose`,
  ]);
}

// ------------------------------------------------------- 6. K6 (legs branch)
{
  const dir = freshDir('k6');
  const { h, logs } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  // B7 split over CET days 1-2 (day nets -0.196 / -0.329 — no daily breach),
  // then 20 synthetic -0.013 SOL legs on day 3 (day net -0.26, no breach).
  let t = T0;
  for (const l of B7.slice(0, 5)) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  t = T0 + 26 * 3600e3; h.noteSolUsdAt(t); h.noteScanAt(t);
  for (const l of B7.slice(5)) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  const t2 = T0 + 50 * 3600e3;
  h.noteSolUsdAt(t2); h.noteScanAt(t2);
  for (let i = 0; i < 20; i++) {
    h.recordClose({ pnlSol: -0.013, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: `SYNTH${i}`, openedAt: '2026-11-25T11:00:00.000Z' }, t2 + i * 60000);
  }
  const st = h.status();
  const ok = h.isHalted() && st.tripped.criterion === 'K6' && st.closedLegs === 30;
  verdict('K6 net < -15% of book after 30 closed legs trips STOP', ok, [
    `seed: B7 10 legs over days 1-2 (day nets -0.196 / -0.329 — no daily breach) + 20 synthetic -0.013 SOL legs day 3 (day net -0.26, no breach)`,
    `closedLegs=${st.closedLegs}, netSol=${st.netSol.toFixed(4)} SOL < -0.75 -> TRIP K6; HALT criterion=${st.tripped.criterion}`,
    `no other criterion fired first: K1 worst leg -0.364 > -0.375, K3 max 2 consecutive emergency stops, K4 longest loss run 2, K7 no day breached`,
  ]);
}

// ---------------------------------------------- 6b. K6 (7-day time branch)
{
  const dir = freshDir('k6time');
  const { h } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  h.checkOpen(T0, { equitySol: 5 }); // sets pilotStartAt = T0
  // Simulate a restart 8 days later with net -0.80: rewrite pilotStartAt.
  const sf = path.join(dir, 'halt-state.json');
  const s = JSON.parse(fs.readFileSync(sf, 'utf8'));
  s.pilotStartAt = new Date(T0 - 8 * 86400e3).toISOString();
  s.netSol = -0.80; s.closedLegs = 12; s.dayKey = '2026-12-02'; s.dayNetSol = 0;
  fs.writeFileSync(sf, JSON.stringify(s, null, 2));
  const h2 = haltMod.create({ dir, bot: 'v1', log: () => {}, notifyEmergency: () => Promise.resolve({ ok: true }), maxFeeBps: 0 });
  const t2 = T0 + 8 * 86400e3;
  h2.noteSolUsdAt(t2); h2.noteScanAt(t2);
  // Open unrealised +0.10 SOL keeps the K2 drawdown at 0.70 SOL (under the
  // 0.75 bar) so the K6 time branch is the one that trips — K2 would
  // otherwise subsume it, which is correct behaviour, not a K6 failure.
  const open = h2.checkOpen(t2, { equitySol: 4.30, openUnrealisedSol: 0.10 });
  const ok = !open.ok && open.criterion === 'K6' && h2.isHalted();
  verdict('K6 net < -15% of book at the 7-day close trips STOP', ok, [
    `pilotStartAt rewound 8 days (restart simulation); net -0.80 SOL, 12 legs, open unrealised +0.10 SOL`,
    `checkOpen(equitySol=4.30) -> ${JSON.stringify(open)}; HALT criterion=${haltFile(dir).criterion}`,
  ]);
}

// ------------------------------------------------------- 7. K7 (daily)
{
  const dir = freshDir('k7');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  let t = T0;
  for (const l of B7) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  const day1 = h.status();
  const openDay1 = h.refuseOpen(t + 60000, {});
  const noNewAfterDay1 = files(dir).NO_NEW; // captured now: day rollover lifts it on day 2, by design
  // Day 2 (CET): two more losing legs -> second breach -> STOP.
  const t2 = T0 + 26 * 3600e3;
  h.noteSolUsdAt(t2); h.noteScanAt(t2);
  h.recordClose({ pnlSol: -0.20, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: 'SYNTH', openedAt: '2026-11-25T11:00:00.000Z' }, t2);
  h.recordClose({ pnlSol: -0.20, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: 'SYNTH', openedAt: '2026-11-25T11:01:00.000Z' }, t2 + 60000);
  const day2 = h.status();
  const ok = day1.dailyNoNew && day1.dailyNoNew.breaches === 1 && noNewAfterDay1
    && !openDay1.ok && h.status().dailyNoNew === null // day-1 pause expired at the day boundary (day-scoped, not latched)
    && h.isHalted() && h.status().tripped.criterion === 'K7' && day2.dayBreaches === 2;
  verdict('K7 daily-loss breaker: 1st breach NO_NEW rest of day, 2nd breach STOP', ok, [
    `seed (real paper): B7 window day net ${b7net.toFixed(4)} SOL <= -0.375 SOL -> breach 1: NO_NEW written (present after day 1: ${noNewAfterDay1}), refuseOpen=${JSON.stringify(openDay1)}`,
    `day 2 (synthetic, -0.40 SOL): breach 2 -> TRIP K7 STOP; HALT criterion=${haltFile(dir).criterion}; dayBreaches=${day2.dayBreaches}`,
    `day-1 NO_NEW was lifted at the CET day boundary (daily pause is day-scoped, not latched); alerts captured=${alerts.length} (1st NO_NEW alert + STOP alert)`,
  ]);
}

// ------------------------------------------------------- 8. K8
{
  // 8a. quote-vs-fill gap, 2 consecutive exits.
  const dir = freshDir('k8gap');
  const { h } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  const r1 = h.recordClose({ pnlSol: -0.05, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P1', openedAt: '2026-11-24T11:00:00.000Z', quotedSol: 1.30, realisedSol: 1.22 }, T0);
  const gap1NoTrip = r1.trips.length === 0 && h.status().consecGap === 1;
  const r2 = h.recordClose({ pnlSol: -0.05, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P2', openedAt: '2026-11-24T11:05:00.000Z', quotedSol: 1.30, realisedSol: 1.21 }, T0 + 60000);
  const okGap = gap1NoTrip && h.isHalted() && h.status().tripped.criterion === 'K8';
  verdict('K8 quote-vs-fill gap > 0.0625 SOL/leg on 2 consecutive exits trips STOP', okGap, [
    `gap is a live-only quantity (paper has no fills): exit 1 gap 0.080 SOL -> consecGap=1, no trip; exit 2 gap 0.090 SOL -> TRIP K8`,
    `HALT figures=${JSON.stringify(h.status().tripped.figures)}`,
  ]);
  // 8b. fee at execution: v1 max 0 bps, v2 max 50 bps.
  const d1 = freshDir('k8feev1'); const hv1 = makeHalt(d1, 'v1').h;
  const f1 = hv1.checkFeeBps(50, 'open');
  const d2 = freshDir('k8feev2'); const hv2 = makeHalt(d2, 'v2').h;
  const f2ok = hv2.checkFeeBps(50, 'open');
  const f2trip = hv2.checkFeeBps(51, 'open');
  // 8b2. fail-closed (N4 fix): an unreadable fee trips K8 instead of
  // passing (each input on a fresh instance so the latch cannot mask it).
  const failClosed = [null, undefined, NaN, 'abc'].map((bad) => {
    const hx = makeHalt(freshDir('k8feefail'), 'v1').h;
    const r = hx.checkFeeBps(bad, 'open');
    return r.ok === false && r.criterion === 'K8' && hx.isHalted() && hx.status().tripped.criterion === 'K8';
  });
  // recordClose: a fee that IS supplied but unreadable trips; an absent
  // fee (no observation) does not.
  const hr = makeHalt(freshDir('k8feerclose'), 'v1').h;
  hr.recordClose({ pnlSol: -0.01, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P', openedAt: '2026-11-24T11:00:00.000Z', feeBps: 'abc' }, T0);
  const rCloseTrips = hr.isHalted() && hr.status().tripped.criterion === 'K8';
  const hr2 = makeHalt(freshDir('k8feerclose2'), 'v1').h;
  hr2.recordClose({ pnlSol: -0.01, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P', openedAt: '2026-11-24T11:00:00.000Z' }, T0);
  const absentOk = !hr2.isHalted();
  verdict('K8 fee at execution: v1 any fee > 0 bps trips; v2 50 bps ok, 51 bps trips', !f1.ok && f1.criterion === 'K8' && f2ok.ok && !f2trip.ok && f2trip.criterion === 'K8' && failClosed.every(Boolean) && rCloseTrips && absentOk, [
    `v1 checkFeeBps(50) -> ${JSON.stringify(f1)} (patched fee is 0 bps; a restored 50 bps upstream fee trips before any swap is sent)`,
    `v2 checkFeeBps(50) -> ok (disclosed 50 bps); checkFeeBps(51) -> ${JSON.stringify(f2trip)}`,
    `fail-closed (N4 fix): checkFeeBps(null/undefined/NaN/'abc') all trip K8 STOP (was ok:true fail-open): ${failClosed.map((x) => (x ? 'TRIP' : 'PASS-THROUGH')).join(', ')}`,
    `recordClose fee branch (N4): feeBps='abc' supplied -> TRIP K8 (${rCloseTrips}); feeBps absent -> no trip (${absentOk}; absent = no observation, the open/swap-time gate is what sees ROUTE_FEE_BPS)`,
  ]);
  // 8c. gate state.
  const d3 = freshDir('k8gate'); const hg = makeHalt(d3, 'v1').h;
  const g1 = hg.checkGate({ paper: true, dryRun: false, liveConfirmed: true });
  const g2 = hg.checkGate({ paper: false, dryRun: false, liveConfirmed: true });
  verdict('K8 gate state: LIVE_CONFIRMED=1 while PAPER=1 trips; clean live gate passes', !g1.ok && g1.criterion === 'K8' && g2.ok, [
    `checkGate({paper:true, liveConfirmed:true}) -> ${JSON.stringify(g1)}`,
    `checkGate({paper:false, dryRun:false, liveConfirmed:true}) -> ok`,
    `note: "STOP absent while live" is NOT implemented literally — see BUILD-NOTE.md ambiguity A1`,
  ]);
}

// ------------------------------------------------------- 9. negative test
{
  const dir = freshDir('neg');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  let t = T0;
  for (const l of E) { h.recordClose({ pnlSol: l.pnlSol, legSol: PILOT_LEG_SOL, reason: l.reason, pool: l.pool, openedAt: l.openedAt }, t); t += 60000; }
  // A live feed refreshes every poll: note fresh price + scan at check time.
  h.noteSolUsdAt(t); h.noteScanAt(t);
  const open = h.refuseOpen(t, {});
  const open2 = h.checkOpen(t, { equitySol: 5 + h.status().netSol, openUnrealisedSol: 0 });
  const f = files(dir);
  const ok = !h.isHalted() && open.ok && open2.ok && !f.HALT && !f.STOP && !f.NO_NEW && alerts.length === 0;
  verdict('NEGATIVE full real Book E window (13 legs, net positive) — no halt, opens proceed', ok, [
    `seed (real paper): Book E 13 legs scaled, net ${eNet.toFixed(4)} SOL, worst leg ${Math.min(...E.map((l) => l.pnlSol)).toFixed(4)} SOL, 1 emergency stop (not 3), longest loss run 1`,
    `refuseOpen=${JSON.stringify(open)}; checkOpen(equitySol=${(5 + h.status().netSol).toFixed(4)})=${JSON.stringify(open2)}`,
    `files: HALT=${f.HALT} STOP=${f.STOP} NO_NEW=${f.NO_NEW}; alerts=${alerts.length}; log HALT lines=${logs.filter((l) => /HALT/.test(l)).length}`,
    `counter-check: replaying real B7 alone DOES trip K7-daily (day net ${b7net.toFixed(4)} SOL <= -0.375) — a true trip, not a false one (see K7 scenario)`,
  ]);
}

// ------------------------------------------------------- 10. latch + restart
{
  const dir = freshDir('latch');
  const { h, logs } = makeHalt(dir, 'v1');
  h.noteSolUsdAt(T0); h.noteScanAt(T0);
  h.recordClose({ pnlSol: -0.40, legSol: PILOT_LEG_SOL, reason: 'emergency_stop', pool: 'P', openedAt: '2026-11-24T11:00:00.000Z' }, T0);
  h.recordClose({ pnlSol: +0.50, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P', openedAt: '2026-11-24T11:05:00.000Z' }, T0 + 60000);
  const stillRefused = !h.refuseOpen(T0 + 120000, {}).ok;
  // Simulated restart: brand-new instance, same dir (state file + HALT file).
  const h2 = haltMod.create({ dir, bot: 'v1', log: () => {}, notifyEmergency: () => Promise.resolve({ ok: true }), maxFeeBps: 0 });
  const restartRefused = !h2.refuseOpen(T0 + 180000, {}).ok && h2.isHalted();
  // Simulated state loss: delete halt-state.json, keep HALT file.
  fs.unlinkSync(path.join(dir, 'halt-state.json'));
  const h3logs = [];
  const h3 = haltMod.create({ dir, bot: 'v1', log: (m) => h3logs.push(m), notifyEmergency: () => Promise.resolve({ ok: true }), maxFeeBps: 0 });
  const fileOnlyRefused = !h3.refuseOpen(T0 + 240000, {}).ok && h3.isHalted();
  // N6 fix: corrupt state with NO HALT file alerts (notifyEmergency) and
  // refuses nothing — accounting restarts fresh, but someone is told.
  const dirN6 = freshDir('latch-corrupt');
  const n6 = makeHalt(dirN6, 'v1');
  n6.h.noteSolUsdAt(T0); n6.h.noteScanAt(T0);
  n6.h.recordClose({ pnlSol: -0.10, legSol: PILOT_LEG_SOL, reason: 'take_profit', pool: 'P', openedAt: '2026-11-24T11:00:00.000Z' }, T0);
  fs.writeFileSync(path.join(dirN6, 'halt-state.json'), 'NOT JSON AT ALL');
  const n6alerts = [];
  const hN6 = haltMod.create({ dir: dirN6, bot: 'v1', log: () => {}, notifyEmergency: (rec) => { n6alerts.push(rec); return Promise.resolve({ ok: true }); }, maxFeeBps: 0 });
  const corruptAlert = n6alerts.some((a) => a.haltCriterion === 'halt-state-corrupt');
  hN6.noteSolUsdAt(T0 + 60000); hN6.noteScanAt(T0 + 60000);
  const corruptFresh = !hN6.isHalted() && hN6.status().closedLegs === 0 && hN6.refuseOpen(T0 + 60000, { scanAt: T0 + 60000 }).ok;
  verdict('LATCH restart never auto-clears; HALT file alone re-latches', stillRefused && restartRefused && fileOnlyRefused && corruptAlert && corruptFresh, [
    `after K1 trip, a +0.50 SOL win: refuseOpen still refuses (figures improving does not clear the latch)`,
    `simulated restart (new instance, same dir): still refused, tripped=${h2.status().tripped.criterion}`,
    `halt-state.json deleted, HALT file kept: new instance re-latches from HALT file (recoveredFromHaltFile) and refuses; log: "${h3logs.find((l) => /re-latched/.test(l)) || ''}"`,
    `manual reset path (not automated): sole removes HALT + STOP after review — the module never deletes them itself`,
    `N6 fix: corrupt state + NO HALT file -> halt-state-corrupt alert captured=${corruptAlert} (alert-only: not halted, closedLegs reset to 0, refuseOpen ok=${corruptFresh})`,
  ]);
}

// ------------------------------------------------------- 11. feed rules
{
  const dir = freshDir('feed');
  const { h, logs, alerts } = makeHalt(dir, 'v1');
  const staleAt = T0 - 15 * 60e3; // last good price + scan 15 min ago (> 2 polls = 10 min)
  h.noteSolUsdAt(staleAt); h.noteScanAt(staleAt);
  const refused = h.refuseOpen(T0, {});
  let degraded = null;
  for (let i = 0; i < 3; i++) { degraded = h.checkFeed(T0 + i * 300e3, {}); }
  const f = files(dir);
  const lifted = (() => {
    h.noteSolUsdAt(T0 + 4 * 300e3); h.noteScanAt(T0 + 4 * 300e3);
    const r = h.checkFeed(T0 + 4 * 300e3, {});
    return r.ok && !files(dir).NO_NEW && h.refuseOpen(T0 + 4 * 300e3, {}).ok;
  })();
  verdict('FEED stale feed refuses opens; 3 stale polls -> feed-degraded NO_NEW; fresh price lifts it', !refused.ok && refused.criterion === 'feed-stale' && degraded && !degraded.ok && f.NO_NEW && lifted, [
    `last good SOL/USD + scan 15 min ago (> 2 polls / 10 min): refuseOpen=${JSON.stringify(refused)}`,
    `checkFeed x3 stale polls: NO_NEW written=${f.NO_NEW}; feed-degraded alert captured=${alerts.length > 0}; log: "${logs.find((l) => /feed stale 3 consecutive/.test(l)) || 'MISSING'}"`,
    `fresh price + scan: feed NO_NEW lifted, refuseOpen ok again (NO_NEW file present=${files(dir).NO_NEW})`,
    `note: exits are NOT blocked by a stale feed (they use the quote -> 10-poll on-chain-estimate order and are flagged); only new opens are refused`,
  ]);
}

// ------------------------------------------------------- 12. RESHAPE_MAX
{
  const out = [];
  for (const bot of ['v1', 'v2']) {
    const modDir = path.join(HERE, 'patched', bot);
    const trig = require(path.join(modDir, 'live-reshape-exec.js')).trigger;
    const rows = [];
    for (let r = 0; r <= 6; r++) {
      const res = trig({ pos: { reshapes: r, entryActiveBin: 100 }, activeBinId: 95, settings: { RESHAPE_N: 5, RESHAPE_MAX: 5 }, stop: false });
      rows.push(`${r}:${res.due ? 'due' : res.capped ? 'CAPPED' : 'not-due'}`);
    }
    const ok = rows.slice(0, 5).every((x) => x.endsWith(':due')) && rows[5] === '5:CAPPED' && rows[6] === '6:CAPPED';
    out.push(`${bot} trigger reshapes 0..6 (down=5, N=5, MAX=5): ${rows.join(' ')} -> ${ok ? 'cap enforced' : 'CAP FAILED'}`);
    // explicit override wins
    const ov = trig({ pos: { reshapes: 3, entryActiveBin: 100 }, activeBinId: 95, settings: { RESHAPE_N: 5, RESHAPE_MAX: 3 }, stop: false });
    out.push(`${bot} explicit RESHAPE_MAX=3, reshapes=3: ${ov.capped ? 'CAPPED (setting honoured)' : 'NOT CAPPED — FAIL'}`);
    if (!ok || !ov.capped) { verdict(`RESHAPE_MAX per-leg cap (${bot})`, false, out); }
  }
  // settings flow: currentValues() on the real paper-settings.js
  const flow = [];
  for (const bot of ['v1', 'v2']) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `halt-ps-${bot}-`));
    const tmpPaper = path.join(tmpRoot, 'paper');
    fs.mkdirSync(tmpPaper, { recursive: true });
    process.env.LP_BOT_DIR = tmpRoot;
    process.env.LP_PAPER_DIR = tmpPaper;
    delete require.cache[require.resolve(path.join(HERE, 'patched', bot, 'paper-settings.js'))];
    const ps = require(path.join(HERE, 'patched', bot, 'paper-settings.js'));
    const v = ps.currentValues(tmpPaper).RESHAPE_MAX;
    flow.push(`${bot} patched currentValues().RESHAPE_MAX=${v}`);
    delete require.cache[require.resolve(path.join(HERE, 'pristine', bot, 'paper-settings.js'))];
    const ps0 = require(path.join(HERE, 'pristine', bot, 'paper-settings.js'));
    const v0 = ps0.currentValues(tmpPaper).RESHAPE_MAX;
    flow.push(`${bot} PRISTINE currentValues().RESHAPE_MAX=${v0} (no settings.json present)`);
  }
  const v1ok = /v1 patched currentValues\(\).RESHAPE_MAX=5/.test(flow.join(' '));
  const v2ok = /v2 patched currentValues\(\).RESHAPE_MAX=5/.test(flow.join(' '));
  verdict('RESHAPE_MAX per-leg cap of 5 enforced by the live trigger; settings honour it', v1ok && v2ok, [
    ...out,
    ...flow,
    `v2 pristine returns null here: the 23 Nov port set the FIELDS default to 5 but left DEFAULTS null, and the running v2 paper tree has no settings.json — the paper freeze gate never fired there. The v2 paper-settings patch (DEFAULTS null -> 5) closes that.`,
    `v1 pristine has no RESHAPE_MAX key at all (only variant-E VARIANT_SETTINGS); the v1 paper-settings patch adds DEFAULTS + FIELDS entries.`,
  ]);
}

// ------------------------------------------------------------------ summary
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} scenarios PASS, ${fails.length} FAIL`);
fs.writeFileSync(path.join(HERE, 'test-results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
if (fails.length) { console.log('FAILING: ' + fails.map((f) => f.name).join(' | ')); process.exit(1); }
