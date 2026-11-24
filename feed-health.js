// feed-health.js — Item 4a (Warlock live system-readiness).
//
// Feed-health REPORTING only. This module counts, it does not decide.
// The stale-feed RULES (no-open-on-stale-feed, NO_NEW write, on-chain-estimate
// flagging, never-close-on-guessed-price) are plan §3.1.7 and belong to Item 1.
// Nothing in this file may be used to gate a trade; it exists so the daily
// heartbeat and the 6-hourly check can report feed health per hour, and so a
// live feed worse than the paper baseline (~90 CoinGecko 429s/hour/instance,
// 24 Nov 2026) is visible as a finding, not background.
//
// Counters are in-memory rolling-60-minute buckets (one bucket per minute).
// A bot restart resets the counts — the heartbeat reports what it saw this
// hour; the 6h check reads the same snapshot from writeLiveStatusPointer.

const WINDOW_MIN = 60;

function bucket() { return { coingecko429: 0, jupiter429: 0, rpcErrors: 0, stalePolls: 0, quoteWaits: 0, quoteWaitMaxPolls: 0 }; }

let buckets = new Map(); // minute epoch -> bucket
let stalePollsConsecutive = 0;
let lastFreshPriceAt = null; // ISO string of the last fresh SOL/USD read
let lastStaleAt = null;      // ISO string of the last stale SOL/USD read

function minuteKey() { return Math.floor(Date.now() / 60000); }

function prune() {
  const cutoff = minuteKey() - WINDOW_MIN;
  for (const k of buckets.keys()) if (k < cutoff) buckets.delete(k);
}

function cur() {
  prune();
  const k = minuteKey();
  if (!buckets.has(k)) buckets.set(k, bucket());
  return buckets.get(k);
}

function sum(field) {
  prune();
  let n = 0;
  for (const b of buckets.values()) n += b[field] || 0;
  return n;
}

// --- recording entry points (called from bot.js / rpc-config.js) -----------

// CoinGecko 429 seen while fetching SOL/USD.
function recordCoingecko429() { cur().coingecko429 += 1; }

// Jupiter quote/swap 429 (live path only; paper quotes go through paper-quote-client).
function recordJupiter429() { cur().jupiter429 += 1; }

// RPC transport error (v2: rpc-config.makeFetch 429/5xx/network; v1 has no
// in-process RPC counter — see the map: v1 RPC errors/hour is counted by the
// 6h check from bot.log patterns instead).
function recordRpcError() { cur().rpcErrors += 1; }

// A fresh SOL/USD price was obtained (CoinGecko, DexScreener, or the 60 s
// cache hit). Resets the consecutive-stale counter.
function recordFreshPrice() {
  lastFreshPriceAt = new Date().toISOString();
  stalePollsConsecutive = 0;
}

// A SOL/USD read returned a stale cached price (ageMs since the cache write).
// The feed-degraded alert fires at 3 consecutive stale reads (bot.js).
function recordStalePoll(ageMs) {
  cur().stalePolls += 1;
  stalePollsConsecutive += 1;
  lastStaleAt = new Date().toISOString();
}

// A quote-wait event: a position's exit decision could not get a fresh quote
// (paper-exit-policy quoteUnavailablePolls). The EVENT count increments only
// on the first failed poll of a streak (polls === 1); the max polls of any
// streak is tracked separately, so the 10-poll counter is visible.
function recordQuoteWait(polls) {
  const b = cur();
  if (polls <= 1) b.quoteWaits += 1;
  if (polls > b.quoteWaitMaxPolls) b.quoteWaitMaxPolls = polls;
}

// --- snapshot (for the heartbeat, writeLiveStatusPointer, the 6h check) -----

function status() {
  return {
    coingecko429: sum('coingecko429'),
    jupiter429: sum('jupiter429'),
    rpcErrors: sum('rpcErrors'),
    stalePolls: sum('stalePolls'),
    quoteWaits: sum('quoteWaits'),
    quoteWaitMaxPolls: Math.max(...[...buckets.values()].map((b) => b.quoteWaitMaxPolls || 0), 0),
    stalePollsConsecutive,
    lastFreshPriceAt,
    lastStaleAt,
  };
}

function reset() {
  buckets = new Map();
  stalePollsConsecutive = 0;
  lastFreshPriceAt = null;
  lastStaleAt = null;
}

module.exports = { recordCoingecko429, recordJupiter429, recordRpcError, recordFreshPrice, recordStalePoll, recordQuoteWait, status, reset };
