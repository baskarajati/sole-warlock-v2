# Item 6 — Independent Review (QA / QC / Security)

**Track:** Warlock live system-readiness, Item 6 (v2 settings-pin verification, caveat C1)
**Plan ref:** `SYSTEM-READINESS-PLAN-2026-11-24.md` §8
**Reviewer:** Independent Reviewer (not the builder) · **Date:** 2026-11-24, ~17:47–18:00 CET
**Under review:** `PROCEDURE.md`, `DEMO-EVIDENCE.md`, `NEGATIVE-TEST.md` (builder, 2026-11-24)
**Method:** read all three files in full; re-ran the demo live by read-only SSH
against `~/apps/warlock-v2` / `warlock-v2-paper.service`; re-ran the harness
positive control, the builder's negative test, and five adversarial cases of my
own design in a fresh disposable copy (`/tmp/item6-review`, since deleted);
verified both pin tables field-for-field against their stated sources and the
field→pin-key maps against the live code (`bot.js`, `paper-settings.js`,
`git diff` vs the reviewed commit).
**Builder's files were not edited.** The builder's evidence copy
`/tmp/item6-negtest/` was not disturbed (still `MIN_FT=1.0`, verified after my runs).

---

## 1. QA verdict — PASS

The demonstration reproduces exactly. Every builder claim I re-ran checked out
verbatim; the harness passes a right pin (exit 0) and catches a wrong one
(exit 1); the simulated settings line is byte-identical to the live line 3039.

| Check (my own run) | Result |
|---|---|
| Service identity | `active (running) since Mon 2026-11-23 22:06:15 CET`, Main PID **1223431**, `node bot.js` PID 1223438 — matches demo; instance live (CoinGecko 429 line in the status tail at 17:45:54 CET) |
| `.env` pin (named-key grep, step 2 pattern) | All **25** lines, every §2B value — byte-identical to `DEMO-EVIDENCE.md` §2 |
| `.env` mtime / PID chain | `.env` mode 600, mtime 23 Nov 22:06, **before** service start 22:06:15; PID unchanged since — the §4-step-5 substitute evidence holds |
| Mode / key invariants | `PAPER=1`, `DRY_RUN=1`, `LIVE_CONFIRMED=0`; `grep -c "^PRIVATE_KEY="` → **0**; `STOP` present |
| Startup-log lines | Last `paper settings applied` = **line 3039**, last `start PAPER` = **line 3042**, both `04:06:16 WIB` (= 22:06:16 CET, the current start) — verbatim identical to `PROCEDURE.md` §3.1/§3.2 and `DEMO-EVIDENCE.md` §4 |
| README first-start lines | Log lines **1 and 5** (23 Nov 02:28:26 WIB) verbatim identical to `PROCEDURE.md` §3.1/§3.2 README transcriptions (`MIN_FT=1%`, `MIN_AGE_H=24`, `TP_USDC=20%`, `emergency=0.3`, `pump24h<=50%`) |
| Log-line counts | 7 `paper settings applied` lines, 7 `start PAPER` lines — matches demo |
| Corroboration | `paper/summary.json` stats: `capitalAsset=SOL`, `totalDepositedSol=14`, `maxPositions=7`, `openCount=1`, `trades=5` (equitySol 14.134 at my read vs 14.077 at demo — moved with trading, as expected); `paper/config.json`: `positionSol=2`, `maxPump24h=2`, `maxPositions=7`, `emergencyDrop=0.2`, `minFt=0.6`, `minAgeH=0.5`, `maxPump1h=0.15`, `maxPosTvlFrac=0.05`, `minLiqUsd=10000`, `usdcStart=0`; `positions_open.json`: `maxPositions=7`, `openCount=1`; stale `"capital":{"mode":"usdc500"}` metadata confirmed present, correctly ignored per §3.3.4 |
| Harness positive control (fresh copy) | **Exit 0, 21/21 fields OK**; simulated line byte-identical to live line 3039 body (see `review-runs/01-positive-control-exit0.txt`) |
| Harness negative test, builder's case (fresh copy, `MIN_FT` 0.6→1.0) | **Exit 1**, `FAIL MIN_FT: effective=1 expected=0.6`, `RESULT: MISMATCH — 1 field(s) differ; build does NOT proceed` (see `review-runs/02-negative-minft-exit1.txt`) |
| Harness writes nothing | `.env` md5 identical before/after a harness run; `paper/` stayed empty — no audit/settings writes from `currentValues()` |

