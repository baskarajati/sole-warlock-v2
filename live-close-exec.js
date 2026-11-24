'use strict';
// Swap back for live == the dry run (paper-usdc.exitQuote): the token goes to USDC DIRECTLY, and the position's whole SOL pile
// (quote side + leftover + refunded rent - fees = wallet SOL now minus wallet SOL before the position was opened) goes to USDC.
// Nothing else in the wallet is touched (no fixed SOL reserve): the wallet's own SOL is exactly what it was before the position.
// All chain calls are injected, so the sequence is unit-tested with fakes; this module signs nothing itself.
// SWEEP (dust fix): after the position's own tokens are sold, if the caller confirms no other open position shares this mint
// (canSweepStray), any token balance left of that mint is dust from an earlier close whose swap failed, and it is sold too,
// so nothing is ever left behind in the wallet. The sweep is best-effort: it never fails the close.
const SWAP_FEE_KEEP = 0.003;   // SOL that must stay to pay the pile swap itself
const SOL_DUST = 0.0005;   // below this a swap costs more than it returns (a swap of the pile is skipped only under this)
async function swapBack({ pos, pileSol, getToken, swapTokenToUsdc, closeTokenAccounts, getSolBalance, swapSolToUsdc, getUsdcBalance, sleep = async () => {}, log = () => {}, retries = 3, canSweepStray = null }) {
  const out = { usdcBefore: await getUsdcBalance(), usdcQuoted: 0, tokenSwapped: 0, straySwapped: 0, solSwapped: 0, errors: [] };
  const attempt = async (name, fn) => { for (let i = 1; i <= retries; i++) { try { return await fn(i); } catch (e) { out.errors.push(`${name} #${i}: ${e.message}`); log(`  ${name} failed (${i}/${retries}): ${e.message}`); await sleep(2000); } } return null; };
  const tok = await getToken();
  if (tok && tok.raw > 0n) {
    let maybeSent = false;   // review fix: true once a swap call THREW (it may have landed); a plain ok:false was never sent
    const r = await attempt('token->USDC', async (i) => { let amt = tok.raw;
      // A swap can land and still throw (confirm timeout). Before such a retry, re-read the wallet: tokens gone = the earlier swap
      // landed, so it is done; otherwise sell only what is still there (never more than the first amount).
      if (i > 1 && maybeSent) { const now = await getToken(); const left = now ? now.raw : 0n; if (left * 100n <= tok.raw) return { ok: true, landedEarlier: true }; if (left < amt) amt = left; }
      let x; try { x = await swapTokenToUsdc(amt, tok.decimals); } catch (e) { maybeSent = true; throw e; }
      if (!x || x.ok === false) throw new Error((x && x.error) || 'swap failed'); return x; });
    if (r) { out.usdcQuoted += Number(r.outUi) || 0; out.tokenSwapped = Number(tok.raw); await attempt('close token account', () => closeTokenAccounts(tok)); }
    await sleep(3000);
  }
  // SWEEP stray dust of this mint (see header): only when the position's own tokens are gone and no other open position shares the mint.
  const mainSwapOk = !(tok && tok.raw > 0n) || out.tokenSwapped > 0;
  if (mainSwapOk && canSweepStray) {
    try {
      if (await canSweepStray()) {
        const tok2 = await getToken();
        const stray = tok2 ? (tok2.total != null ? tok2.total : tok2.raw) : 0n;
        if (stray > 0n) {
          const r2 = await attempt('stray->USDC', async () => { const x = await swapTokenToUsdc(stray, tok2.decimals); if (!x || x.ok === false) throw new Error((x && x.error) || 'swap failed'); return x; });
          if (r2) { out.usdcQuoted += Number(r2.outUi) || 0; out.straySwapped = Number(stray); await attempt('close token account', () => closeTokenAccounts(tok2)); }
        }
      }
    } catch (e) { out.errors.push('sweep: ' + (e && e.message || e)); log('  sweep failed: ' + (e && e.message || e)); }
  }
  const sol = await getSolBalance();
  // pileSol = this position's own SOL (leftover buffer + refunded rent + quote side - fees), exactly book.virtual.sol of the dry run; other positions' SOL is never touched.
  // Fallback (no pileSol): wallet SOL minus the wallet SOL before the position opened. Always capped by what the wallet really holds (keep a little for the swap fee).
  const own = pileSol != null ? pileSol : sol - (pos.walletBefore || 0);
  const pile = Math.max(0, Math.min(own, sol - SWAP_FEE_KEEP));
  out.solPile = pile;
  if (pile > SOL_DUST) {
    let maybeSent = false;
    const r = await attempt('SOL pile->USDC', async (i) => {
      // Review fix: if an earlier try threw after sending, the pile may already have left the wallet. A blind retry swapped it a
      // second time and took the SOL that other open positions need for their fees. Re-read the balance before such a retry.
      if (i > 1 && maybeSent) { const now = await getSolBalance(); if (sol - now >= pile * 0.9) return { ok: true, landedEarlier: true }; }
      let x; try { x = await swapSolToUsdc(BigInt(Math.round(pile * 1e9))); } catch (e) { maybeSent = true; throw e; }
      if (!x || x.ok === false) throw new Error((x && x.error) || 'swap failed'); return x; });
    if (r) { out.usdcQuoted += Number(r.outUi) || 0; out.solSwapped = pile; }
  }
  await sleep(2000);
  // Review fix: the swaps are done now, so a failed balance read must not throw (a resumed close would swap again).
  // Retry; if the RPC still fails, book the swap quotes and flag the row as an estimate.
  out.usdcAfter = null;
  for (let k = 0; k < 3 && out.usdcAfter == null; k++) { try { out.usdcAfter = await getUsdcBalance(); } catch (e) { log(`  USDC balance after swap-back failed (${k + 1}/3): ${e.message}`); await sleep(2000); } }
  if (out.usdcAfter == null) { out.usdcAfter = out.usdcBefore + out.usdcQuoted; out.usdcAfterEstimated = true; log('  USDC after swap-back unreadable: booked from the swap quotes (estimate)'); }
  out.usdcOut = out.usdcAfter - out.usdcBefore;
  out.complete = out.errors.length === 0 || (out.tokenSwapped > 0 || !(tok && tok.raw > 0n)) && (out.solSwapped > 0 || pile <= SOL_DUST);
  return out;
}
// SOL capital (== exitSolQuote): only the token goes to SOL; the native SOL pile and the SOL quote side stay in the wallet (capital IS SOL). No USDC leg.
async function swapBackSol({ pos, getToken, swapTokenToSol, closeTokenAccounts, getSolBalance, sleep = async () => {}, log = () => {}, retries = 3, canSweepStray = null }) {
  const out = { tokenSwapped: 0, straySwapped: 0, errors: [], solBefore: await getSolBalance() };
  const attempt = async (name, fn) => { for (let i = 1; i <= retries; i++) { try { return await fn(i); } catch (e) { out.errors.push(`${name} #${i}: ${e.message}`); log(`  ${name} failed (${i}/${retries}): ${e.message}`); await sleep(2000); } } return null; };
  const tok = await getToken();
  if (tok && tok.raw > 0n) {
    let maybeSent = false;   // review fix: true once a swap call THREW (it may have landed); a plain ok:false was never sent
    const r = await attempt('token->SOL', async (i) => { let amt = tok.raw;
      // A swap can land and still throw (confirm timeout). Before such a retry, re-read the wallet: tokens gone = the earlier swap
      // landed, so it is done; otherwise sell only what is still there (never more than the first amount).
      if (i > 1 && maybeSent) { const now = await getToken(); const left = now ? now.raw : 0n; if (left * 100n <= tok.raw) return { ok: true, landedEarlier: true }; if (left < amt) amt = left; }
      let x; try { x = await swapTokenToSol(amt, tok.decimals); } catch (e) { maybeSent = true; throw e; }
      if (!x || x.ok === false) throw new Error((x && x.error) || 'swap failed'); return x; });
    if (r) { out.tokenSwapped = Number(tok.raw); await attempt('close token account', () => closeTokenAccounts(tok)); }
    await sleep(3000);
  }
  // SWEEP stray dust of this mint (see header): only when the position's own tokens are gone and no other open position shares the mint.
  const mainSwapOk = !(tok && tok.raw > 0n) || out.tokenSwapped > 0;
  if (mainSwapOk && canSweepStray) {
    try {
      if (await canSweepStray()) {
        const tok2 = await getToken();
        const stray = tok2 ? (tok2.total != null ? tok2.total : tok2.raw) : 0n;
        if (stray > 0n) {
          const r2 = await attempt('stray->SOL', async () => { const x = await swapTokenToSol(stray, tok2.decimals); if (!x || x.ok === false) throw new Error((x && x.error) || 'swap failed'); return x; });
          if (r2) { out.straySwapped = Number(stray); await attempt('close token account', () => closeTokenAccounts(tok2)); }
        }
      }
    } catch (e) { out.errors.push('sweep: ' + (e && e.message || e)); log('  sweep failed: ' + (e && e.message || e)); }
  }
  out.solAfter = await getSolBalance();
  out.complete = !(tok && tok.raw > 0n) || out.tokenSwapped > 0;
  return out;
}
module.exports = { swapBack, swapBackSol, SOL_DUST };
