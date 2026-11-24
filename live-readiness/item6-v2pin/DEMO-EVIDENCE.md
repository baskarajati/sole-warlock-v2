# Item 6 — Read-only demonstration on the v2 paper instance

**Track:** Warlock live system-readiness, Item 6 (v2 settings-pin verification, C1)
**Procedure under test:** `PROCEDURE.md` (§4)
**Instance:** `~/apps/warlock-v2`, service `warlock-v2-paper.service`
**Pin table in force for this instance:** E-config (§2B of the procedure —
Book E on the v2 codebase, SOL-denominated, 14 SOL / 7 positions / 2.0 SOL
per open). The README pin (§2A) does **not** apply to this instance; it is
the live-build base and is recorded in the procedure for the future build.
**Date/time of demo:** 2026-11-24, ~17:39–17:41 CET
**Method:** read-only SSH only, exactly as tasked:

```
ssh -o StrictHostKeyChecking=accept-new -o ProxyCommand='python3 ~/workspace/oversight-division/ssh-via-tunnel.py %h %p' sunteak@100.99.178.98 '<read-only command>'
```

**No VPS write was made by this item.** Commands run were `systemctl --user
status`, `ls -l`, `grep`, `sed -n` (read), `cat` (read), and `python3 -c`
JSON reads. No file was created, edited, restarted, or stopped on the VPS.
No key material was read (`.env` was read by named-key `grep` only, never
`cat`; `secrets/` was never touched).

---

## 1. Step 1 — Service / process identity

Command: `systemctl --user status warlock-v2-paper.service --no-pager | head -n 12`

```
● warlock-v2-paper.service - Warlock 2.0 paper trading bot (PAPER/DRY_RUN only)
     Loaded: loaded (/home/sunteak/.config/systemd/user/warlock-v2-paper.service; disabled; preset: enabled)
     Active: active (running) since Mon 2026-11-23 22:06:15 CET; 19h ago
   Main PID: 1223431 (sol-paper-exec.)
      Tasks: 12 (limit: 14306)
     Memory: 190.3M (peak: 193.3M)
        CPU: 16min 54.751s
     CGroup: /user.slice/user-1000.slice/user@1000.service/app.slice/warlock-v2-paper.service
             ├─1223431 /bin/bash /home/sunteak/apps/warlock-v2/sol-paper-exec.sh
             └─1223438 node bot.js
```

- Current process start: **23 Nov 2026 22:06:15 CET** (= 24 Nov 04:06:15 WIB).
- Main PID **1223431** — the same PID as the 23 Nov 22:06 creator-sizing
  restart (E-config deploy report, Addendum 2) and the 24 Nov ~09:51 CET
  E-config re-verification. The instance has **not restarted** since.
- The instance was trading at demo time (log tail showed a `greg-SOL`
  monitor line at 17:38:25 CET); the demo disturbed nothing — read-only
  throughout. Window state at demo time (`paper/summary.json`):
  `capitalAsset=SOL`, `totalDepositedSol=14`, `equitySol=14.077`,
  `maxPositions=7`, `openCount=1`, `trades=5`.

`.env` and `STOP` (from `ls -l`):

```
-rw------- 1 sunteak sunteak 1342 Nov 23 22:06 /home/sunteak/apps/warlock-v2/.env
-rw-r--r-- 1 sunteak sunteak   40 Nov 22 17:56 /home/sunteak/apps/warlock-v2/STOP
```

- `.env` mode `600`, mtime **23 Nov 22:06** — **before** the service start
  (22:06:15). The running process started from exactly this `.env` file;
  nothing has edited it since the process started. This is the
  `.env`-mtime / PID chain the procedure (§4 step 5) accepts as substitute
  evidence for a running instance.
- `STOP` present.

---

## 2. Step 2 — `.env` pin read (named keys only)

Command: `grep -E "^(PAPER|DRY_RUN|LIVE_CONFIRMED|…|LP_SECRETS_DIR)=" ~/apps/warlock-v2/.env`
(full pattern in `PROCEDURE.md` §4 step 2). Output verbatim:

