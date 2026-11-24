
---

## 6. Close-out re-review (after the QC-N2/QC-N3 fix)

**Reviewer:** Independent Reviewer (same reviewer as §§1–5) · **Date:** 2026-11-24 ~17:52–18:00 CET
**Script under re-review:** `verify-patch.sh`, mode `755`, `sh -n` syntax OK, md5 **`f4b9ad17c60cc0fc455c3f330144f5de`** — confirmed by the reviewer's own `md5sum`, not taken from the builder's claim.
**Files read in full:** `TEST-EVIDENCE.md` §9, `ACCEPTANCES.md`, the fixed `verify-patch.sh` (callers check, lines ~128–172, read in full), `PROCEDURE.md` §6.2 and §2.1 step 4(c) plus a full grep-sweep of `PROCEDURE.md` for any other passage the fix touched.
**Method:** every key case re-run by the reviewer against the fixed script (outputs in `review-runs/closeout-*.stdout.txt` / `.stderr.txt` — new files, earlier `review-runs/` untouched); four new adversarial cases of the reviewer's own design (closeout-adv-E–H); frozen values read from the script constants, not from the builder's diff claim. No builder file, `TEST-EVIDENCE.md`, `ACCEPTANCES.md`, or track record was edited. No VPS writes.

### 6.1 Re-run results (reviewer's own runs, fixed script)

