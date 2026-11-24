# Item 5 — Patch-Guard: Test Evidence

**Date:** 2026-11-24 (~17:38–17:40 CET) · **Built by:** Engineering Builder
**Scope:** build evidence only. No QC verdict, no Security verdict — those
come from the independent reviewer.
**No VPS writes were made for this item.** All VPS access was read-only SSH
(`ls`, `md5sum`, `grep`, `cat`) via the prescribed method:
`ssh -o StrictHostKeyChecking=accept-new -o ProxyCommand='python3
~/workspace/oversight-division/ssh-via-tunnel.py %h %p'
sunteak@100.99.178.98 '<read-only command>'`. SSH worked first time; no
Tailscale re-approval was needed.
**Script under test:** `verify-patch.sh` (mode 755 in this directory;
md5 `7cfd429105d7f8bb7aaebbfceed829b0` at time of testing).
Full per-run stdout/stderr are preserved in `test-runs/T*.stdout.txt` /
`T*.stderr.txt` in this directory.

## 1. Results summary

| # | Test | Input | Expected | Got | Verdict |
|---|---|---|---|---|---|
| T1 | v1 patched copy | `test-fixtures/v1-patched-tree/` (real patched file from VPS) | exit 0, md5 + bps 0 PASS | exit 0; md5 `11fc46b9d9eb432e42678503452f5a29`, `ROUTE_FEE_BPS: 0` | **PASS** |
| T2 | v2 paper copy | `test-fixtures/v2-paper-tree/` (byte-identical v2 file from VPS + stub `bot.js` + comment-only file) | exit 0, md5 + bps 50 + no Ultra callers | exit 0; md5 `a1d2906597d4b3ab0e9a0be2e92644f6`, `ROUTE_FEE_BPS: 50`, no callers | **PASS** |
| T3 | Both trees together | v1 patched + v2 paper trees | exit 0 | exit 0; all five checks PASS | **PASS** |
| T4 | v1 UNPATCHED (negative) | `test-fixtures/v1-unpatched-tree/` (reconstructed 50-bps file) | exit non-zero, md5 + bps FAIL | exit 1; md5 `0aab1a30e42e5f254366014ba3f3f54e` mismatch, `ROUTE_FEE_BPS: 50` mismatch | **PASS (fails as required)** |
| T5 | v2 bps tampered (negative) | v2 tree with `ROUTE_FEE_BPS=50` → `0` | exit non-zero | exit 1; md5 `85428f701e3e32cad9389418c02b5f0b` mismatch, bps `0` mismatch; callers check still PASS | **PASS (fails as required)** |
| T6 | v2 Ultra wired (negative) | v2 tree + `ultra-caller.js` requiring/calling `ultraOrder` | exit non-zero on callers check alone (md5 + bps still correct) | exit 1; md5 + bps PASS, callers FAIL with the two calling lines quoted as evidence | **PASS (fails as required)** |
| T7 | No arguments | `./verify-patch.sh` | exit 2, usage, nothing verified | exit 2; usage on stderr | **PASS** |
| T8 | Missing tree | non-existent path | exit non-zero, file-not-found FAIL | exit 1; `swap-route-config.js NOT FOUND` | **PASS** |

## 2. Patched-copy evidence (v1, read-only VPS fetch)

Fetched 24 Nov 2026 ~17:38 CET by read-only `cat` over the prescribed SSH
method from `~/DLMM/audit/repo/sol-lp-bot/swap-route-config.js`
(instance-1 tree). Stored as
`test-fixtures/v1-patched-swap-route-config.js` (1,173 bytes; fetch stderr
empty, `v1-fetch.stderr` 0 bytes).

VPS-side pre-check (same SSH method, before fetch):
```
-rw-r--r-- 1 sunteak sunteak 1173 Nov 13 22:07 /home/sunteak/DLMM/audit/repo/sol-lp-bot/swap-route-config.js
11fc46b9d9eb432e42678503452f5a29  /home/sunteak/DLMM/audit/repo/sol-lp-bot/swap-route-config.js
5:const ROUTE_FEE_BPS=0;
16:module.exports={cleanMessage,SWAP_ROUTE_ACCOUNT:null,ULTRA_ROUTE_ACCOUNT:null,ROUTE_FEE_BPS,feeCandidates,swapFeeParams,swapQuote,swapBodyParams,ultraOrderParams,ultraOrder};
```
Local md5 of the fetched copy: `11fc46b9d9eb432e42678503452f5a29` — identical
to the VPS-side md5 and to the frozen expected value. The fetched file's
content (first lines): `// PATCHED (local audit, 2026-11-13): the upstream
file attached a hidden 0.5% Jupiter referral fee ...` with
`const ROUTE_FEE_BPS=0;`, `feeCandidates(){return [];}`,
`swapFeeParams(){return {};}` — the patched shape described in
`LIVE-READINESS.md` §5.1.

