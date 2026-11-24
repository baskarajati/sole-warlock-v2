# Item 6 — Negative test (disposable copy on this VM)

**Track:** Warlock live system-readiness, Item 6 (v2 settings-pin verification, C1)
**Procedure under test:** `PROCEDURE.md` (§4, Appendix A harness)
**Date/time:** 2026-11-24, ~17:41–17:44 CET
**Rule under test:** a wrong pin must be **flagged**, not merely a right pin
passed. The check must be shown to catch a wrong pin.

**No VPS write was made.** The copy was made by read-only `scp` from the VPS;
the changed value exists only in the disposable copy on this VM
(`/tmp/item6-negtest/`). Nothing on the VPS was modified, restarted, or
re-read after the change — the live instance is untouched and still runs the
pristine pin (`DEMO-EVIDENCE.md`).

---

## 1. Method

```bash
# 1. Disposable copy — read-only scp of exactly the files the check needs:
mkdir -p /tmp/item6-negtest/paper
cd /tmp/item6-negtest
for f in .env paper-settings.js paper-strategy.js env-config.js; do
  scp -o StrictHostKeyChecking=accept-new \
      -o ProxyCommand='python3 ~/workspace/oversight-division/ssh-via-tunnel.py %h %p' \
      "sunteak@100.99.178.98:/home/sunteak/apps/warlock-v2/$f" "./$f"
done
chmod 600 .env
cp .env .env.pristine
# Files copied: .env (1,342 bytes), paper-settings.js, paper-strategy.js,
# env-config.js. No secrets/ directory, no paper state, no node_modules —
# the check needs only the settings layer. (secrets/ was never touched.)

# 2. Harness (Appendix A of PROCEDURE.md, saved as check-pin.js in the copy):
#    - Section A: paper-settings.currentValues() — the same function the
#      23 Nov E-config deploy used for its E1 read-back — compared
#      field-for-field against the expected pin table (EXPECTED_PIN_JSON).
#    - Section B: .env-direct fields (PAPER_USDC — see §3 below).
#    - Section C: simulated startup settings line, built from the
#      bot.js:1135 template string, so the line the bot WOULD print at
#      startup can be compared with the expected line.
#    Exits 0 on PASS, 1 on MISMATCH ("build does NOT proceed").
```

Expected pin table used (E-config, `PROCEDURE.md` §2B — 20 settings-layer
keys in `EXPECTED_PIN_JSON`, plus `PAPER_USDC=0` in `EXPECTED_ENV_JSON`):

```json
{"MIN_FT":0.6,"MIN_LIQ_USD":10000,"MIN_AGE_H":0.5,"MIN_BIN_STEP":80,"MAX_BIN_STEP":400,"MAX_PUMP1H":0.15,"MAX_PUMP24H_PCT":200,"TP_USD_PCT":13,"EMERGENCY_DROP":0.2,"MAX_POSITIONS":7,"POSITION_USDC":500,"GAS_BUFFER_SOL":0.3,"MAX_POSITION_TVL_PCT":5,"MAX_HOURS":12,"EMERGENCY_SLPLUS_ARM_PCT":3,"EMERGENCY_SLPLUS_LOCK_PCT":0.1,"MIN_VOL24H_TVL_X":0,"RESHAPE_MAX":5,"CAPITAL_ASSET":"SOL","POSITION_SOL_OPEN":2}
{"PAPER_USDC":"0"}
```

---

## 2. Positive control — pristine copy (the check passes a right pin)

`node check-pin.js` on the unmodified copy. Output verbatim (exit 0):

