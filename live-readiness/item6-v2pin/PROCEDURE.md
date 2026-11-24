# Item 6 — v2 Settings-Pin Verification Procedure (C1)

**Track:** Warlock live system-readiness, Item 6 (v2 settings-pin verification, caveat C1)
**Plan ref:** `SYSTEM-READINESS-PLAN-2026-11-24.md` §8
**Status:** BUILD — written procedure + read-only demonstration + negative test.
No QC / Security verdict is claimed here; those come from the independent reviewer.
**Author:** Engineering Builder (Item 6) · **Date:** 2026-11-24
**Files in this folder:** `PROCEDURE.md` (this file), `DEMO-EVIDENCE.md`, `NEGATIVE-TEST.md`

**Revision note — independent-review fixes applied 2026-11-24 (builder):**
N1 §3.1 "six" → "five" tokens; N2 §4 step-2 output "21-key" → "25-key" pin
(21-field harness count stated separately); N3 Appendix A gains section D
pin-presence check + post-fix re-runs (see `NEGATIVE-TEST.md` §5);
N4 Appendix A §B/D line-scoped `.env` read + disposable-copy disposal rule,
and the retained `/tmp/item6-negtest/.env` + `.env.pristine` were deleted by
the coordinator (verified gone, see `NEGATIVE-TEST.md` §5); N5
`MIN_VOL24H_TVL_X` code default 2.5 recorded in §2A and §6.2; N6 §2B source
line notes the `GAS_BUFFER_SOL` / `MAX_POSITION_TVL_PCT` carry-over; N7 §4
step 5 points at the ssh/scp method. N8: no change (cosmetic drift only).
`REVIEW.md` was not edited. Close-out re-review still to follow; this file
does not declare DONE.

---

## 0. Why this procedure exists (C1, material)

A fresh v2 install does **not** run the README strategy. `applyPaperSettings()`
overwrites the config from `paper-settings.js` DEFAULTS every tick, and those
defaults are v1-era values (MIN_FT 0.6, age 0.5 h, TP 13%, stop −20% net,
MAX_POSITIONS 10). `currentValues()` reads the `.env` **file** (not the process
environment), so the README values must be pinned through `.env` — and the pin
must be verified in the startup log before any result counts, live or paper.
(v2 review `warlock-v2-review-2026-11-22.md` §1.4 / §1.6 C1, Part 3 §3.2(4).)

**The rule:** for any v2 live build, the `.env` pin is compared field-for-field
against the startup log's settings line before the build is accepted.
**A mismatch = the build does not proceed.** No exception, no "fix it live and
re-check later" — the service is not started (or is stopped) until the pin and
the log agree on every field in §2.

---

## 1. What is compared, and where it is read from

There are **three** evidence sources, and no single one covers every field.
The procedure checks all three; §4 gives the exact commands.

| # | Source | Path (live build) | What it proves |
|---|---|---|---|
| S1 | `.env` pin | `<instance>/.env` | The pin values as written. Read with `grep ^KEY=` per key — **never** `cat` the whole file (it sits beside secrets; the procedure reads only named keys). |
| S2 | Startup log, settings line | `<instance>/paper/bot.log`, line `paper settings applied:` | The effective settings the bot actually applied at start. Format fixed in code at `bot.js:1135`. |
| S3 | Startup log, start line | `<instance>/paper/bot.log`, line `start PAPER:` | Second log line from the same start; carries three fields the settings line does not print (`pump24h<=…%`, `emergencyNetUsdcDrop=…%`, `tvlCap=…%`) and the `Private key not loaded` attestation. |
| S4 | Supplementary read-back (E1 fields only) | `paper-settings.currentValues()` run in a disposable copy of the build, **or** on the build machine before install — never by executing code against a running instance | The four fields **neither** log line prints (see §3.3). On a running instance the substitute evidence is the `.env` grep + the `.env`-mtime / service-start chain (§4, step 5). |