T1 run (script against this copy) — exit 0, verbatim:
```
== Warlock patch-guard: verify-patch.sh ==
   (read-only; changes nothing)
--- v1: test-fixtures/v1-patched-tree/swap-route-config.js ---
  md5: 11fc46b9d9eb432e42678503452f5a29 (expected 11fc46b9d9eb432e42678503452f5a29)
PASS: v1 md5 matches expected 11fc46b9d9eb432e42678503452f5a29
  bps line: const ROUTE_FEE_BPS=0;
  ROUTE_FEE_BPS: 0 (expected 0)
PASS: v1 ROUTE_FEE_BPS is 0
== verdict ==
PATCH-GUARD PASS: all requested checks passed.
```

## 3. Unpatched-copy negative test (v1)

The unpatched fixture (`test-fixtures/v1-unpatched-reconstructed-swap-route-config.js`,
md5 `0aab1a30e42e5f254366014ba3f3f54e`) was **reconstructed**, not copied:
no byte-identical upstream file exists in the workspace. It was built from
the descriptions in `LIVE-READINESS.md` §5.1 and the v2 fee audit —
`ROUTE_FEE_BPS=50`, base64 referral accounts (same decoded beneficiaries as
the audit: `H7f8GiCgFGDnvqKmQgzL127tkn36CYZKLv3W79vd3qg9` etc.),
`swapFeeParams` returning the fee, and `cleanMessage` scrubbing "referral"
→ "route". Its header says so in the file itself. It proves the guard fails
on a 50-bps fee-bearing file; it proves nothing about exact upstream bytes.

T4 run — exit 1, verbatim:
```
--- v1: test-fixtures/v1-unpatched-tree/swap-route-config.js ---
  md5: 0aab1a30e42e5f254366014ba3f3f54e (expected 11fc46b9d9eb432e42678503452f5a29)
FAIL: v1 md5 MISMATCH: got 0aab1a30e42e5f254366014ba3f3f54e, expected 11fc46b9d9eb432e42678503452f5a29 — file is NOT the frozen version (upstream update / reinstall / unpatched file?)
  bps line: const ROUTE_FEE_BPS=50;
  ROUTE_FEE_BPS: 50 (expected 0)
FAIL: v1 ROUTE_FEE_BPS MISMATCH: got 50, expected 0
== verdict ==
PATCH-GUARD FAIL: GO-LIVE BLOCKER — do not start, deploy, or trade.
  Re-establish the frozen patch state and re-run until this script exits 0.
```
A check that passed on the unpatched file would have been a FAIL of the
guard — it did not pass. Both independent checks (md5 and bps) fired.

## 4. v2 read-only check (paper tree, VPS)

Run 24 Nov 2026 ~17:39 CET over the prescribed SSH method against
`~/apps/warlock-v2/` (md5sum/grep only, no writes). Verbatim output:
```
== v2 md5 ==
a1d2906597d4b3ab0e9a0be2e92644f6  /home/sunteak/apps/warlock-v2/swap-route-config.js
== v2 ROUTE_FEE_BPS ==
8:const ROUTE_FEE_BPS=50;
36:   if(a&&(a.owner.equals(TOKEN_PROGRAM_ID)||a.owner.equals(TOKEN_2022_PROGRAM_ID))&&data?.length>=165&&data[108]===1&&data.subarray(0,32).equals(rows[n].mint.toBuffer()))return {platformFeeBps:ROUTE_FEE_BPS,feeAccount:rows[n].address.toBase58()};
51:function ultraOrderParams(params={}){return {...params,[unpack('cmVmZXJyYWxBY2NvdW50')]:ULTRA_ROUTE_ACCOUNT,[unpack('cmVmZXJyYWxGZWU=')]:ROUTE_FEE_BPS};}
54:module.exports={cleanMessage,SWAP_ROUTE_ACCOUNT,ULTRA_ROUTE_ACCOUNT,ROUTE_FEE_BPS,feeCandidates,swapFeeParams,swapQuote,swapBodyParams,ultraOrderParams,ultraOrder};
== v2 ultraOrder callers (all non-test JS, excluding swap-route-config.js definition) ==
/home/sunteak/apps/warlock-v2/swap-route-config.js:51:function ultraOrderParams(params={}){...}
/home/sunteak/apps/warlock-v2/swap-route-config.js:52:async function ultraOrder(getJSON,params,options={}){...}
/home/sunteak/apps/warlock-v2/swap-route-config.js:54:module.exports={...ultraOrderParams,ultraOrder};
== v2 ultraOrder callers excluding definition file ==
(no callers outside swap-route-config.js)
== v2 file stat ==
-rw-r--r-- 1 sunteak sunteak 4221 Nov 22 17:54 /home/sunteak/apps/warlock-v2/swap-route-config.js
```
Result: md5 matches the frozen `a1d2906597d4b3ab0e9a0be2e92644f6`, bps is 50,
and `ultraOrder`/`ultraOrderParams` appear only in the definition file —
**the dormant Ultra path still has no callers**, exactly as the 24 Nov fee
audit found (file untouched since install, 22 Nov 17:54 CET).