```
--- A. currentValues() field-for-field vs expected pin ---
OK   MIN_FT: effective=0.6 expected=0.6
OK   MIN_LIQ_USD: effective=10000 expected=10000
OK   MIN_AGE_H: effective=0.5 expected=0.5
OK   MIN_BIN_STEP: effective=80 expected=80
OK   MAX_BIN_STEP: effective=400 expected=400
OK   MAX_PUMP1H: effective=0.15 expected=0.15
OK   MAX_PUMP24H_PCT: effective=200 expected=200
OK   TP_USD_PCT: effective=13 expected=13
OK   EMERGENCY_DROP: effective=0.2 expected=0.2
OK   MAX_POSITIONS: effective=7 expected=7
OK   POSITION_USDC: effective=500 expected=500
OK   GAS_BUFFER_SOL: effective=0.3 expected=0.3
OK   MAX_POSITION_TVL_PCT: effective=5 expected=5
OK   MAX_HOURS: effective=12 expected=12
OK   EMERGENCY_SLPLUS_ARM_PCT: effective=3 expected=3
OK   EMERGENCY_SLPLUS_LOCK_PCT: effective=0.1 expected=0.1
OK   MIN_VOL24H_TVL_X: effective=0 expected=0
OK   RESHAPE_MAX: effective=5 expected=5
OK   CAPITAL_ASSET: effective=SOL expected=SOL
OK   POSITION_SOL_OPEN: effective=2 expected=2
--- B. .env-direct fields (not in the settings layer) ---
OK   PAPER_USDC: .env=0 expected=0
--- C. simulated startup settings line (bot.js:1135 template) ---
paper settings applied: MIN_FT=0.6% MIN_LIQ_USD=10000 MIN_AGE_H=0.5 BIN_STEP=80..400 POSITION_USDC=500 UPPER_BUFFER_BINS=0 rightConfirm=2 RESHAPE_N=5 TP_USDC=13% rightOor=true trailing=false emergencyTp=true(priceDrop>=50% of open lower range -> TP 10%) leftOorMin=0 emergency=0.2 maxHours=12 GAS_BUFFER_SOL=0.3 pump1h=0.15 pump24h=5 volSpike=0.5 tokenFilters=ON(pump1h=true pump24h=true rugcheck=true topHolders=true insiders=true<=25% antiPvp=KEEP_BIGGEST>=$10000)
RESULT: PASS — all pinned fields match
```

**21/21 fields PASS.** Two things this control proves beyond the pass itself:

- **Harness fidelity:** the simulated settings line (section C) is
  **byte-identical** to the live line 3039 from the VPS (`DEMO-EVIDENCE.md`
  §4). The harness reproduces the bot's own log format exactly, so a
  mismatch in section C means the real startup line would mismatch too.
- **A real finding on the way:** the first run of the harness put
  `PAPER_USDC` in section A and printed `FAIL PAPER_USDC:
  effective=undefined expected=0`. Inspection showed why:
  `paper-settings.js` lists `PAPER_USDC` among `FORBIDDEN_KEYS`
  (capital/funding keys, line ~179), so `currentValues()` never returns it.
  The harness was corrected (section B: direct `.env` read) and the
  procedure records this permanently (`PROCEDURE.md` §3.3.3, Appendix A
  note). The check was fixed by understanding the code, not by weakening
  the comparison.

---

## 3. The negative test — ONE value changed

**The change** (only change in the copy; `diff .env.pristine .env` proves it):

```
$ sed -i 's/^MIN_FT=0.6$/MIN_FT=1.0/' .env
$ grep '^MIN_FT=' .env
MIN_FT=1.0
$ diff .env.pristine .env
31c31
< MIN_FT=0.6
---
> MIN_FT=1.0
```

One line, one field: `MIN_FT` `0.6` → `1.0` (the README value, chosen
deliberately — it is the value a fresh install's defaults-trap would *not*
produce, and the value the live-build pin *does* use, so the test also
guards against pin-table confusion between §2A and §2B).

**Result** — same command, same expected table, exit **1**. Output verbatim:

