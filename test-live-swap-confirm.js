'use strict';
// Review fix (24 Nov 2026): the Jupiter swaps use the send() confirm loop (re-broadcast + status poll + history check) instead of a
// single confirmTransaction. confirmRaw, sendSwapTx and jupiterSwapLive are taken verbatim from bot.js and run against a fake chain:
// no RPC, no keys, nothing signed.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const bs58 = require('bs58').default || require('bs58');
const src = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8');
const grab = (name) => { const i = src.indexOf(name); if (i < 0) throw new Error('missing ' + name); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const code = ['async function confirmRaw(', 'async function sendSwapTx(', 'async function jupiterSwapLive('].map(grab).join('\n') + '\nglobalThis.fns = { confirmRaw, sendSwapTx, jupiterSwapLive };';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const SIGBYTES = Uint8Array.from({ length: 64 }, (_, i) => i + 1), SIG = bs58.encode(SIGBYTES);

function world(o = {}) {
  const calls = { send: 0, status: 0, history: 0, latest: 0 }, logs = [];
  let height = o.height ?? 100, polls = 0;
  const conn = {
    sendRawTransaction: async (raw, opts) => { calls.send++; if (calls.send === 1 && o.firstSendError) throw new Error(o.firstSendError); return SIG; },
    getSignatureStatuses: async (sigs, opts) => {
      if (opts && opts.searchTransactionHistory) { calls.history++; return { value: [o.history || null] }; }
      calls.status++; polls++;
      if (o.statusThrows && polls <= o.statusThrows) throw new Error('429 Too Many Requests');
      const seq = o.statuses || [];
      return { value: [seq[Math.min(polls - 1 - (o.statusThrows || 0), seq.length - 1)] ?? null] };
    },
    getBlockHeight: async () => (height += o.heightStep ?? 1),
    getLatestBlockhash: async () => { calls.latest++; return { blockhash: 'B', lastValidBlockHeight: o.fetchedLvbh ?? 1e9 }; },
  };
  const vtx = { sign() {}, serialize: () => Buffer.from('raw'), signatures: [SIGBYTES] };
  const ctx = {
    console, Buffer, Number, String, JSON, Date, Promise, Error, BigInt, Math, globalThis: null,
    conn, bs58, CFG: { PAPER: false, DRY_RUN: false }, process: { env: { LIVE_CONFIRMED: '1' } },
    log: (m) => logs.push(m), sleep: async () => {},
    VersionedTransaction: { deserialize: () => vtx }, wallet: { publicKey: { toBase58: () => 'W' } },
    jupiterQuote: async () => ({ ok: true, inUi: 1, outUi: 150, inAmount: 1, outAmount: 150 }),
    jupGetJSON: async () => ({ swapTransaction: 'AA==', lastValidBlockHeight: o.jupLvbh ?? 200 }),
    swapRoute: { swapBodyParams: () => ({}), ROUTE_FEE_BPS: 0 },
    halt: { checkFeeBps: () => ({ ok: true }) },
  };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ...ctx.fns, calls, logs, vtx };
}
const swap = (w) => w.jupiterSwapLive('So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 1000000000n, 9, 6, 'sol-to-usdc');

(async () => {
  await t('swap dropped on the first send: re-broadcast until confirmed, ok with the signature', async () => {
    const w = world({ statuses: [null, null, { confirmationStatus: 'confirmed', err: null }] });
    const r = await swap(w); assert.equal(r.ok, true); assert.equal(r.sig, SIG); assert.ok(w.calls.send >= 3, 're-broadcast'); });
  await t('status RPC errors (429) keep polling: no false failure', async () => {
    const w = world({ statusThrows: 3, statuses: [{ confirmationStatus: 'confirmed', err: null }] });
    const r = await swap(w); assert.equal(r.ok, true); });
  await t('the swap answer lastValidBlockHeight is used (no extra getLatestBlockhash)', async () => {
    const w = world({ statuses: [{ confirmationStatus: 'finalized', err: null }] });
    await swap(w); assert.equal(w.calls.latest, 0); });
  await t('no lastValidBlockHeight in the swap answer: fall back to the fetched height', async () => {
    const w = world({ jupLvbh: 0, statuses: [{ confirmationStatus: 'confirmed', err: null }] });
    await swap(w); assert.equal(w.calls.latest, 1); });
  await t('failed simulation on the first send: not landed, reported at once, nothing re-broadcast', async () => {
    const w = world({ firstSendError: 'Transaction simulation failed: Error processing Instruction 3: custom program error: 0x1771' });
    const r = await swap(w); assert.equal(r.ok, false); assert.ok(/not landed/.test(r.error)); assert.equal(w.calls.send, 1); assert.equal(w.calls.status, 0); });
  await t('network error on the first send: the status loop still finds the landed swap', async () => {
    const w = world({ firstSendError: 'fetch failed', statuses: [{ confirmationStatus: 'confirmed', err: null }] });
    const r = await swap(w); assert.equal(r.ok, true); });
  await t('landed with an on-chain error (slippage): ok false, no throw (nothing moved, a retry is safe)', async () => {
    const w = world({ statuses: [{ confirmationStatus: 'confirmed', err: { InstructionError: [3, { Custom: 6001 }] } }] });
    const r = await swap(w); assert.equal(r.ok, false); assert.equal(r.sig, SIG); });
  await t('blockhash expired, not in history: throws with err.sig (caller re-reads the balance before a retry)', async () => {
    const w = world({ height: 199, statuses: [null] });
    await assert.rejects(swap(w), (e) => e.sig === SIG && /expired/.test(e.message)); assert.equal(w.calls.history, 1); });
  await t('blockhash expired but the swap is in history: success, not a failure', async () => {
    const w = world({ height: 199, statuses: [null], history: { confirmationStatus: 'confirmed', err: null } });
    const r = await swap(w); assert.equal(r.ok, true); });
  await t('status never readable: throws err.sig + err.unknownStatus after the time limit', async () => {
    const w = world({ statusThrows: 1e9 }); const realNow = Date.now; let fake = realNow();
    Date.now = () => (fake += 30_000);
    try { await assert.rejects(swap(w), (e) => e.sig === SIG && e.unknownStatus === true); } finally { Date.now = realNow; } });
  await t('sendSwapTx is blocked without LIVE_CONFIRMED', async () => {
    const src2 = grab('async function sendSwapTx('); assert.ok(/LIVE_CONFIRMED !== '1'\) throw/.test(src2)); });
  await t('bot.js: no live path uses a bare confirmTransaction any more', () => {
    assert.equal((src.match(/confirmTransaction\(/g) || []).length, 0);
    assert.ok(/await sendSwapTx\(vtx, s, `jupiter-\$\{label\}`\)/.test(src)); assert.ok(/await sendSwapTx\(vtx, s, 'jupiter-swap'\)/.test(src)); });
  console.log('all', n, 'tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