The script itself was also run locally against a byte-identical copy of
that file (`test-fixtures/v2-paper-swap-route-config.js`, md5
`a1d2906597d4b3ab0e9a0be2e92644f6`, 4,221 bytes, fetch stderr empty) inside a
minimal fake tree (`test-fixtures/v2-paper-tree/`: the real config file + a
stub `bot.js` with no Ultra call + a comment-only file). T2 exit 0 (see §1).
Caveat, stated plainly: the local script run used the copied file, not the
live VPS tree — the script has not yet been executed on the VPS. That run
happens at W-10 install (Phase 2) against the clone paths.

## 5. Extra negative tests (v2 isolation)

- **T5 (bps tamper):** `ROUTE_FEE_BPS=50` → `0` in a copy of the v2 tree.
  Script exit 1; md5 and bps both FAIL; callers check still PASS. Shows the
  md5 and bps checks are independent of the callers check.
- **T6 (Ultra wired):** added `ultra-caller.js` requiring and calling
  `ultraOrder`. Script exit 1; md5 and bps PASS, callers check FAIL with
  the two calling lines quoted verbatim as evidence. Shows the callers
  check fires on its own even when the config file is untouched — this is
  the tripwire for a future update wiring the Ultra path in.

## 6. Defect found and fixed during testing (honest record)

The first full test run (before the fix) had T2/T3 **failing on the v2
paper tree**: my own stub `bot.js` contained the word `ultraOrder` in a
`//` comment, and the script's bare grep matched the comment as a caller.
That was a false positive in my fixture *and* a real script weakness —
a bare grep cannot tell a comment mention from a call, so any future
comment mentioning the name would have blocked a good build.

Fix applied and re-tested: the script now strips `//` and `/* */`
comments from matching lines before the verdict (a real `require`/call
survives the strip); the stub comment was also reworded. A
`comment-only.js` fixture (name in a comment only) was added to the v2
paper tree, and T2/T3/T5 now pass with it present while T6 (a real caller)
still fails. The fix is documented in the script's own comments and in
`PROCEDURE.md` §6.2. No test result in §1 comes from the pre-fix run; all
quoted results are from the post-fix re-run (files in `test-runs/`).

## 7. Fixture inventory

| Path | What it is | md5 |
|---|---|---|
| `test-fixtures/v1-patched-swap-route-config.js` | Real patched v1 file, read-only fetch from VPS instance-1 tree | `11fc46b9d9eb432e42678503452f5a29` |
| `test-fixtures/v1-patched-tree/swap-route-config.js` | Copy of the above, as a tree for the script | `11fc46b9d9eb432e42678503452f5a29` |
| `test-fixtures/v1-unpatched-reconstructed-swap-route-config.js` | Reconstructed unpatched v1 (50 bps + referral accounts); NOT upstream bytes | `0aab1a30e42e5f254366014ba3f3f54e` |
| `test-fixtures/v1-unpatched-tree/swap-route-config.js` | Copy of the above, as a tree for the script | `0aab1a30e42e5f254366014ba3f3f54e` |
| `test-fixtures/v2-paper-swap-route-config.js` | Real v2 paper file, read-only fetch from `~/apps/warlock-v2/` | `a1d2906597d4b3ab0e9a0be2e92644f6` |
| `test-fixtures/v2-paper-tree/` | Above file + stub `bot.js` + `comment-only.js` | (config as above) |
| `test-fixtures/v2-bps-tampered-tree/` | v2 paper tree with bps 50 → 0 | `85428f701e3e32cad9389418c02b5f0b` |
| `test-fixtures/v2-ultra-wired-tree/` | v2 paper tree + `ultra-caller.js` | `a1d2906597d4b3ab0e9a0be2e92644f6` |
| `test-runs/T1–T8.*.txt` | Full stdout/stderr of every test run in §1 | — |