| # | Test | Command (reviewer) | Expected | Got | Result |
|---|---|---|---|---|---|
| closeout-R2 | v2 paper fixture | `./verify-patch.sh --v2 test-fixtures/v2-paper-tree` | exit 0 | **exit 0** — md5 `a1d2906597d4b3ab0e9a0be2e92644f6`, bps `50`, no callers | PASS |
| closeout-R3 | both trees | `./verify-patch.sh test-fixtures/v1-patched-tree test-fixtures/v2-paper-tree` | exit 0 | **exit 0** — all five checks PASS | PASS |
| closeout-R6 | v2 Ultra-wired (negative) | `./verify-patch.sh --v2 test-fixtures/v2-ultra-wired-tree` | exit 1, callers FAIL alone | **exit 1** — md5 + bps PASS, callers FAIL, `ultra-caller.js` lines quoted | PASS |
| closeout-adv-B | multi-line block comment (reviewer's original adv-B fixture, unchanged) | `./verify-patch.sh --v2 review-runs/adv-B` | exit 0 (was exit 1) | **exit 0** — `PATCH-GUARD PASS` | PASS — QC-N2 fix confirmed |
| closeout-adv-C | dynamic dispatch (reviewer's original adv-C fixture, unchanged) | `./verify-patch.sh --v2 review-runs/adv-C` | exit 0, disclosed limitation, NOT claimed fixed | **exit 0** — `PATCH-GUARD PASS` on a real caller, exactly as before | PASS — still a disclosed limitation (SEC-N2), not a regression, not a fix claim |
| closeout-mjs-caller | caller in `.mjs` | `./verify-patch.sh --v2 review-fix-runs/mjs-caller` | exit 1 | **exit 1** — callers FAIL, `ultra-caller.mjs` lines 2–3 quoted | PASS |
| closeout-cjs-caller | caller in `.cjs` | `./verify-patch.sh --v2 review-fix-runs/cjs-caller` | exit 1 | **exit 1** — callers FAIL, `ultra-caller.cjs` lines 2–3 quoted | PASS |
| closeout-ts-caller | caller in `.ts` (reviewer's extra — the builder only tested a clean `.ts`) | `./verify-patch.sh --v2 review-runs/closeout-ts-caller` | exit 1 | **exit 1** — callers FAIL, `ultra-caller.ts` lines 2–3 quoted | PASS |
| closeout-block-plus-caller | block comment + real caller after it | `./verify-patch.sh --v2 review-fix-runs/block-plus-caller` | exit 1, quoting caller lines only | **exit 1** — quotes lines 4–5 (real caller) only, NOT comment lines 1–3; line numbers preserved | PASS |
| closeout-ts-clean | clean `.ts` file | `./verify-patch.sh --v2 review-fix-runs/ts-clean` | exit 0 | **exit 0** | PASS |
| closeout-unclosed | unterminated `/*` | `./verify-patch.sh --v2 review-fix-runs/unclosed-comment` | exit 0 | **exit 0** | PASS |

Regression spot-checks against the original `test-runs/`: closeout-R1 stdout+stderr **byte-identical** to T1; closeout-R4 byte-identical to T4; closeout-R7 byte-identical to T7; closeout-R5 differs from T5 in **exactly one line** — the callers-check echo (`JS` → `JS/MJS/CJS/TS`); verdict and exit unchanged. Closeout-R2/R3/R6 outputs are byte-identical to the builder's `review-fix-runs/` equivalents. Fixture integrity after all runs: every `swap-route-config.js` in `test-fixtures/`, `review-runs/adv-*`, `review-runs/closeout-adv-*`, and `review-fix-runs/` still md5s to its pre-run value — the script modified nothing.

### 6.2 Frozen values — verified from the script constants

`verify-patch.sh` lines 27–30, read by the reviewer: `V1_EXPECTED_MD5="11fc46b9d9eb432e42678503452f5a29"`, `V1_EXPECTED_BPS="0"`, `V2_EXPECTED_MD5="a1d2906597d4b3ab0e9a0be2e92644f6"`, `V2_EXPECTED_BPS="50"`. Untouched — identical to the review-time values in §2 and to `PROCEDURE.md` §1. The only script changes are inside the callers check (plus the one cosmetic echo line), as `TEST-EVIDENCE.md` §9 claims.

### 6.3 Awk comment-strip logic — critical read + adversarial cases

The strip is a per-line `awk` pass with an `in_block` flag, emitting exactly one output line per input line (so `grep -n` numbers stay correct — confirmed empirically by block-plus-caller quoting lines 4–5). Read critically:

- **Same-line open + close** (`/* … */` on one line): handled — `/*` sets the flag, `*/` clears it, code after the close is copied. Proved by closeout-adv-E (below).
- **`//` inside a block comment:** handled — the `in_block` branch is checked first, so `//` inside a block is skipped as comment text, not treated as a line-comment start.
- **Block opened mid-line after code:** handled — code before `/*` is copied, the rest of the line is dropped.
- **Unterminated `/*`:** handled as documented — the rest of the file is treated as comment (closeout-unclosed, exit 0).
- **String literals: NOT tracked** (disclosed in `TEST-EVIDENCE.md` §9, "does not track string literals"). Two consequences, one in each direction, both demonstrated by the reviewer:

| # | Attack (reviewer's own) | Result | Reading |
|---|---|---|---|
| closeout-adv-E | Real caller on the **same line as a closing `*/`**: `/* note: ultraOrder … */ const { ultraOrder } = require(…); … ultraOrder(g,p)` | **exit 1** (FAIL) — caller lines 1–2 quoted | PASS. The strip correctly resumes code after a same-line close. |
| closeout-adv-F | `ultraOrder` inside a **string literal only**: `const label = "ultraOrder is the dormant path";` | **exit 1** (FAIL) — false positive | Fail-closed (safe direction). A string mention is not a caller; the strip counts it. Acceptable noise, same direction as the old adv-B; TEST-EVIDENCE §9 discloses the strip does not track strings. No note required beyond this record. |
| closeout-adv-G | Real caller **masked by `//` inside a string**: `const u = "https://example.com"; ultraOrder(null, {});` — the `//` in the URL makes the strip discard the rest of the line, including the caller | **exit 0 — PATCH-GUARD PASS on a real caller** | **Fail-open, new finding (see §6.4).** Note the old bare-grep script would have caught this (exit 1); the QC-N2 strip itself creates this evasion. Narrow and contrived as an attack, but the masking token (`//` in a URL string) is extremely common in real JS. |
| closeout-adv-H | Real caller **masked by `/*` inside a string**: `const marker = "/* start of a string…";` then a real `require` + call on the following lines, never closed | **exit 0 — PATCH-GUARD PASS on a real caller** | **Fail-open, same finding as adv-G.** The `/*` in the string opens block mode and the rest of the file is treated as comment. Same class, rarer shape than adv-G. |

### 6.4 Note judgements

| Note | Judgement | Reasons |
|---|---|---|
| **QC-N2** (multi-line block comment false positive) | **CLOSED** | adv-B now exits 0 (was 1); block-plus-caller discriminates correctly (quotes caller lines 4–5 only, not comment lines 1–3); unclosed `/*` exits 0; same-line open/close (adv-E) and `//`-inside-block (code-read: `in_block` branch first) behave correctly. The stateful strip does what §9 claims. |
| **QC-N3** (callers check scanned only `*.js`) | **CLOSED** | `.mjs` caller exit 1, `.cjs` caller exit 1, `.ts` caller exit 1 (reviewer's extra — the builder had only shown a clean `.ts`), clean `.ts` exit 0. The `find` alternation covers all four types and the test/spec exclusions are symmetric across all four. |
| **QC-N1** (bps extraction reads first integer after `=`) | **ACCEPTANCE: ACCEPTED** | Genuine acceptance, not a rubber stamp: Engineering Head restates the weakness in his own words, explains why the md5 (not the bps line) is the gate with the adv-A proof, considered and declined hardening with a stated reason (no verdict changes, new false-failure risk), and binds three conditions including a collapse clause if the md5 check is ever removed. No code change was required and none was made. |
| **SEC-N1** (frozen constants editable — procedural-only protection) | **ACCEPTANCE: ACCEPTED** | Genuine acceptance with a binding mitigation: record the script md5 in the track record at W-10 install, re-verify before **every** VPS run, any drift = blocker (guard not run, output not trusted, escalate to Engineering Head), re-establish only from the workspace master via a reviewed update. One precision point, verified by the reviewer: the acceptance does **not** quote the fixed md5 `f4b9ad17c60cc0fc455c3f330144f5de` by value — it explicitly disclaims the review-time `7cfd429105d7f8bb7aaebbfceed829b0` and binds the **install-time md5 of the fixed script as actually installed**. That is the correct formulation (a hard-coded value would go stale if the script changes again before install), and the value to record at W-10 — if the script is unchanged from the workspace copy the reviewer verified — is `f4b9ad17c60cc0fc455c3f330144f5de`. The mitigation is correctly stated. |
| **SEC-N2** (dynamic dispatch evades the callers check) | **ACCEPTANCE: ACCEPTED** | Genuine acceptance, co-signed by Engineering Head + Security Reviewer: own-words reasoning, accepts the adv-C demonstration at face value, states plainly there is no second automated backstop, makes the human line-by-line diff read mandatory on every update (never skipped on a clean grep) with the reader specifically looking for indirect/dynamic invocation, and records the AST-based check as out-of-scope future work with a re-open clause. adv-C still exits 0 on the fixed script — the fix claims no coverage it does not have. |
| **Close-out finding — string-literal comment-delimiter masking (adv-G / adv-H)** | **Recorded as a SEC-N2-class limitation; NOT a new fix requirement, NOT a DONE-blocker** | The strip's failure to track string literals (disclosed in `TEST-EVIDENCE.md` §9) has a fail-open direction the disclosure did not spell out: `//` or `/*` inside a string literal masks a real caller on the same line (adv-G) or to end of file (adv-H). This is the same class as SEC-N2 — a grep-heuristic evasion whose backstop is the human diff read — narrower and more contrived than adv-C, and fixing it needs string-aware (or AST) parsing, the same out-of-scope class SEC-N2 already defers. It is therefore folded under the accepted SEC-N2 limitation rather than opened as a fix item. Follow-up (non-blocking): at the next `PROCEDURE.md` touch, add "callers masked by comment delimiters inside string literals" to the human-read look-for list in §2.1 step 4 / SEC-N2 condition 2. |

### 6.5 PROCEDURE.md alignment verdict

- **§6.2 — ACCURATE and complete.** Now states the check searches all non-test `.js` / `.mjs` / `.cjs` / `.ts`, matching `\bultraOrder(Params)?\b`, then a stateful comment strip (tracks `/* … */` across lines, strips `//`) — exactly what the fixed script does. The dynamic-dispatch limitation statement is **still accurate and needs no change**: adv-C still exits 0 on the fixed script, and the statement correctly says a caller hidden behind dynamic dispatch "would not be caught by any grep" and the check is "a tripwire alongside the md5, not a proof".
- **§2.1 step 4(c) — ACCURATE and complete.** Now prescribes `grep --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts'` with the same exclusions as the script, and correctly describes the guard's stateful strip ("passes each candidate file through a stateful comment strip before judging… this grep is the first pass — a human judges whether each hit is a mention or a caller"). The scope matches the script.
- **Rest of PROCEDURE.md — one stale line found.** §3.1 (expected PASS output) still quotes the old echo line: `method: same as the 24 Nov v2 fee audit — grep all non-test JS in the tree)`. The fixed script prints `… grep all non-test JS/MJS/CJS/TS in the tree)`. This is the one other passage the fix touched and the coordinator's update missed. Impact is low — §3.1 is an illustrative transcript, and the operative checklist step PG-1 (§4) does not quote that line — but an operator comparing output verbatim would see a mismatch on a passing run. **Follow-up (non-blocking, one-line doc touch):** update the §3.1 quoted line to `JS/MJS/CJS/TS`. No guard change, no re-test needed beyond an eyeball. Nothing else in `PROCEDURE.md` needed changing and nothing else was found stale (frozen values §1, re-diff steps (a)/(b)/(d)/(e), §2.2, §5, §6 items 1/3/4/5 all verified unchanged-in-substance and consistent with the fixed script).

### 6.6 Final verdict

**Item 5 is DONE.** The §5 close-out conditions are both met: QC-N2 and QC-N3 are fixed and re-run by the reviewer (not trusted), and QC-N1, SEC-N1, SEC-N2 are formally accepted in writing by their owners with binding conditions. No defect was found that invalidates the guard's core function, and the fix claims no coverage it does not have (adv-C still exits 0, as disclosed).

**What remains (non-blocking follow-ups, none of which re-opens DONE):**
1. `PROCEDURE.md` §3.1 — one-line doc touch: quoted echo `grep all non-test JS in the tree` → `grep all non-test JS/MJS/CJS/TS in the tree`.
2. At the next `PROCEDURE.md` touch — add string-literal comment-delimiter masking (adv-G/adv-H) to the SEC-N2 human-read look-for list (§2.1 step 4).
3. At W-10 install (Phase 2, outside this item) — record the installed script's md5 in the track record and re-verify it before every VPS run, per the SEC-N1 mitigation; if the workspace copy is installed unchanged, that md5 is `f4b9ad17c60cc0fc455c3f330144f5de`.