```
PAPER=1
DRY_RUN=1
LIVE_CONFIRMED=0
LP_SECRETS_DIR=/home/sunteak/apps/warlock-v2/secrets
MIN_FT=0.6
MIN_AGE_H=0.5
MIN_BIN_STEP=80
MAX_BIN_STEP=400
MAX_PUMP1H=0.15
MAX_PUMP24H_PCT=200
TP_USD_PCT=13
EMERGENCY_DROP=0.20
MAX_POSITIONS=7
PAPER_USDC=0
POSITION_USDC=500
GAS_BUFFER_SOL=0.30
MAX_POSITION_TVL_PCT=5
MIN_LIQ_USD=10000
MAX_HOURS=12
EMERGENCY_SLPLUS_ARM_PCT=3
EMERGENCY_SLPLUS_LOCK_PCT=0.1
MIN_VOL24H_TVL_X=0
RESHAPE_MAX=5
CAPITAL_ASSET=SOL
POSITION_SOL_OPEN=2.0
```

Every key of the §2B E-config table is present with its table value. No pin
key is absent. (Keys that are defaults-in-force rather than pins —
`EMERGENCY_TP_PCT`, `EMERGENCY_TP_TRIGGER_RANGE_PCT`,
`EMERGENCY_SLPLUS_CONFIRM_POLLS`, `EMERGENCY_SLPLUS_FLOOR_PCT`, `RESHAPE_N`,
`MAX_PUMP_24H`, `VOL_SPIKE_1H_OF_24H` — correctly return no `.env` line;
they are verified through the log line in §3 below.)

## 3. Step 3 — Mode / key invariants

```
grep -c "^PRIVATE_KEY=" ~/apps/warlock-v2/.env
0
```

`PRIVATE_KEY` count **0** (line deleted entirely, per C2). `STOP` present
(§1). Both invariants hold.

---

## 4. Step 4 — Startup-log lines for the current start

Command: `grep -n "paper settings applied" ~/apps/warlock-v2/paper/bot.log`
(7 matches total in the log; the last three shown). The current process
started 23 Nov 22:06:15 CET = 24 Nov 04:06:16 WIB; its lines are **3039**
(settings) and **3042** (start).

**Settings line — line 3039, verbatim:**

```
3039:[2026-11-24 04:06:16 WIB] [PAPER] paper settings applied: MIN_FT=0.6% MIN_LIQ_USD=10000 MIN_AGE_H=0.5 BIN_STEP=80..400 POSITION_USDC=500 UPPER_BUFFER_BINS=0 rightConfirm=2 RESHAPE_N=5 TP_USDC=13% rightOor=true trailing=false emergencyTp=true(priceDrop>=50% of open lower range -> TP 10%) leftOorMin=0 emergency=0.2 maxHours=12 GAS_BUFFER_SOL=0.3 pump1h=0.15 pump24h=5 volSpike=0.5 tokenFilters=ON(pump1h=true pump24h=true rugcheck=true topHolders=true insiders=true<=25% antiPvp=KEEP_BIGGEST>=$10000)
```

**Start line — line 3042, verbatim:**

```
3042:[2026-11-24 04:06:16 WIB] [PAPER] start PAPER: real wallet (belum ada key wallet) on-chain=n/a SOL (unused). strategy=N5 (reshape every 5 bins, compound on reshape; single book, live-like). capital=0 USDC only, GAS_BUFFER_SOL=0.3 (extra SOL bought at each open for rent/tx, leftovers swapped back at close; no separate gas wallet), usdcBuffer=0.1, minLiq=$10000, minAge=0.5h, minFt=0.6%/30m, pump24h<=200%, emergencyNetUsdcDrop=20%, rugcheck=true, tvlCap=5%, TP_USDC=13%, rightOorClose=true, trailing=false, maxHold=12h, window 2026-11-24 03:52:34 WIB -> 2026-12-01 03:52:34 WIB. Private key not loaded. Live STOP file left in place; paper stop is paper/STOP or pm2 stop lp-paper.
```