**Trap confirmations (observed live, not just read):** `pump24h=5` is constant
across the README and E settings lines while the cap differs (`pump24h<=50%`
vs `<=200%`) — settings-line-only checking would miss a wrong pump cap, as
§3.3.1 states. The E start line's `capital=0 USDC only` / `POSITION_USDC=500`
cosmetic strings are present exactly as §3.3.4 describes.

## 2. QC verdict — PASS WITH NOTES

**Pin tables verified field-for-field against their stated sources — all values match.**

- **§2A (README pin) vs v2 review Part 3 §3.2(4)**
  (`~/workspace/engineering-division/warlock-v2-review-2026-11-22.md`, line 110):
  all 15 strategy values match exactly (`MIN_FT=1`, `MIN_AGE_H=24`,
  `MIN_BIN_STEP=100`, `MAX_BIN_STEP=400`, `MAX_PUMP1H=0.15`,
  `MAX_PUMP24H_PCT=50`, `TP_USD_PCT=20`, `EMERGENCY_DROP=0.30`,
  `MAX_POSITIONS=1`, `PAPER_USDC=500`, `POSITION_USDC=500`,
  `GAS_BUFFER_SOL=0.30`, `MAX_POSITION_TVL_PCT=5`, `MIN_LIQ_USD=10000`,
  `MAX_HOURS=12`), plus the mode block and `LP_SECRETS_DIR` pin (§3.2(3)).
  The `MAX_PUMP1H` 0.135-forcing note is correctly carried: the code default
  is indeed 0.135 (`paper-settings.js` DEFAULTS), the pin 0.15 wins, and the
  first start printed `pump1h=0.15` — no forcing occurred.