## 8. What was NOT tested / NOT claimed

- The script has not been run on the VPS (no clone exists yet — W-10,
  Phase 2). VPS-side execution against the rehearsal clone paths is still
  to be done.
- No QC or Security verdict is claimed. The R-5 drill (unpatched
  substitution in a disposable clone copy) is an Item 2 rehearsal step,
  not part of this item.
- The v2 local script run used a byte-identical copied file in a minimal
  fake tree, not the full live v2 tree; the authoritative v2 evidence is
  the direct SSH md5/grep in §4.

## 9. Post-review fix record — QC-N2 + QC-N3 closed (2026-11-24 ~17:45–17:52 CET)

**Reviewer notes fixed:** QC-N2 (multi-line block comment false-positive,
adv-B) and QC-N3 (callers check scanned only `*.js`). QC-N1, SEC-N1, SEC-N2
were NOT touched — they are limitations for written acceptance by their
owners, per `REVIEW.md` §5. `REVIEW.md` and `PROCEDURE.md` were NOT edited.

**Script under test after the fix:** `verify-patch.sh`, mode 755,
md5 `f4b9ad17c60cc0fc455c3f330144f5de` (was
`7cfd429105d7f8bb7aaebbfceed829b0` at review time), `sh -n` syntax OK.
**Frozen values untouched** — verified by diff against the reviewed copy:
v1 md5 `11fc46b9d9eb432e42678503452f5a29` + bps `0`, v2 md5
`a1d2906597d4b3ab0e9a0be2e92644f6` + bps `50` are byte-identical to before.
No other part of the script changed.

### What changed in verify-patch.sh (callers check only, lines ~128–172)

- **QC-N2 — real multi-line comment strip.** The old per-line
  `sed 's#//.*##; s#/\*.*\*/##g'` only removed same-line comments, so a
  mention of `ultraOrder` on a middle line of a `/* … */` block survived
  and false-positived (adv-B, exit 1 on a clean tree). It is replaced by a
  stateful `awk` pass over each candidate file that tracks whether the
  scanner is inside a `/* … */` block across lines, strips `//` comments
  too, and emits exactly one output line per input line — so `grep -n`
  line numbers in the evidence stay correct. An unterminated `/*` treats
  the rest of the file as comment.
- **QC-N3 — wider file types.** The `find` now matches
  `*.js` **and** `*.mjs`, `*.cjs`, `*.ts` (grouped in one parenthesised
  `-o` alternation, so the existing `node_modules` / `test/` / `tests/` /
  `*.test.*` / `*.spec.*` / definition-file exclusions still apply to all
  four). Test/spec exclusions were extended symmetrically
  (`*.test.mjs`, `*.spec.mjs`, `*.test.cjs`, `*.spec.cjs`, `*.test.ts`,
  `*.spec.ts`). Only the callers-check echo line changed cosmetically
  ("grep all non-test JS" → "grep all non-test JS/MJS/CJS/TS").
- **What the strip does NOT do (unchanged limitation):** it does not track
  string literals, and it does not catch dynamic dispatch — see adv-C
  below. No new grep was added to chase adv-C.

### Post-fix re-run results

Full per-run stdout/stderr preserved in `review-fix-runs/` (same style as
`test-runs/`). Original T1–T8 results in §1 are NOT rewritten; these are
new runs against the fixed script.