Both lines share the timestamp **04:06:16 WIB**, matching the current
process start. The two older E-lines in the log (2978 at 03:49:29 WIB, 3006
at 03:53:56 WIB — the superseded 5 SOL / 2-position and 8 SOL / 7-position
segments, both zero-trade) carry identical E screening/exit tokens, as
expected; only 3039/3042 belong to the running process. The two README lines
(1 at 23 Nov 02:28:26 WIB; 2442 at 23 Nov 22:30:32 WIB) carry the README
tokens (`MIN_FT=1%`, `MIN_AGE_H=24`, `TP_USDC=20%`, `emergency=0.3`,
`pump24h<=50%`) and belong to earlier starts.

### Field-for-field comparison (§2B pin vs §4 log lines)

| Pin key | `.env` (S1) | Log token (S2/S3) | Expected | Verdict |
|---|---|---|---|---|
| `MIN_FT` | `0.6` | `MIN_FT=0.6%` / `minFt=0.6%/30m` | `0.6` | **MATCH** |
| `MIN_LIQ_USD` | `10000` | `MIN_LIQ_USD=10000` / `minLiq=$10000` | `10000` | **MATCH** |
| `MIN_AGE_H` | `0.5` | `MIN_AGE_H=0.5` / `minAge=0.5h` | `0.5` | **MATCH** |
| `MIN_BIN_STEP` / `MAX_BIN_STEP` | `80` / `400` | `BIN_STEP=80..400` | `80..400` | **MATCH** |
| `MAX_PUMP1H` | `0.15` | `pump1h=0.15` | `0.15` | **MATCH** |
| `MAX_PUMP24H_PCT` | `200` | `pump24h<=200%` (start line) | `200` | **MATCH** |
| `TP_USD_PCT` | `13` | `TP_USDC=13%` (both lines) | `13` | **MATCH** |
| `EMERGENCY_DROP` | `0.20` | `emergency=0.2` / `emergencyNetUsdcDrop=20%` | `0.2` | **MATCH** (numeric normalisation) |
| `MAX_POSITIONS` | `7` | not in either line — see §5 | `7` | **MATCH** (via §5) |
| `PAPER_USDC` | `0` | `capital=0 USDC only` | `0` | **MATCH** |
| `POSITION_USDC` | `500` | `POSITION_USDC=500` | `500` | **MATCH** (cosmetic in SOL mode — §6) |
| `GAS_BUFFER_SOL` | `0.30` | `GAS_BUFFER_SOL=0.3` | `0.3` | **MATCH** (numeric normalisation) |
| `MAX_POSITION_TVL_PCT` | `5` | `tvlCap=5%` (start line) | `5` | **MATCH** |
| `MAX_HOURS` | `12` | `maxHours=12` / `maxHold=12h` | `12` | **MATCH** |
| `EMERGENCY_SLPLUS_ARM_PCT` | `3` | not in either line — E1, see §5 | `3` | **MATCH** (via §5) |
| `EMERGENCY_SLPLUS_LOCK_PCT` | `0.1` | not in either line — E1, see §5 | `0.1` | **MATCH** (via §5) |
| `MIN_VOL24H_TVL_X` | `0` | not in either line — E1, see §5 | `0` | **MATCH** (via §5) |
| `RESHAPE_MAX` | `5` | not in either line — E1, see §5 | `5` | **MATCH** (via §5) |
| `CAPITAL_ASSET` | `SOL` | not in either line — see §5 | `SOL` | **MATCH** (via §5) |
| `POSITION_SOL_OPEN` | `2.0` | not in either line — see §5 | `2.0` | **MATCH** (via §5) |
| `EMERGENCY_TP_PCT` / trigger (defaults) | — (not pinned) | `emergencyTp=true(…TP 10%)`, trigger `50%` | `10` / `50` | **MATCH** |
| `RESHAPE_N` (default) | — (not pinned) | `RESHAPE_N=5` | `5` | **MATCH** |
| `MAX_PUMP_24H` (default) | — (not pinned) | `pump24h=5` | `5` | **MATCH** — and confirms trap §6.1: constant, not the pump cap |
| `VOL_SPIKE_1H_OF_24H` (default) | — (not pinned) | `volSpike=0.5` | `0.5` | **MATCH** |
| Token filters | ON | `tokenFilters=ON(…)` as printed | as printed | **MATCH** |
| `Private key not loaded` | — | present in start line | present | **MATCH** |