- **§2B (E-config pin) vs the E-config deploy report**
  (`~/workspace/engineering-division/warlock-v2-e-config-deploy-2026-11-23.md`,
  §1 mapping + §4 + Addenda 1–2): every mapped value matches, including the
  Addendum 2 final sizing (`POSITION_SOL_OPEN=2.0`, `MAX_POSITIONS=7`,
  14 SOL book) and the E1 fields (`RESHAPE_MAX=5`, SL+ arm/lock `3`/`0.1`,
  `MIN_VOL24H_TVL_X=0`). (Two carried-over values are not in the deploy
  report's §1 table — see note N6.)
- **Defaults-in-force (§2A/§2B) verified against the live code** in the
  disposable copy: `RESHAPE_MAX` default `null` (unlimited); SL+ fallbacks
  `7`/`5`; Emergency-TP `10`/`50`; SL+ confirm/floor `3`/`0`; `RESHAPE_N=5`;
  `MAX_PUMP_24H=5`; `VOL_SPIKE_1H_OF_24H=0.5`; `PAPER_USDC` in
  `FORBIDDEN_KEYS` (line 177–181). All as stated — **except** `MIN_VOL24H_TVL_X`
  (see N5).
- **Field→pin-key maps (§3.1/§3.2) verified against `bot.js`:**
  settings-line template at `bot.js:1135` matches the Appendix A harness
  template token-for-token; start-line template at `bot.js:2902` matches the
  §3.2 map (`capital=`, `minAge=`, `minFt=`, `pump24h<=`, `emergencyNetUsdcDrop=`,
  `tvlCap=`, `TP_USDC=`, `maxHold=`, `Private key not loaded`). The pump-cap
  chain is proven in code: `bot.js:1123` sets
  `CFG.MAX_PUMP_24H = values.MAX_PUMP24H_PCT/100`, so the start line's
  `pump24h<=200%` is driven by the pin while the settings line's `pump24h=5`
  is the separate default-5 field — the §3.3.1 trap is real and the map is
  correct. `bot.js:1112` (`MAX_POS_TVL_FRAC = MAX_POSITION_TVL_PCT/100`) and
  `:1116` (copy list incl. `MAX_PUMP24H_PCT`, `MAX_POSITIONS`,
  `CAPITAL_ASSET`, `POSITION_SOL_OPEN`) corroborate the rest. The E patch
  scope is confirmed by `git diff` vs the reviewed commit `6c3ae78`:
  exactly 3 files, and in `paper-settings.js` only the two `RESHAPE_MAX`
  additions.
- **Procedure executable as written:** steps 1–6 ran verbatim (steps 1–4 live,
  step 5 via Appendix A, step 6 verdict rule unambiguous). FAIL behaviour is
  stated and was observed (exit 1, "build does NOT proceed"). The §1
  pin-presence rule is stated in the procedure text and enforced by the step-2
  grep — but **not** by the Appendix A harness (see N3).
- **OW-5 and the mid-window limitation (§5)** are carried honestly: OW-5 is
  stated unconfirmed with owner (Engineering) and due (live-instance
  specification), not claimed resolved; the mid-window `.env`-edit limitation
  is stated with its mechanism (`applyPaperSettings()` re-reads the file every
  tick — confirmed: `currentValues()` re-reads `.env` on every call and
  `applyPaperSettings` runs at `bot.js:1789/1876/2740/2767`) and the
  freeze-after-PASS rule.

The notes (N1–N8 below) are two wrong counts, one now-resolvable "unknown",
one harness gap, and minor sourcing/executability nits. None overturns a pin
value or a log-line match.

## 3. Security verdict — PASS WITH NOTES

- **No VPS write, no restart, no key touch — verified, not assumed.** Every
  command I ran was read-only (`systemctl --user status`, `grep`, `sed -n`,
  `ls`, `python3` JSON reads, `git diff`/`git log`). Nothing on the VPS was
  created, edited, restarted, or stopped. `secrets/` was never listed or
  read. No key material was read anywhere: `.env` was read by named-key grep
  only on the VPS, and `grep -c "^PRIVATE_KEY="` returned 0.
- **`.env` handling in the procedure is sound on the live path** (named-key
  grep, §4 step 2). The gap is in the disposable-copy path (see N4): the
  Appendix A harness reads the whole `.env` file into memory, and that file
  contains live API keys beyond the pin (see N4). The harness prints only the
  requested key and has no network/write path — I read `check-pin.js` in full
  (no network, no file writes; `currentValues()` is a pure read; the write
  functions in `paper-settings.js` live in save/audit/pause paths the harness
  never calls; require-time `env-config.load()` mutates only the harness
  process's in-memory environment). Risk is containment, not exfiltration.
- **No write/execute/exfiltrate path in the procedure.** The only code
  execution is `node check-pin.js` against a disposable copy of the settings
  layer — no `bot.js`, no service start, no network. (Trivial observation, no
  action: `env-config.load()` contains a `LIVE_LAUNCH=1` branch that would
  flip mode flags in the harness process's environment if that variable were
  set; it is unset in the harness runs and the harness never starts a bot.)
- **OW-5** is carried, not claimed resolved (§5). **Mid-window `.env`-edit
  limitation** is stated (§5) with the freeze-after-PASS rule.
- **No secrets in this review's outputs.** The run files in `review-runs/`
  contain only pin values and harness output. Key names (not values) are named
  in N4 only to scope the finding.

## 4. My run results (all in `review-runs/`)

| # | Case | Change (disposable copy only) | Exit | Result |
|---|---|---|---|---|
| R0 | Positive control (pristine `.env`) | none | **0** | 21/21 OK; simulated line byte-identical to live 3039 |
| R1 | Builder's negative test | `MIN_FT` 0.6→1.0 | **1** | `FAIL MIN_FT: effective=1 expected=0.6` |
| A1 | Adversarial: E1 field the log lines don't print | `RESHAPE_MAX` 5→7 | **1** | `FAIL RESHAPE_MAX: effective=7 expected=5` |
| A2 | Adversarial: deleted pin key (default differs) | delete `MAX_POSITIONS=` line | **1** | `FAIL MAX_POSITIONS: effective=10 expected=7` (code default surfaces) |
| A3 | Adversarial: start-line-only trap | `MAX_PUMP24H_PCT` 200→50 | **1** | `FAIL MAX_PUMP24H_PCT: effective=50 expected=200`; section C line still prints `pump24h=5` — the simulated settings line cannot see this field, exactly as §3.3.1 warns |
| A4 | Adversarial: deleted pin key (default EQUALS pin) | delete `MIN_FT=` line | **0 — FINDING (N3)** | `RESULT: PASS` — harness silently passes a missing pin |
| A5 | Adversarial: second default-equal deletion | delete `EMERGENCY_DROP=` line | **0 — FINDING (N3)** | `RESULT: PASS` — same gap, second key |

The builder's `/tmp/item6-negtest/` copy was left untouched
(`MIN_FT=1.0` before and after my runs). My own copy (`/tmp/item6-review`)
was deleted after the runs; the seven run outputs above are the record.

## 5. Notes

| # | Note | Severity | Owner | Close-out |
|---|---|---|---|---|
| N1 | **§3.1 "six tokens" is wrong.** The README and E settings lines differ in exactly **five** tokens (`MIN_FT`, `MIN_AGE_H`, `BIN_STEP`, `TP_USDC`, `emergency`) — confirmed by token-by-token diff (32 tokens each, 5 differ). The sentence says "exactly six" and then lists five. | Low | Engineering Builder | **Fix before DONE** — change "six" to "five" |
| N2 | **§4 "step 2 prints the 21-key pin" is wrong.** The step-2 grep prints **25** lines for §2B (3 mode keys + 21 strategy/sizing keys + `LP_SECRETS_DIR`). I counted 25 in my live run. "21" is the harness field count (20 settings-layer keys + `PAPER_USDC`), not the step-2 output. | Low | Engineering Builder | **Fix before DONE** — "25-key pin" (or state the 21-field harness count separately) |
| N3 | **Appendix A harness does not enforce the §1 pin-presence rule.** §1 mandates: a pin key absent from `.env` is a FAIL even if the effective value matches. The harness compares only `currentValues()` effective values, which fall back to code defaults for missing keys. Demonstrated: deleting `MIN_FT` (A4) and `EMERGENCY_DROP` (A5) both exit **0 PASS**. Mechanism covers all six default-equal E keys (`MIN_FT` 0.6, `MIN_AGE_H` 0.5, `MIN_BIN_STEP` 80, `MAX_PUMP24H_PCT` 200, `TP_USD_PCT` 13, `EMERGENCY_DROP` 0.2 — all six defaults confirmed in `paper-settings.js` DEFAULTS). The manual procedure is NOT affected (step-2 grep enforces presence), so the live-build gate is sound; the gap is confined to the disposable-copy reference implementation, which contradicts the rule it implements. | Moderate | Engineering Builder | **Fix before DONE** — add a presence check to Appendix A (e.g. a section D that fails when any expected pin key has no `^KEY=` line in the copy's `.env`), then re-run positive (must stay exit 0) + negative + A4/A5 (must become exit 1 with the field named); reviewer re-verifies by read-back |
| N4 | **Harness reads the whole `.env`; the retained evidence copy holds live API keys.** Appendix A §B does `fs.readFileSync('.env','utf8')` — a whole-file read — although the procedure's own rule (§1/§4) is named-key grep only, "never `cat` the whole file". The copied `.env` contains non-pin secrets beyond the pin: `HELIUS_API_KEY`, `JUPITER_API_KEY`, Telegram IDs/username, RPC URL, Mini App host/port (key names only — no values are recorded in this review). The harness prints only `PAPER_USDC` and has no exfiltration path, so exposure is containment-only; but the builder's `/tmp/item6-negtest/.env` is left in place indefinitely as "evidence" with those live keys in it, and the procedure states no disposal rule for the disposable copy. | Low–Moderate (Security) | Engineering Builder (+ coordinator for the retained copy) | **Fix before DONE** — (a) make Appendix A §B line-scoped (read `.env` line by line / grep-style, never whole-file); (b) add a procedure rule: delete the disposable copy (or strip all non-pin keys) after the run; (c) dispose of the retained `/tmp/item6-negtest/.env` now (delete the copy or strip non-pin keys) since its evidence value is superseded by `review-runs/` |
| N5 | **§2A `MIN_VOL24H_TVL_X` "UNKNOWN" is now known: the code default is 2.5.** `paper-settings.js` DEFAULTS line 66: `MIN_VOL24H_TVL_X: 2.5`. Proven pristine, not E-patch-touched: `git diff` vs the reviewed commit `6c3ae78` touches only the two `RESHAPE_MAX` lines in `paper-settings.js`. Consequence the procedure does not state: the README first-start build ran with the 2.5× vol/TVL gate **on** (filtering thin tokens), not off and not 0. The live-build freeze no longer needs to "record the code default before relying on it" — it is recorded here. | Moderate | Engineering Builder | **Fix before DONE** — record `2.5` in §2A (defaults-in-force) and §6.2, citing this `git diff` evidence |
| N6 | **§2B sourcing gap (values correct).** `GAS_BUFFER_SOL=0.30` and `MAX_POSITION_TVL_PCT=5` do not appear in the E-config deploy report's §1 mapping table; they are carried over unchanged from the README pin. Both values are verified live (`.env` + log lines), so this is citation precision only. | Low | Engineering Builder | Accept in writing — note the carry-over in the §2B source line at the next revision |
| N7 | **§4 step 5 omits the SSH/scp method.** The read-only `scp` for the disposable copy is described in `NEGATIVE-TEST.md` and the tunnel `ssh` command in `DEMO-EVIDENCE.md` §0, but `PROCEDURE.md` itself never states how to reach the instance. A future operator working from the procedure alone must discover it. | Low | Engineering Builder | Accept in writing — add a pointer to the `DEMO-EVIDENCE.md` §0 ssh command at the next revision |
| N8 | **Filed harness vs Appendix A: cosmetic drift only.** `/tmp/item6-negtest/check-pin.js` differs from `PROCEDURE.md` Appendix A in header comment wording and inline `require('path')` vs `const path`; logic is identical (verified by diff). No action. | Trivial | — | Accept in writing — recorded here; no change needed |

## 6. Final line

**Item 6 is NOT DONE.** QA PASS, QC PASS WITH NOTES, Security PASS WITH NOTES —
the procedure, the live demo, and the negative test all meet the plan §8.3
acceptance bar in substance, but five notes require fixing before DONE:
**N1** (five, not six tokens), **N2** (25-key, not 21-key step-2 output),
**N3** (harness pin-presence check + re-run), **N4** (line-scoped `.env` read,
disposal rule, and disposal of the retained key-bearing `/tmp/item6-negtest`
copy), and **N5** (record `MIN_VOL24H_TVL_X` default 2.5). N6–N8 are accepted
in writing as recorded above. What remains: the builder applies the N1–N5
fixes (all small: two one-word count corrections, one recorded default, one
harness section + re-run, one disposal rule + cleanup), and the reviewer
re-verifies the changed files and the re-run outputs by read-back — then Item 6
is DONE.

*End of review.*

---

## 6. Close-out re-review (2026-11-24, ~18:32–18:40 CET)

**Reviewer:** Independent Reviewer (same reviewer; not the builder).
**Under re-review:** the fixed `PROCEDURE.md` (revision note, §3.1, §4 step 2/5,
§2A/§6.2, Appendix A) and `NEGATIVE-TEST.md` §5 (fix record + post-fix re-runs
F0–F5). Earlier verdicts (§1–§5) are **not** rewritten; this section judges
only whether N1–N5 are closed, by my own runs.

**Method — my own runs, not trust.** Fresh disposable copy
`/tmp/item6-closeout/` (read-only `scp` of `.env`, `paper-settings.js`,
`paper-strategy.js`, `env-config.js` from `sunteak@100.99.178.98:/home/sunteak/apps/warlock-v2/`,
same method as `NEGATIVE-TEST.md` §1). The `scp` completed in **~11 s total —
no hang** (contrast the coordinator's re-run attempt, whose `scp` hung and was
killed after ~35 min; the tunnel works now, the hang was transient, not a
standing block). Harness extracted **verbatim from the revised `PROCEDURE.md`
Appendix A** by script (4,239 bytes, contains section D + `readline`); the
stale `/tmp/item6-negtest/check-pin.js` (3,021 bytes, zero matches for
"section D" / "pin-presence" / "readline") was **not** used. Expected pin:
the E-config table from `NEGATIVE-TEST.md` §1 (20 settings-layer keys +
`PAPER_USDC=0`). No VPS write; no key values recorded anywhere (key names
only, as in §5).

### Re-run results (all in `review-runs/`, files `08`–`14` — earlier files untouched)

| # | Case | Change (disposable copy only) | Exit | Result |
|---|---|---|---|---|
| C0 | Positive control (pristine `.env`) | none | **0** | 21/21 fields OK (A 20 + B 1 + D 21 present = 42 OK lines); section C line **byte-identical to live line 3039** (diff vs `DEMO-EVIDENCE.md` §4 clean) |
| C1 | Builder's negative test | `MIN_FT` 0.6→1.0 | **1** | `FAIL MIN_FT: effective=1 expected=0.6` |
| C2 | Reviewer A4 (was exit 0) | delete `MIN_FT=` line | **1** | Section A still passes it (`effective=0.6` — code-default fallback, proving D is what catches it); section D: `FAIL MIN_FT: MISSING — no ^KEY= line in .env; pin key absent` |
| C3 | Reviewer A5 (was exit 0) | delete `EMERGENCY_DROP=` line | **1** | Section D: `FAIL EMERGENCY_DROP: MISSING — no ^KEY= line in .env; pin key absent` |
| C4 | Reviewer A1 (regression) | `RESHAPE_MAX` 5→7 | **1** | `FAIL RESHAPE_MAX: effective=7 expected=5` |
| C5 | Reviewer A3 (regression) | `MAX_PUMP24H_PCT` 200→50 | **1** | `FAIL MAX_PUMP24H_PCT: effective=50 expected=200`; section C still prints `pump24h=5` — the settings-line trap is intact, section A catches it |
| C6 | **Own adversarial B1** — delete `PAPER_USDC=` (the section B key) | delete `PAPER_USDC=` line | **1** | **Two** failures, both naming the field: section B `FAIL PAPER_USDC: .env=undefined expected=0` **and** section D `FAIL PAPER_USDC: MISSING`; `RESULT: MISMATCH — 2 field(s)` |

Builder's F0–F5 (`NEGATIVE-TEST.md` §5, `fix-runs/01`–`06`) are reproduced
exactly by C0–C5 above, including the exit codes and the named fields.

### Judgement on each note

| # | Judgement | Evidence (my own checks) |
|---|---|---|
| N1 | **CLOSED** | §3.1 now reads "differ in exactly **five** tokens" (`PROCEDURE.md:208`), listing the same five. |
| N2 | **CLOSED** | §4 expected output now says step 2 prints the "**25-key** pin" (3 mode + 21 strategy/sizing + `LP_SECRETS_DIR`) and states the "**21 fields total** in the harness: 20 settings-layer keys + `PAPER_USDC`" separately — the two numbers can no longer be confused. |
| N3 | **CLOSED** | Section D exists in the Appendix A harness and **is wired into the verdict**: I read the extracted harness — `fails++` in the section D loop (3 `fails++` total, one per section) and `process.exit(fails === 0 ? 0 : 1)`. Runs prove it live: C2/C3 exit 1 with the field named while section A still passes the deleted key. The §1 pin-presence rule is now enforced by the harness, not just the manual procedure. |
| N4 | **CLOSED as specified** (see residual R1 below) | (a) Line-scoped read verified in the extracted harness source: `.env` is streamed via `readline`/`createReadStream`, retaining only wanted `^KEY=` lines; the string `readFileSync` occurs **only** in a comment stating it is not used — no whole-file `readFileSync('.env')` remains. (b) Disposal rule present in §4 step 5 ("after the run, DELETE the disposable copy — or at minimum its `.env` — immediately") and in Appendix A. (c) Coordinator's earlier disposal **still holds**: `/tmp/item6-negtest/.env` and `.env.pristine` are still gone (directory holds only `check-pin.js` + settings files, no `.env`); `/tmp/item6-fix/` and `/tmp/item6-verify/` still absent. My own copy `/tmp/item6-closeout/` was deleted immediately after the runs, verified gone. |
| N5 | **CLOSED** | `MIN_VOL24H_TVL_X` **2.5** recorded in §2A defaults-in-force (with the `git diff` vs `6c3ae78` evidence and the consequence stated: "the README first-start build ran with the 2.5× vol/TVL gate **ON** (filtering thin tokens), not off and not 0") and in §6.2. Source claim verified by me in the fresh copy: `paper-settings.js` DEFAULTS **line 66** reads `MIN_VOL24H_TVL_X: 2.5`. (The `git diff` itself is cited evidence from the original review + builder re-run; the fresh copy carries no `.git`, so the line-66 read is my direct verification.) |
| N6 | **Acceptance confirmed** | §2B source line notes the `GAS_BUFFER_SOL` / `MAX_POSITION_TVL_PCT` carry-over from the README pin (also in the revision note). Present as recorded. |
| N7 | **Acceptance confirmed** | §4 step 5 points at the ssh method (`DEMO-EVIDENCE.md` §0) and the read-only scp (`NEGATIVE-TEST.md` §1). Present as recorded. |
| N8 | **Acceptance confirmed** | No change, as recorded (cosmetic drift only); revision note says so. |

### Residual R1 — one retained key-bearing `.env` under `/tmp` (new finding)

The close-out `/tmp` check found **one `.env` still retained**:
`/tmp/item6-verify2/.env` — 1,342 bytes (the same size as the VPS `.env`),
51 lines, mode 600, mtime 16:56 UTC (17:56 CET). Key **names** only (no values
read or recorded): it carries the live API keys (`HELIUS_API_KEY`,
`JUPITER_API_KEY`, Telegram IDs/username, RPC URL, Mini App host/port) — i.e.
it is a key-bearing copy of the same file N4 was about. It is **not** covered
by the `NEGATIVE-TEST.md` §5 disposal confirmations, which list
`/tmp/item6-fix/`, `/tmp/item6-negtest/.env` + `.env.pristine`, and
`/tmp/item6-verify/` — "verify2" is a different directory, created 17:56 CET
during the fix round, and its owner is not established in the record. I did
**not** delete it: it is not my copy and deleting another agent's file on my
own authority could destroy evidence. This is the one respect in which the
disposal rule's intent ("no `.env` retained under `/tmp`") is not yet met.

### Final line

**Item 6 is NOT DONE — narrowly, on one housekeeping item.** N1–N5 are all
verified **CLOSED** by my own re-runs and read-backs, N6–N8 acceptances are
confirmed present, the harness now passes a right pin and catches wrong and
missing pins (including my own section-B deletion), and the section-C line is
byte-identical to the live line 3039. What remains: **delete
`/tmp/item6-verify2/.env` (coordinator action — it is not my copy) and
re-check `/tmp` for `.env` files**. That single deletion + re-check is the
whole remaining close-out; nothing in the procedure, the pin tables, or the
harness needs further work.

*End of close-out re-review.*

### Coordinator addendum — residual R1 closed (2026-11-24 ~18:36 CET)

Coordinator action, as specified in §6: `/tmp/item6-verify2/.env` (1,342 bytes, mode 600, mtime 16:56 UTC / 17:56 CET) **deleted**; the now-empty `/tmp/item6-verify2/` directory (its `paper/` subdir held no files) also removed. Full `/tmp` re-scan by `find` for `.env` / `.env.*` / `*.env`: **zero matches**. No other `.env` under `/tmp`. The disposal rule's intent ("no `.env` retained under `/tmp`") is now met. All other close-out findings stand as §6 states (N1–N5 CLOSED by the reviewer's own re-runs C0–C6, N6–N8 acceptances confirmed present). **Item 6 is DONE.**