```
--- A. currentValues() field-for-field vs expected pin ---
FAIL MIN_FT: effective=1 expected=0.6
OK   MIN_LIQ_USD: effective=10000 expected=10000
OK   MIN_AGE_H: effective=0.5 expected=0.5
OK   MIN_BIN_STEP: effective=80 expected=80
OK   MAX_BIN_STEP: effective=400 expected=400
OK   MAX_PUMP1H: effective=0.15 expected=0.15
OK   MAX_PUMP24H_PCT: effective=200 expected=200
OK   TP_USD_PCT: effective=13 expected=13
OK   EMERGENCY_DROP: effective=0.2 expected=0.2
OK   MAX_POSITIONS: effective=7 expected=7
OK   POSITION_USDC: effective=500 expected=500
OK   GAS_BUFFER_SOL: effective=0.3 expected=0.3
OK   MAX_POSITION_TVL_PCT: effective=5 expected=5
OK   MAX_HOURS: effective=12 expected=12
OK   EMERGENCY_SLPLUS_ARM_PCT: effective=3 expected=3
OK   EMERGENCY_SLPLUS_LOCK_PCT: effective=0.1 expected=0.1
OK   MIN_VOL24H_TVL_X: effective=0 expected=0
OK   RESHAPE_MAX: effective=5 expected=5
OK   CAPITAL_ASSET: effective=SOL expected=SOL
OK   POSITION_SOL_OPEN: effective=2 expected=2
--- B. .env-direct fields (not in the settings layer) ---
OK   PAPER_USDC: .env=0 expected=0
--- C. simulated startup settings line (bot.js:1135 template) ---
paper settings applied: MIN_FT=1% MIN_LIQ_USD=10000 MIN_AGE_H=0.5 BIN_STEP=80..400 POSITION_USDC=500 UPPER_BUFFER_BINS=0 rightConfirm=2 RESHAPE_N=5 TP_USDC=13% rightOor=true trailing=false emergencyTp=true(priceDrop>=50% of open lower range -> TP 10%) leftOorMin=0 emergency=0.2 maxHours=12 GAS_BUFFER_SOL=0.3 pump1h=0.15 pump24h=5 volSpike=0.5 tokenFilters=ON(pump1h=true pump24h=true rugcheck=true topHolders=true insiders=true<=25% antiPvp=KEEP_BIGGEST>=$10000)
RESULT: MISMATCH — 1 field(s) differ; build does NOT proceed
```

**The check caught it.** Exactly one field failed (`MIN_FT:
effective=1 expected=0.6`); the other 20 fields still passed — the check
is specific, not a blanket failure. The simulated startup line now reads
`MIN_FT=1%` where the expected line reads `MIN_FT=0.6%`: had this `.env`
been used for a build, the startup log would have printed the wrong value
and the §4 comparison would have failed it there too. Exit code 1, verdict
`MISMATCH — build does NOT proceed`, exactly as the procedure requires.

---

## 4. Verdict

**Negative test PASSED as a test:** the verification procedure flags a
single wrong pin value (MIN_FT 0.6 → 1.0), names the field, shows the
effective vs expected values, and refuses the build. Combined with the
positive control (§2: 21/21 PASS on the pristine copy, simulated line
byte-identical to the live startup line), the check is shown to both pass a
right pin and catch a wrong one.

**Cleanup / persistence note:** the copy lives in `/tmp/item6-negtest/`
(disposable by design; `/tmp` is ephemeral). The harness source is preserved
in `PROCEDURE.md` Appendix A and the full inputs/outputs are in this file,
so the test is reproducible from the deliverables alone without the `/tmp`
copy. The `.env.pristine` / `.env` pair in `/tmp` was left in the changed
state (MIN_FT=1.0) so the evidence can be re-run, not silently restored.

---

## 5. Post-review fix record (2026-11-24, ~18:00 CET) — N1–N7 applied

Independent review (`REVIEW.md` §5, notes N1–N8) gave QA PASS, QC PASS WITH
NOTES, Security PASS WITH NOTES. Fixes N1–N5 (plus ride-along N6/N7) were
applied to `PROCEDURE.md`; this section records what changed and the
post-fix re-runs. The original results above (§2–§4) are **not** rewritten —
the re-runs below are new rows. `REVIEW.md` was not edited.

### What changed in `PROCEDURE.md`

- **N1 (§3.1):** "exactly six tokens" → "exactly five tokens" (the sentence
  listed five; token-by-token diff confirms five).
- **N2 (§4 expected output):** step 2 prints the **25-key** pin (3 mode keys
  + 21 strategy/sizing keys + `LP_SECRETS_DIR`), not "21-key". The 21-field
  harness count (20 settings-layer keys + `PAPER_USDC`) is now stated
  separately so the two numbers cannot be confused again.
- **N3 (Appendix A — substantive):** new **section D pin-presence check**.
  For every expected pin key (section A keys + section B keys) the harness
  now FAILs, naming the key, when the copy's `.env` has no `^KEY=` line —
  enforcing the §1 mandatory rule the old harness contradicted (deleted
  `MIN_FT` / `EMERGENCY_DROP` used to exit 0). Section D's rationale is
  recorded in Appendix A below the harness.