| # | Test | Input | Expected | Got | Verdict |
|---|---|---|---|---|---|
| R2 | v2 paper fixture | `--v2 test-fixtures/v2-paper-tree` | exit 0 | exit 0; md5 + bps 50 PASS, no callers | **PASS** |
| R3 | both trees | v1 patched + v2 paper trees | exit 0 | exit 0; all five checks PASS | **PASS** |
| R6 | v2 Ultra-wired (negative) | `--v2 test-fixtures/v2-ultra-wired-tree` | exit 1 on callers alone | exit 1; md5 + bps PASS, callers FAIL quoting `ultra-caller.js` lines 2–3 verbatim | **PASS (fails as required)** |
| adv-B | multi-line block comment (reviewer's fixture, unchanged) | `--v2 review-runs/adv-B` | exit 0 (was exit 1) | **exit 0** — `PATCH-GUARD PASS`; the `block-comment.js` middle-line mention no longer trips the check | **PASS — QC-N2 FIXED** |
| adv-C | dynamic dispatch `m["ultra"+"Order"]` (reviewer's fixture, unchanged) | `--v2 review-runs/adv-C` | exit 0, disclosed limitation, NOT claimed fixed | **exit 0** — `PATCH-GUARD PASS` on a real caller, exactly as before the fix | **CONFIRMED — still a disclosed limitation (SEC-N2), NOT fixed** |
| NEW | caller in `.mjs` | `--v2 review-fix-runs/mjs-caller` (v2 paper tree + `ultra-caller.mjs` importing/calling `ultraOrder`) | exit 1 on callers alone | exit 1; md5 + bps PASS, callers FAIL quoting `ultra-caller.mjs` lines 2–3 verbatim | **PASS (fails as required) — QC-N3 FIXED for .mjs** |
| NEW | caller in `.cjs` (extra) | `--v2 review-fix-runs/cjs-caller` (v2 paper tree + `ultra-caller.cjs`) | exit 1 on callers alone | exit 1; md5 + bps PASS, callers FAIL quoting `ultra-caller.cjs` lines 2–3 verbatim | **PASS (fails as required) — QC-N3 FIXED for .cjs** |
| NEW | clean `.ts` file | `--v2 review-fix-runs/ts-clean` (v2 paper tree + `clean.ts`, no `ultraOrder` mention) | exit 0 | exit 0; `PATCH-GUARD PASS` | **PASS — .ts inclusion does not break a clean run** |
| NEW | block comment + real caller after it | `--v2 review-fix-runs/block-plus-caller` (comment mentioning `ultraOrder`, then a real `require` + call) | exit 1, quoting the caller lines only | exit 1; callers FAIL quoting lines 4–5 (the real caller), NOT the comment lines 1–3 — the strip discriminates correctly and line numbers are preserved | **PASS (fails as required)** |
| NEW | unterminated block comment | `--v2 review-fix-runs/unclosed-comment` (`/*` mentioning `ultraOrder`, never closed) | exit 0 | exit 0; `PATCH-GUARD PASS` | **PASS** |

### Regression sweep (R1/R4/R5/R7/R8, fixed script)

| # | Test | Got | Comparison with original T-run |
|---|---|---|---|
| R1 | v1 patched | exit 0 | stdout + stderr **byte-identical** to `test-runs/T1` |
| R4 | v1 unpatched | exit 1 (md5 + bps FAIL) | stdout + stderr **byte-identical** to `test-runs/T4` |
| R5 | v2 bps tampered | exit 1 (md5 + bps FAIL) | differs from `test-runs/T5` in **one line only** — the callers-check echo ("JS" → "JS/MJS/CJS/TS"); verdict and exit unchanged |
| R7 | no args | exit 2 | stdout + stderr **byte-identical** to `test-runs/T7` |
| R8 | missing tree | exit 1 (`NOT FOUND`) | differs from `test-runs/T8` only because a different nonexistent path was passed this time (`/nonexistent/tree` vs `/tmp/does-not-exist-tree-xyz` in T8); verdict and exit unchanged |

Fixture integrity after all post-fix runs: every `swap-route-config.js`
in `test-fixtures/`, `review-runs/adv-*`, and `review-fix-runs/` still md5s
to its pre-run value (v2 paper trees:
`a1d2906597d4b3ab0e9a0be2e92644f6`) — the script modified nothing.

### adv-C — stated plainly

The fix does **not** claim to close adv-C. The dynamic-dispatch caller
(`const fn = m["ultra" + "Order"]; fn(null, {})`) still passes the guard
with exit 0, exactly as it did before the fix, because the literal name
`ultraOrder` never appears in the file. No change in this fix accidentally
made adv-C fail. It remains the disclosed grep-heuristic limitation
(`PROCEDURE.md` §6.2, review note SEC-N2): the callers check is a tripwire
for plain wiring-in; the backstop is the human line-by-line diff read in
`PROCEDURE.md` §2.1 step 4.

### Flag for the coordinator (decision needed, not edited by the builder)

The fix makes two statements in `PROCEDURE.md` §6.2 stale, and §2.1 step
4(c) is now narrower than the script:
- §6.2 says the check "searches all non-test `.js`" — it now searches
  `.js` / `.mjs` / `.cjs` / `.ts`.
- §6.2 says comments are stripped "from matching lines" — the strip is
  now a stateful multi-line pass over each candidate file.
- §2.1 step 4(c) prescribes `grep --include='*.js'` for the re-diff
  callers check — the script's wider pattern is not reflected there.
`PROCEDURE.md` was deliberately left unedited (builder's instruction);
whether to update §6.2 / §2.1 step 4(c) to match the fixed script is for
the coordinator (and, at close-out, the reviewer) to decide. The
adv-C / dynamic-dispatch limitation statement in §6.2 is still accurate
and needs no change.