---

## 5. Step 5 — Supplementary read-back (E1 fields + non-logged keys)

No code was executed against the running instance (read-only rule). Evidence
is the §2 `.env` grep plus the §1 `.env`-mtime / PID chain, corroborated from
the instance's own state files (read-only JSON reads):

- `paper/config.json` (live effective config snapshot): `positionSol: 2`,
  `maxPump24h: 2` (= 200%), `maxPositions: 7`, `emergencyDrop: 0.2`,
  `minFt: 0.6`, `minAgeH: 0.5`, `maxPump1h: 0.15`, `maxPosTvlFrac: 0.05`
  (= 5%), `gasBufferSol: 0.3`, `minLiqUsd: 10000`, `usdcStart: 0` — all agree
  with the §2B pin. (`"capital": {"mode": "usdc500", …}` in the same file is
  stale USDC-era metadata — see §6.)
- `paper/summary.json` stats: `capitalAsset: SOL`, `totalDepositedSol: 14`,
  `maxPositions: 7` — agree with `CAPITAL_ASSET=SOL`, `MAX_POSITIONS=7`.
- `paper/positions_open.json`: `maxPositions: 7`, `openCount: 1` — agrees.
- The E1 fields (`RESHAPE_MAX=5`, `EMERGENCY_SLPLUS_ARM_PCT=3`,
  `EMERGENCY_SLPLUS_LOCK_PCT=0.1`, `MIN_VOL24H_TVL_X=0`) are present in
  `.env` (§2), and the running process started from this `.env` (§1 chain:
  `.env` mtime 22:06 < service start 22:06:15, PID 1223431 unchanged since).
  The same values were verified through `paper-settings.currentValues()` at
  deploy (E-config deploy report §4, condition E1 satisfied) and again in
  the disposable-copy positive control (`NEGATIVE-TEST.md` §2: 21/21 fields
  PASS against the §2B table, including all four E1 fields).

---

## 6. Traps confirmed live (procedure §3.3, observed — not just theorised)

1. **`pump24h=5` is constant across pins.** The README settings line
   (23 Nov 02:28:26 WIB, `MAX_PUMP24H_PCT=50`) and the E settings line
   (24 Nov 04:06:16 WIB, `MAX_PUMP24H_PCT=200`) both print `pump24h=5`.
   The cap is only visible in the start line (`pump24h<=50%` vs
   `pump24h<=200%`). A settings-line-only check would miss a wrong pump cap.
2. **Cosmetic USDC strings in SOL mode.** The E start line prints
   `capital=0 USDC only` and the settings line `POSITION_USDC=500`, while
   the book is SOL (`capitalAsset=SOL`, `equitySol=14.077`). `capital=0`
   correctly reflects `PAPER_USDC=0`; `POSITION_USDC=500` is not the
   operative sizing key (`POSITION_SOL_OPEN=2.0` is). `paper/config.json`
   still says `"capital": {"mode": "usdc500"}` — stale metadata, ignored per
   the procedure.

---

## 7. Verdict

**MATCH — all fields.** The `.env` pin (§2) and the current process's
startup-log settings line + start line (§4) agree field-for-field on every
§2B E-config value, including the four E1 fields via the §5 supplementary
evidence and the non-logged keys via `config.json` / `summary.json`.
Mode/key invariants hold (`PAPER=1`, `DRY_RUN=1`, `LIVE_CONFIRMED=0`;
`PRIVATE_KEY` count 0; `STOP` present; `Private key not loaded`).

**No mismatch was found, so no finding is recorded.** (Per the plan §8.3, a
mismatch would have been recorded as a finding with owner and due date — a
mismatch found is a result, not a failure of the procedure. None occurred.)

**Scope note:** this demonstration verifies the **E-config pin on the paper
instance**. It does not verify the README pin (§2A) on a live build — no
live build exists yet. The README expected lines in `PROCEDURE.md` §3.1/§3.2
are transcribed from the 22 Nov first-start log lines (lines 1 and 5 of the
same `paper/bot.log`), which the demo re-read verbatim; the live-build
verification itself is a future run of this same procedure.

*End of demo evidence.*