- **N4 (Appendix A + §4 step 5):** (a) §B/§D now read `.env` **line-scoped**
  — streamed one line at a time via `readline`, retaining only lines
  matching a wanted `^KEY=`; the whole-file `readFileSync('.env')` is gone
  (the harness source in `PROCEDURE.md` contains no whole-file `.env`
  read; the only `readFileSync` string left is a comment saying it is not
  used). (b) New **disposal rule** in §4 step 5 and Appendix A: delete the
  disposable copy — or at minimum its `.env` — immediately after the run;
  the copy is never retained as evidence (run outputs are the evidence).
  (c) **Retained-copy disposal confirmed:** `/tmp/item6-negtest/.env` and
  `.env.pristine` were deleted by the coordinator and verified gone by the
  builder on 2026-11-24 (the `/tmp/item6-negtest/` directory itself remains,
  holding only `check-pin.js` and the settings files — no key material);
  the builder's own `/tmp/item6-verify` copy is also gone. The old
  `.env`-bearing copy was **not** recreated for these re-runs.
- **N5 (§2A defaults-in-force + §6.2):** `MIN_VOL24H_TVL_X` code default
  recorded as **2.5** — `paper-settings.js` DEFAULTS line 66, independently
  re-verified by the builder in the fresh copy, and `git diff` vs commit
  `6c3ae78` re-run read-only (touches only the two `RESHAPE_MAX` lines, so
  the 2.5 is pristine). Consequence now stated: the README first-start build
  ran with the 2.5× vol/TVL gate **ON** (filtering thin tokens), not off and
  not 0. The "UNKNOWN — must be recorded at live-build freeze" flag is
  removed (it is now recorded).
- **N6 (§2B source line):** `GAS_BUFFER_SOL=0.30` and
  `MAX_POSITION_TVL_PCT=5` noted as carried over unchanged from the README
  pin (not in the deploy report's §1 table); values verified live.
- **N7 (§4 step 5):** pointer added to the read-only ssh/scp method
  (`DEMO-EVIDENCE.md` §0 ssh command / this file's §1 scp) so the procedure
  alone tells a future operator how to reach the instance.
- **N8:** no change (cosmetic drift only, recorded in the review).

### Post-fix re-runs (fresh disposable copy `/tmp/item6-fix/`, since deleted)

Method identical to §1 above (read-only `scp` of `.env`,
`paper-settings.js`, `paper-strategy.js`, `env-config.js`; harness copied
verbatim from the revised `PROCEDURE.md` Appendix A). Full outputs in
`fix-runs/` (`01`–`06`); only pin values and harness output — no key values.
The copy was **deleted immediately after the runs** per the new N4 rule
(verified gone; see below).

| # | Case | Change (disposable copy only) | Exit | Result |
|---|---|---|---|---|
| F0 | Positive control (pristine `.env`) | none | **0** | 21/21 fields OK incl. section D 21/21 present; section C line byte-identical to live line 3039 |
| F1 | Builder's negative test | `MIN_FT` 0.6→1.0 | **1** | `FAIL MIN_FT: effective=1 expected=0.6` |
| F2 | Reviewer A4 (was exit 0) | delete `MIN_FT=` line | **1** | Section A still passes it (`effective=0.6`, code-default fallback — proving D is what catches it); section D: `FAIL MIN_FT: MISSING — no ^KEY= line in .env; pin key absent` |
| F3 | Reviewer A5 (was exit 0) | delete `EMERGENCY_DROP=` line | **1** | Section D: `FAIL EMERGENCY_DROP: MISSING — no ^KEY= line in .env; pin key absent` |
| F4 | Reviewer A1 (regression) | `RESHAPE_MAX` 5→7 | **1** | `FAIL RESHAPE_MAX: effective=7 expected=5` |
| F5 | Reviewer A3 (regression) | `MAX_PUMP24H_PCT` 200→50 | **1** | `FAIL MAX_PUMP24H_PCT: effective=50 expected=200`; section C still prints `pump24h=5` — the settings-line trap is intact, section A catches it |

### Disposal confirmations (2026-11-24, after the re-runs)

- Fresh copy `/tmp/item6-fix/` — **deleted** (`rm -rf`, verified: no such
  file or directory). Its `.env` (live keys) existed only for the duration
  of the runs.
- Retained `/tmp/item6-negtest/.env` and `.env.pristine` — **gone**
  (deleted by the coordinator before these re-runs; verified absent by the
  builder; not recreated).
- Builder's `/tmp/item6-verify` copy — **gone** (verified absent).

No key values were printed in any file or output in this fix round (key
names only, as in the review). No VPS write was made at any point.

*End of negative-test record (updated post-review).* 