**Which startup?** The log holds one settings line per start (7 in the paper
instance's log at demo time). Always use the **last** `paper settings applied:`
line **and** the `start PAPER:` line with the **same timestamp** as the current
process start (`systemctl --user status <service>` → `Active: active (running)
since …`). An older line proves an older start, not the running one.

**Numeric normalisation.** Compare numerically, not as strings: `.env` writes
`EMERGENCY_DROP=0.20`, `POSITION_SOL_OPEN=2.0`, `GAS_BUFFER_SOL=0.30`; the log
and `currentValues()` print `0.2`, `2`, `0.3`. `0.20 == 0.2` is a PASS.
A difference in the *number* (e.g. `1` vs `0.6`) is a FAIL.

**Pin-presence check (mandatory, not optional).** Every pin key in §2 must exist
as its own `^KEY=value` line in `.env`. Effective-value agreement alone is NOT
enough: for the E-config, six pin values (MIN_FT 0.6, MIN_AGE_H 0.5,
MIN_BIN_STEP 80, MAX_PUMP24H_PCT 200, TP_USD_PCT 13, EMERGENCY_DROP 0.2) are
numerically identical to the code defaults, so a missing pin would still print
the "right" effective value while the C1 trap stood open. A key absent from
`.env` is a FAIL even if the effective value matches.

---

## 2. Pin tables — the exact values

### 2A. README-strategy pin (the live-build base)

Source: v2 review Part 3 §3.2(4). This is the pin for **any v2 live build**
until an adopted arm substitutes its own values (§2C). First-start gate
evidence: 22 Nov 2026 20:28 CET first start, settings line verified verbatim
(see §3.1).

| Key | Pinned value | In `.env`? | Notes |
|---|---|---|---|
| `PAPER` | `1` | yes | Mode block (§2D) |
| `DRY_RUN` | `1` | yes | Mode block (§2D) |
| `LIVE_CONFIRMED` | `0` | yes | Mode block (§2D) |
| `MIN_FT` | `1` | yes | README 1.0% (defaults: 0.6) |
| `MIN_AGE_H` | `24` | yes | README 24 h (defaults: 0.5) |
| `MIN_BIN_STEP` | `100` | yes | (defaults: 80) |
| `MAX_BIN_STEP` | `400` | yes | (same as defaults) |
| `MAX_PUMP1H` | `0.15` | yes | Review note: if the settings layer forced 0.135, record as deliberate deviation. First start printed `pump1h=0.15` — no forcing occurred. |
| `MAX_PUMP24H_PCT` | `50` | yes | (defaults: 200). Verified via the **start** line (`pump24h<=50%`), NOT the settings line (§3.3 trap). |
| `TP_USD_PCT` | `20` | yes | (defaults: 13) |
| `EMERGENCY_DROP` | `0.30` | yes | −30% net PnL (defaults: 0.20). Review Part 2 §(c): contradicted by our data — the pin is the author's strategy, not our recommendation. |
| `MAX_POSITIONS` | `1` | yes | (defaults: 10). **Not** in either log line — verify via S4 + `paper/summary.json` `maxPositions` (§4 step 6). |
| `PAPER_USDC` | `500` | yes | Capital key — see §3.3: not in `currentValues()` (forbidden key), verify by `.env` grep + start line `capital=500 USDC only`. |
| `POSITION_USDC` | `500` | yes | |
| `GAS_BUFFER_SOL` | `0.30` | yes | |
| `MAX_POSITION_TVL_PCT` | `5` | yes | Verified via the **start** line (`tvlCap=5%`), not the settings line. |
| `MIN_LIQ_USD` | `10000` | yes | |
| `MAX_HOURS` | `12` | yes | |
| `LP_SECRETS_DIR` | `<instance>/secrets` | yes | Pinned per instance; value is path-dependent, not a strategy value. |

README-build defaults-in-force (NOT `.env`-pinned at first start; recorded here
so a future code-default change is caught by the log-line comparison):

| Key | Value in force at first start | Source |
|---|---|---|
| `CAPITAL_ASSET` | `USDC` (code default) | USDC book; `POSITION_SOL_OPEN` `0` = use `POSITION_USDC` ÷ SOL price |
| `POSITION_SOL_OPEN` | `0` (code default) | Not a USDC-book key |
| `RESHAPE_MAX` | `null` = unlimited (author behaviour) | Predates the E patch (23 Nov); the E-config patch added the key |
| `EMERGENCY_SLPLUS_ARM_PCT` / `EMERGENCY_SLPLUS_LOCK_PCT` | `7` / `5` (v2 code fallbacks) | E-config deploy report §1 |
| `EMERGENCY_TP_PCT` / `EMERGENCY_TP_TRIGGER_RANGE_PCT` | `10` / `50` | In settings line as `emergencyTp=true(…TP 10%)` |
| `EMERGENCY_SLPLUS_CONFIRM_POLLS` / `EMERGENCY_SLPLUS_FLOOR_PCT` | `3` / `0` | v2 defaults |
| `RESHAPE_N` | `5` | In settings line |
| `MAX_PUMP_24H` / `VOL_SPIKE_1H_OF_24H` | `5` / `0.5` | In settings line as `pump24h=5 volSpike=0.5` — **not** the pump caps (§3.3) |
| `MIN_VOL24H_TVL_X` | **2.5** (code default, in force at first start) | `paper-settings.js` DEFAULTS line 66: `MIN_VOL24H_TVL_X: 2.5`. Proven pristine, not E-patch-touched: `git diff` vs the reviewed commit `6c3ae78` touches only the two `RESHAPE_MAX` lines in `paper-settings.js` (independent review, 24 Nov 2026). **Consequence: the README first-start build ran with the 2.5× vol/TVL gate ON (filtering thin tokens), not off and not 0.** The live-build freeze no longer needs to record this default — it is recorded here. |

### 2B. E-config pin (the current v2 paper instance — NOT the live-build pin)

Source: `warlock-v2-e-config-deploy-2026-11-23.md` (§1 mapping, §4 + Addenda 1–2
verification); re-verified live 24 Nov ~09:51 CET (memory) and again by this
item's demo, 24 Nov ~17:39 CET (`DEMO-EVIDENCE.md`). Two values are carried
over unchanged from the README pin and do **not** appear in the deploy
report's §1 mapping table: `GAS_BUFFER_SOL=0.30` and
`MAX_POSITION_TVL_PCT=5` — both verified live (`.env` + log lines). The paper instance runs
**Book E on the v2 codebase, SOL-denominated, 14 SOL / 7 positions / 2.0 SOL
per open** — the author's README strategy was superseded for this instance by
sole's order of 23 Nov 21:38 CET (Book E) + 21:49 CET (SOL restart) + 22:01 CET
(8 SOL / 7 positions) + 22:04 CET (creator sizing 2 SOL × 7, 14 SOL book).
**Do not mistake this table for the live-build pin.** It is the pin the
demonstration checks, and the worked example of the method.

| Key | Pinned value | In `.env`? |
|---|---|---|
| `PAPER` / `DRY_RUN` / `LIVE_CONFIRMED` | `1` / `1` / `0` | yes |
| `MIN_FT` | `0.6` | yes |
| `MIN_AGE_H` | `0.5` | yes |
| `MIN_BIN_STEP` / `MAX_BIN_STEP` | `80` / `400` | yes |
| `MAX_PUMP1H` | `0.15` | yes |
| `MAX_PUMP24H_PCT` | `200` | yes |
| `TP_USD_PCT` | `13` | yes |
| `EMERGENCY_DROP` | `0.20` | yes |
| `MAX_POSITIONS` | `7` | yes |
| `PAPER_USDC` | `0` | yes |
| `POSITION_USDC` | `500` | yes (printed in log; cosmetic in SOL mode — §3.3) |
| `GAS_BUFFER_SOL` | `0.30` | yes |
| `MAX_POSITION_TVL_PCT` | `5` | yes |
| `MIN_LIQ_USD` | `10000` | yes |
| `MAX_HOURS` | `12` | yes |
| `EMERGENCY_SLPLUS_ARM_PCT` / `EMERGENCY_SLPLUS_LOCK_PCT` | `3` / `0.1` | yes — **E1 field** (§3.3) |
| `MIN_VOL24H_TVL_X` | `0` (gate off) | yes — **E1 field** (§3.3) |
| `RESHAPE_MAX` | `5` | yes — **E1 field** (§3.3); code patch, 23 Nov |
| `CAPITAL_ASSET` | `SOL` | yes |
| `POSITION_SOL_OPEN` | `2.0` | yes |
| `LP_SECRETS_DIR` | `/home/sunteak/apps/warlock-v2/secrets` | yes |

E-config defaults-in-force (not `.env`-pinned): `EMERGENCY_TP_PCT 10` /
`EMERGENCY_TP_TRIGGER_RANGE_PCT 50`, `EMERGENCY_SLPLUS_CONFIRM_POLLS 3` /
`EMERGENCY_SLPLUS_FLOOR_PCT 0`, `RESHAPE_N 5`, `MAX_PUMP_24H 5`,
`VOL_SPIKE_1H_OF_24H 0.5`.

### 2C. Adopted-arm substitution (at go-live only)

When an arm is adopted, its values **replace the §2A table field-for-field as
a whole** — never cherry-picked field by field. The substitute table must be
written out in full (same columns as §2A/§2B, including which keys are
defaults-in-force and the `MIN_VOL24H_TVL_X` default), and the §4 procedure
is then run against the substitute table. If no arm is adopted, §2A stands.
No arm has been adopted as of 24 Nov 2026.

### 2D. Mode / key invariants (checked with every pin verification)

- `PAPER=1`, `DRY_RUN=1`, `LIVE_CONFIRMED=0` in `.env` (paper build; for the
  live build the go-live runbook states the live values — this procedure
  verifies the *strategy* pin, and the mode block is recorded alongside it,
  never assumed).
- `grep -c "^PRIVATE_KEY=" .env` must print `0` — the line is deleted
  entirely, not left empty (v2 review C2).
- `STOP` present in the instance directory before first start.
- Startup log states `Private key not loaded` (in the `start PAPER:` line).

---

## 3. The exact log lines to check

Log file: `<instance>/paper/bot.log`. Both lines come from the **same start**
(same timestamp). Timestamps are WIB in the log; convert when comparing to
CET service times (WIB = CET + 6 h).

### 3.1 Expected settings line — `paper settings applied:` (`bot.js:1135`)

**README pin (first start, 23 Nov 2026 02:28:26 WIB):**

```
[2026-11-23 02:28:26 WIB] [PAPER] paper settings applied: MIN_FT=1% MIN_LIQ_USD=10000 MIN_AGE_H=24 BIN_STEP=100..400 POSITION_USDC=500 UPPER_BUFFER_BINS=0 rightConfirm=2 RESHAPE_N=5 TP_USDC=20% rightOor=true trailing=false emergencyTp=true(priceDrop>=50% of open lower range -> TP 10%) leftOorMin=0 emergency=0.3 maxHours=12 GAS_BUFFER_SOL=0.3 pump1h=0.15 pump24h=5 volSpike=0.5 tokenFilters=ON(pump1h=true pump24h=true rugcheck=true topHolders=true insiders=true<=25% antiPvp=KEEP_BIGGEST>=$10000)
```

**E-config pin (current paper process start, 24 Nov 2026 04:06:16 WIB = 23 Nov 22:06:16 CET):**

```
[2026-11-24 04:06:16 WIB] [PAPER] paper settings applied: MIN_FT=0.6% MIN_LIQ_USD=10000 MIN_AGE_H=0.5 BIN_STEP=80..400 POSITION_USDC=500 UPPER_BUFFER_BINS=0 rightConfirm=2 RESHAPE_N=5 TP_USDC=13% rightOor=true trailing=false emergencyTp=true(priceDrop>=50% of open lower range -> TP 10%) leftOorMin=0 emergency=0.2 maxHours=12 GAS_BUFFER_SOL=0.3 pump1h=0.15 pump24h=5 volSpike=0.5 tokenFilters=ON(pump1h=true pump24h=true rugcheck=true topHolders=true insiders=true<=25% antiPvp=KEEP_BIGGEST>=$10000)
```

The two lines differ in exactly five tokens (`MIN_FT`, `MIN_AGE_H`, `BIN_STEP`,
`TP_USDC`, `emergency`) — everything else is identical. That is expected: the
log line prints only the fields in the `bot.js:1135` template.

**Field → pin-key map for the settings line:**

| Log token | Pin key | README | E-config |
|---|---|---|---|
| `MIN_FT=` | `MIN_FT` | `1%` | `0.6%` |
| `MIN_LIQ_USD=` | `MIN_LIQ_USD` | `10000` | `10000` |
| `MIN_AGE_H=` | `MIN_AGE_H` | `24` | `0.5` |
| `BIN_STEP=a..b` | `MIN_BIN_STEP` / `MAX_BIN_STEP` | `100..400` | `80..400` |
| `POSITION_USDC=` | `POSITION_USDC` | `500` | `500` |
| `RESHAPE_N=` | `RESHAPE_N` (default-in-force) | `5` | `5` |
| `TP_USDC=` | `TP_USD_PCT` | `20%` | `13%` |
| `emergencyTp=true(…TP 10%)` | `EMERGENCY_TP_PCT` / `…_TRIGGER_RANGE_PCT` (defaults) | `10%` / `50%` | `10%` / `50%` |
| `emergency=` | `EMERGENCY_DROP` | `0.3` | `0.2` |
| `maxHours=` | `MAX_HOURS` | `12` | `12` |
| `GAS_BUFFER_SOL=` | `GAS_BUFFER_SOL` | `0.3` | `0.3` |
| `pump1h=` | `MAX_PUMP1H` | `0.15` | `0.15` |
| `pump24h=` | `MAX_PUMP_24H` — **NOT a pin key** (§3.3) | `5` | `5` |
| `volSpike=` | `VOL_SPIKE_1H_OF_24H` (default) | `0.5` | `0.5` |
| `tokenFilters=ON(…)` | filter stack on, values as printed | as printed | as printed |

### 3.2 Expected start line — `start PAPER:`

**README pin (23 Nov 2026 02:28:26 WIB):**

```
[2026-11-23 02:28:26 WIB] [PAPER] start PAPER: real wallet (belum ada key wallet) on-chain=n/a SOL (unused). strategy=N5 (reshape every 5 bins, compound on reshape; single book, live-like). capital=500 USDC only, GAS_BUFFER_SOL=0.3 (extra SOL bought at each open for rent/tx, leftovers swapped back at close; no separate gas wallet), usdcBuffer=0.1, minLiq=$10000, minAge=24h, minFt=1%/30m, pump24h<=50%, emergencyNetUsdcDrop=30%, rugcheck=true, tvlCap=5%, TP_USDC=20%, rightOorClose=true, trailing=false, maxHold=12h, window 2026-11-23 02:28:26 WIB -> 2026-11-30 02:28:26 WIB. Private key not loaded. Live STOP file left in place; paper stop is paper/STOP or pm2 stop lp-paper.
```

**E-config pin (24 Nov 2026 04:06:16 WIB):**

```
[2026-11-24 04:06:16 WIB] [PAPER] start PAPER: real wallet (belum ada key wallet) on-chain=n/a SOL (unused). strategy=N5 (reshape every 5 bins, compound on reshape; single book, live-like). capital=0 USDC only, GAS_BUFFER_SOL=0.3 (extra SOL bought at each open for rent/tx, leftovers swapped back at close; no separate gas wallet), usdcBuffer=0.1, minLiq=$10000, minAge=0.5h, minFt=0.6%/30m, pump24h<=200%, emergencyNetUsdcDrop=20%, rugcheck=true, tvlCap=5%, TP_USDC=13%, rightOorClose=true, trailing=false, maxHold=12h, window 2026-11-24 03:52:34 WIB -> 2026-12-01 03:52:34 WIB. Private key not loaded. Live STOP file left in place; paper stop is paper/STOP or pm2 stop lp-paper.
```

**Field → pin-key map for the start line:**

| Log token | Pin key | README | E-config |
|---|---|---|---|
| `capital=… USDC only` | `PAPER_USDC` | `500` | `0` (see cosmetic note §3.3) |
| `minAge=` | `MIN_AGE_H` | `24h` | `0.5h` |
| `minFt=` | `MIN_FT` | `1%/30m` | `0.6%/30m` |
| `pump24h<=…%` | `MAX_PUMP24H_PCT` | `50%` | `200%` |
| `emergencyNetUsdcDrop=` | `EMERGENCY_DROP` | `30%` | `20%` |
| `tvlCap=` | `MAX_POSITION_TVL_PCT` | `5%` | `5%` |
| `TP_USDC=` | `TP_USD_PCT` | `20%` | `13%` |
| `maxHold=` | `MAX_HOURS` | `12h` | `12h` |
| `Private key not loaded` | C2 invariant | present | present |

(The `window … -> …` dates differ per window and are checked for sanity — start
of record and 7-day span — not against the pin table.)

### 3.3 Known traps — read this before comparing

1. **`pump24h=5` in the settings line is NOT `MAX_PUMP24H_PCT`.** Code
   (`bot.js:1135`) prints `pump24h=${values.MAX_PUMP_24H}` — a different key
   (code default 5, constant across both pins). The pump cap lives only in
   the start line as `pump24h<=50%` / `pump24h<=200%`. Anyone checking the
   settings line alone would conclude the pump cap is "5" for both pins and
   miss a wrong `MAX_PUMP24H_PCT` entirely. **Check the start line for this
   field, every time.**
2. **E1 fields — four pin values appear in NEITHER log line:**
   `RESHAPE_MAX`, `EMERGENCY_SLPLUS_ARM_PCT`, `EMERGENCY_SLPLUS_LOCK_PCT`,
   `MIN_VOL24H_TVL_X`. They are verified by the S4 supplementary read-back
   (`paper-settings.currentValues()` — the function the 23 Nov E-config
   deploy used for its E1 read-back) plus the `.env` grep. A procedure that
   only reads the log would silently pass a build with, e.g., SL+ arm 7/lock
   5 (the code fallbacks) instead of 3/0.1. This is the same gap the E-config
   deploy closed with condition E1, and it is carried forward here, not
   re-invented.
3. **`PAPER_USDC` is not a settings-layer key.** `paper-settings.js` lists
   `PAPER_USDC` among `FORBIDDEN_KEYS` (capital/funding keys, line ~179), so
   `currentValues()` never returns it. Verify it by direct `.env` grep and
   by the start line's `capital=…` token only.
4. **Cosmetic strings in SOL mode — do not let them fail or pass the check:**
   - The start line still prints `capital=0 USDC only` and the settings line
     still prints `POSITION_USDC=500` on the SOL-denominated E book. Both are
     stale USDC-era strings; the authoritative accounting is SOL
     (`paper/summary.json`: `capitalAsset=SOL`, `equitySol`, `equityPnlSol`).
     `capital=0` correctly reflects `PAPER_USDC=0`; `POSITION_USDC=500` is
     simply not the operative sizing key in SOL mode (`POSITION_SOL_OPEN`
     is — verified via S4, and `paper/config.json` `positionSol: 2`).
   - `paper/config.json` still carries `"capital": {"mode": "usdc500", …}` from
     the USDC era. It is stale metadata, not a setting; ignore it in the pin
     comparison (its live fields — `positionSol`, `maxPump24h`, `maxPositions`,
     `emergencyDrop`, `minFt`, `minAgeH`, `maxPump1h`, `maxPosTvlFrac`,
     `gasBufferSol`, `minLiqUsd` — agree with the pin and may be used as
     corroboration, never as the primary check).
5. **`MAX_POSITIONS`, `CAPITAL_ASSET`, `POSITION_SOL_OPEN` are not in either
   log line.** Verify via S4 (`currentValues()`) and corroborate from
   `paper/summary.json` (`maxPositions`, `capitalAsset`) and
   `paper/config.json` (`maxPositions`, `positionSol`).

---

## 4. Procedure — step by step

Run against the **build directory before first start** for a live build (or
against the running paper instance for a demonstration, read-only). All
commands are read-only except step 2's `.env` read; nothing in this procedure
writes to the instance, restarts a service, or touches a key.

**Applies to:** any v2 live build. **When:** after `.env` is written and
before the build is accepted / the service is first started (and re-run after
any `.env` edit, any restart, and any upstream update).

```bash
# 0. Identify the build and the pin table in force.
#    INSTANCE=~/apps/warlock-v2-live   (live build; paper demo: ~/apps/warlock-v2)
#    PINTABLE=README (§2A) — or the adopted arm's table (§2C) if one exists.
#    Record the table's source and date in the verification record.

# 1. Service / process identity (which start the log lines must belong to).
systemctl --user status <service> --no-pager
#    Expected: Active: active (running) since <START>; Main PID <PID>.
#    Record <START> (CET) and <PID>. For a pre-start check, record "not yet started".

# 2. Read the .env pin — named keys only, never `cat .env`.
grep -E "^(PAPER|DRY_RUN|LIVE_CONFIRMED|MIN_FT|MIN_LIQ_USD|MIN_AGE_H|MIN_BIN_STEP|MAX_BIN_STEP|MAX_PUMP1H|MAX_PUMP24H_PCT|TP_USD_PCT|EMERGENCY_DROP|EMERGENCY_TP_PCT|EMERGENCY_TP_TRIGGER_RANGE_PCT|EMERGENCY_SLPLUS_ARM_PCT|EMERGENCY_SLPLUS_LOCK_PCT|EMERGENCY_SLPLUS_CONFIRM_POLLS|EMERGENCY_SLPLUS_FLOOR_PCT|MAX_HOURS|RESHAPE_MAX|RESHAPE_N|MIN_VOL24H_TVL_X|CAPITAL_ASSET|PAPER_USDC|POSITION_SOL_OPEN|POSITION_USDC|MAX_POSITIONS|GAS_BUFFER_SOL|MAX_POSITION_TVL_PCT|LP_SECRETS_DIR)=" <instance>/.env
#    Expected: every key of the §2 table present with its table value
#    (numeric normalisation per §1: 0.20 == 0.2, 2.0 == 2).
#    FAIL if any pin key is absent — even if the effective value matches (§1).

# 3. Mode / key invariants.
grep -c "^PRIVATE_KEY=" <instance>/.env
#    Expected: 0
ls <instance>/STOP
#    Expected: present

# 4. Startup-log lines for the current start (last occurrence, same timestamp).
grep -n "paper settings applied" <instance>/paper/bot.log | tail -n 1
grep -n "start PAPER" <instance>/paper/bot.log | tail -n 1
#    Expected: both lines share one timestamp, and that timestamp is the
#    current process start from step 1 (WIB = CET + 6 h).
#    Then compare each token against §3.1 / §3.2 field-for-field.
#    FAIL on any token mismatch. In particular check the start line's
#    pump24h<=…% — the settings line's pump24h=5 proves nothing (§3.3.1).

# 5. Supplementary read-back (E1 fields + non-logged keys).
#    Reach the instance read-only: the ssh command is in DEMO-EVIDENCE.md §0
#    and the read-only scp for the disposable copy is in NEGATIVE-TEST.md §1
#    (same tunnel, same host — copy .env, paper-settings.js,
#    paper-strategy.js, env-config.js only; never secrets/, never a live run).
#    In a disposable copy of the build tree (never by executing code against
#    a running instance): copy .env, paper-settings.js, paper-strategy.js,
#    env-config.js; run paper-settings.currentValues() and compare
#    RESHAPE_MAX, EMERGENCY_SLPLUS_ARM_PCT, EMERGENCY_SLPLUS_LOCK_PCT,
#    MIN_VOL24H_TVL_X, MAX_POSITIONS, CAPITAL_ASSET, POSITION_SOL_OPEN
#    against the §2 table. (Reference implementation: Appendix A; the
#    negative test in NEGATIVE-TEST.md shows this catching a wrong pin.)
#    For a running instance where code must not be executed, the substitute
#    evidence is: step 2's .env grep for those keys + the chain
#    ".env mtime < service start time, service PID unchanged since that
#    start" (step 1), i.e. the running process started from exactly this .env.
#    Corroborate MAX_POSITIONS / CAPITAL_ASSET from paper/summary.json
#    (maxPositions, capitalAsset) and POSITION_SOL_OPEN from
#    paper/config.json (positionSol).
#    DISPOSAL RULE: after the run, DELETE the disposable copy — or at minimum
#    its .env — immediately. The copy's .env holds live API keys; it is NEVER
#    retained as evidence. The run outputs (stdout + exit code) are the
#    evidence; the copy is not.

# 6. Verdict.
#    PASS — every field in §2 matches across S1–S4, and §2D invariants hold.
#    Record: timestamp, operator, instance, pin-table source, PID, the two
#    log lines verbatim, and the S4 output. File the record with the build.
#    FAIL — any field differs, any pin key absent, any invariant broken, or
#    the log lines belong to an older start. The build DOES NOT PROCEED:
#    do not start the service (or stop it if running for a re-check), fix the
#    pin, and re-run this procedure from step 1. A mismatch found is a
#    result — record it as a finding with owner and due date, do not
#    re-word it as a pass.
```

**Expected output on a PASS** (E-config demo, 24 Nov 2026 — see
`DEMO-EVIDENCE.md` for the full verbatim record): step 2 prints the 25-key
pin exactly as §2B (3 mode keys + 21 strategy/sizing keys +
`LP_SECRETS_DIR`); step 3 prints `0` and the `STOP` listing; step 4 prints
the two 04:06:16 WIB lines exactly as §3.1/§3.2; step 5 prints
`currentValues()` agreement on all 20 settings-layer keys plus
`.env`-direct `PAPER_USDC=0` (21 fields total in the harness: 20
settings-layer keys + `PAPER_USDC`).

---

## 5. OW-5 — carried, not resolved here

**OW-5:** v2 envelope-metadata / `liveSnapshot()` equivalent is **unconfirmed**
against the v2 tree. The v2 startup-log path (§3) is the confirmed check until
resolved.

- **Status in this item:** carried as a build-time resolution item for the
  live-instance specification. **Owner:** Engineering. **Due:** at
  live-instance specification.
- **What it would change if resolved:** if v2 is found to expose envelope
  metadata or a `liveSnapshot()`-equivalent that reports effective settings
  at runtime (not just at startup), this procedure gains a runtime
  re-verification step (settings re-checked mid-window, not only at start).
  Until then, the startup-log comparison in §4 is the whole check, and a
  mid-window `.env` change is only detectable by re-running §4 after a
  restart (the running process reads `.env` at start; `applyPaperSettings()`
  re-applies the file's values every tick, so a mid-window `.env` edit would
  change behaviour without a new startup line — this is a known limitation
  of the log-only check, and the reason the live instance's `.env` must be
  treated as frozen after the §4 PASS: any edit = re-run §4 + a restart).
- **Not attempted here** per the tasking: no v2-tree read for OW-5 was done in
  this item beyond what §3–§4 needed.

---

## 6. Assumptions and open points (stated, not improvised)

1. **Pin-table authority.** §2A is transcribed from v2 review Part 3 §3.2(4);
   §2B from the E-config deploy report + live re-reads. If either source is
   corrected, the table here must be corrected with it — this procedure does
   not re-derive the values.
2. **`MIN_VOL24H_TVL_X` default for the README build is recorded: 2.5**
   (§2A) — code default (`paper-settings.js` DEFAULTS line 66), proven
   pristine by `git diff` vs commit `6c3ae78` (only the two `RESHAPE_MAX`
   lines touched). The README first-start build ran with the 2.5× vol/TVL
   gate ON, not off and not 0. No longer an open point.
3. **`MAX_PUMP1H` 0.135-forcing note is resolved** for the recorded builds:
   first start printed `pump1h=0.15`. If a future code version forces 0.135,
   that is a deviation to record, per the review.
4. **No live decision exists.** The README pin is the base "until an adopted
   arm substitutes" — the procedure is written for a build that does not yet
   exist. The paper instance's E-config is the demonstration vehicle only.
5. **Log retention.** The procedure assumes `paper/bot.log` still contains the
   current start's lines. If the log is rotated/truncated before verification,
   the check cannot be performed from the log — that is a FAIL of evidence,
   not a pass, and the S4 read-back plus a restart (with the new startup
   lines captured) is the recovery.
6. **No QC/Security verdict** is made in this document. The independent
   reviewer owns those.

---

## Appendix A — Reference check (copy-pasteable)

Disposable-copy harness used for the negative test (`NEGATIVE-TEST.md`).
It reproduces the procedure's effective-settings read and the `bot.js:1135`
settings-line format, and exits non-zero on any mismatch. Files needed in the
copy (read-only `scp` from the instance): `.env`, `paper-settings.js`,
`paper-strategy.js`, `env-config.js`, plus an empty `paper/` directory.
Run with the expected pin as JSON in `EXPECTED_PIN_JSON` and the
`.env`-direct fields in `EXPECTED_ENV_JSON`. **Do not run this against a
running instance** — it is a build-time / disposable-copy check; on a running
instance use §4 steps 1–4 plus the `.env`-mtime / PID chain.
**Disposal:** delete the disposable copy — or at minimum its `.env` —
immediately after the run. The copy's `.env` holds live API keys and is never
retained as evidence; the run outputs (stdout + exit code) are the evidence.

```js
// check-pin.js — disposable copy only. Exits 0 on PASS, 1 on MISMATCH.
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ps = require('./paper-settings');

// Line-scoped .env read: the file is streamed one line at a time and only
// lines matching a wanted ^KEY= are retained. The whole file is NEVER loaded
// into memory (no readFileSync on .env) and no key value is ever printed
// except the pin fields the harness is asked to check.
async function readEnvLines(envPath, wanted) {
  const found = new Map(); // key -> value (first matching line wins)
  const present = new Set(); // keys with at least one ^KEY= line
  const stream = fs.createReadStream(envPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || !wanted.has(m[1])) continue;
    present.add(m[1]);
    if (!found.has(m[1])) found.set(m[1], m[2].trim());
  }
  return { found, present };
}

async function main() {
  const v = ps.currentValues(path.join(__dirname, 'paper'));
  const expected = JSON.parse(process.env.EXPECTED_PIN_JSON || '{}');
  const expectedEnv = JSON.parse(process.env.EXPECTED_ENV_JSON || '{}');
  let fails = 0;
  console.log('--- A. currentValues() field-for-field vs expected pin ---');
  for (const k of Object.keys(expected)) {
    const got = v[k];
    const want = expected[k];
    const ok = String(got) === String(want);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${k}: effective=${got} expected=${want}`);
  }
  // Sections B and D share one line-scoped pass over .env (see readEnvLines).
  const wanted = new Set([...Object.keys(expected), ...Object.keys(expectedEnv)]);
  const { found, present } = await readEnvLines(path.join(__dirname, '.env'), wanted);
  console.log('--- B. .env-direct fields (not in the settings layer) ---');
  for (const [k, want] of Object.entries(expectedEnv)) {
    const got = found.get(k);
    const ok = String(got) === String(want);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${k}: .env=${got} expected=${want}`);
  }
  const line = `paper settings applied: MIN_FT=${v.MIN_FT}% MIN_LIQ_USD=${v.MIN_LIQ_USD} MIN_AGE_H=${v.MIN_AGE_H} BIN_STEP=${v.MIN_BIN_STEP}..${v.MAX_BIN_STEP} POSITION_USDC=${v.POSITION_USDC} UPPER_BUFFER_BINS=${v.UPPER_BUFFER_BINS} rightConfirm=${v.OOR_RIGHT_CONFIRM_POLLS} RESHAPE_N=${v.RESHAPE_N} TP_USDC=${v.TP_USD_PCT}% rightOor=${v.OOR_RIGHT_CLOSE} trailing=${v.TRAIL_ENABLED} emergencyTp=${v.EMERGENCY_TP_ENABLED}(priceDrop>=${v.EMERGENCY_TP_TRIGGER_RANGE_PCT}% of open lower range -> TP ${v.EMERGENCY_TP_PCT}%) leftOorMin=${v.OOR_MAX_MIN} emergency=${v.EMERGENCY_DROP} maxHours=${v.MAX_HOURS} GAS_BUFFER_SOL=${v.GAS_BUFFER_SOL} pump1h=${v.MAX_PUMP1H} pump24h=${v.MAX_PUMP_24H} volSpike=${v.VOL_SPIKE_1H_OF_24H} tokenFilters=${v.FILTERS_ENABLED ? 'ON' : 'OFF'}(pump1h=${v.PUMP1H_FILTER_ENABLED} pump24h=${v.PUMP24H_FILTER_ENABLED} rugcheck=${v.RUGCHECK_ENABLED} topHolders=${v.TOP_HOLDERS_ENABLED} insiders=${v.CHECK_INSIDERS}<=${v.MAX_INSIDER_PCT}% antiPvp=${v.ANTI_PVP_MODE}>=$${v.ANTI_PVP_MIN_LIQ_USD})`;
  console.log('--- C. simulated startup settings line (bot.js:1135 template) ---');
  console.log(line);
  console.log('--- D. pin-presence check (§1 mandatory rule) ---');
  // Effective-value agreement alone is NOT enough: six E-config pin values
  // equal the code defaults, so a deleted pin key would still print the
  // "right" effective value in section A. A key with no ^KEY= line in the
  // copy's .env is a FAIL even if section A passed it.
  for (const k of [...Object.keys(expected), ...Object.keys(expectedEnv)]) {
    const ok = present.has(k);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${k}: ${ok ? 'present (^KEY= line in .env)' : 'MISSING — no ^KEY= line in .env; pin key absent'}`);
  }
  console.log(fails === 0 ? 'RESULT: PASS — all pinned fields match' : `RESULT: MISMATCH — ${fails} field(s) differ/missing; build does NOT proceed`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error('Harness error:', e.message); process.exit(1); });
```

Why `PAPER_USDC` is in section B, not A: `paper-settings.js` lists
`PAPER_USDC` among `FORBIDDEN_KEYS` (capital/funding keys), so
`currentValues()` never returns it — verified in the negative test
(positive control printed `PAPER_USDC: effective=undefined` before the
split was made; see `NEGATIVE-TEST.md`).

Why section D exists: section A compares effective values, which fall back
to code defaults for missing keys — deleting a pin key whose value equals
its default passes section A silently (review cases A4/A5). Section D fails
the run when any expected pin key has no `^KEY=` line in the copy's `.env`,
enforcing the §1 mandatory pin-presence rule in the harness itself.

*End of procedure.*
