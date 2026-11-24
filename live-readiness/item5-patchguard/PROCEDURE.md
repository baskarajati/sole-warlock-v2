# Item 5 — Patch-Guard: Re-Diff Procedure + Live-Build Checklist Step

**Track:** Warlock live system-readiness, Item 5 (§4 of
`SYSTEM-READINESS-PLAN-2026-11-24.md`) · **Date:** 2026-11-24
**Build:** Engineering Builder · **Status:** built, self-tested on this VM —
no QC verdict, no Security verdict (those come from the independent reviewer).
**Script:** `verify-patch.sh` in this directory (mode 755 when installed).
**Install target (W-10, Phase 2, not this item):**
`~/sol-lp-bot-live-rehearsal/scripts/verify-patch.sh`, mode `755`.
At go-live build (outside this track) the same script is installed in the
real live instance directory.

> **Rule of this document:** the patch-guard is a *build* step, not a
> monitoring note. A FAIL blocks the build/deploy/start. Nothing in this
> procedure authorises editing the expected values to make a failing check
> pass — that would defeat the guard. See §5.

## 1. Frozen references

These are the only values the guard accepts. They change only by a reviewed
patch-guard update (re-diff under §2, QC-verified, Security-countersigned),
never ad hoc.

| Bot | File | Frozen md5 | `ROUTE_FEE_BPS` | Fee state |
|---|---|---|---|---|
| v1 | `swap-route-config.js` | `11fc46b9d9eb432e42678503452f5a29` | `0` | NO referral fee — only because of the local 13 Nov audit patch. Upstream v1 attached a hidden 0.5% Jupiter referral fee; the patch removed it. Any upstream update, reinstall, or fresh clone silently restores the 0.5% unless the patch is re-applied. Source: `LIVE-READINESS.md` §5.1; verified on the VPS 24 Nov 2026 (all four v1 instances identical). |
| v2 | `swap-route-config.js` | `11fc46b9d9eb432e42678503452f5a29` | `0` | NO referral fee. **Changed 24 Nov 2026 (owner decision):** the hidden 50 bps fee (owner `H7f8GiCgFGDnvqKmQgzL127tkn36CYZKLv3W79vd3qg9`, program `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`) was removed; v2 now ships the v1 fee-free file byte for byte. Paper quotes use the same constant, so v2 paper is also fee-free from this change. The old frozen value was md5 `a1d2906597d4b3ab0e9a0be2e92644f6` / `50`; the evidence below that cites it is historical. |

**Dormant second path (v2):** a Jupiter Ultra referral account
(`55i49BokJD63rq95zkyr8Dq2vN6iUnvCnEFgJg5HgCP4`, also 50 bps) is configured
in `swap-route-config.js` (`ultraOrderParams` / `ultraOrder`), but
`ultraOrder` / `ultraOrderParams` have **no callers** anywhere in the v2 tree
— dead code. It activates only if a future update wires the Ultra path in.
The guard checks for callers on every run.

**Frozen copies held with this item** (for the §2 re-diff baseline):
- `test-fixtures/v1-patched-swap-route-config.js` — byte-identical copy of the
  patched v1 file fetched read-only from the VPS instance-1 tree
  (`~/DLMM/audit/repo/sol-lp-bot/swap-route-config.js`, 24 Nov 2026 ~17:38 CET;
  md5 `11fc46b9d9eb432e42678503452f5a29`, 1,173 bytes).
- `test-fixtures/v2-paper-swap-route-config.js` — byte-identical copy of the
  v2 paper file fetched read-only from `~/apps/warlock-v2/swap-route-config.js`
  (24 Nov 2026 ~17:39 CET; md5 `a1d2906597d4b3ab0e9a0be2e92644f6`, 4,221 bytes).

## 2. Re-diff procedure — on every upstream update, before any deploy

Run this **before** deploying any upstream update, reinstall, or fresh clone
of either bot. It is the same method as the 24 Nov v2 fee audit (read-only;
no code or config modified by the audit itself).

### 2.1 Steps

1. **Freeze the current file first.** Copy the currently-deployed
   `swap-route-config.js` (v1 and/or v2, whichever is being updated) to the
   frozen-copy store with a dated name. Record its md5. This is the
   "before" side of the diff.
2. **Obtain the new upstream file.** Fetch the upstream
   `swap-route-config.js` into a disposable directory. Do not install it
   anywhere yet.
3. **Diff file-to-file.**
   ```sh
   diff -u <frozen-copy> <new-upstream-copy>
   md5sum <frozen-copy> <new-upstream-copy>
   ```
   An empty diff + matching md5 = no change; record that and proceed to
   step 6 (the guard script still runs at build — §3). Any diff at all
   goes to step 4.
4. **Read the diff line by line, with the fee questions.** For each changed
   hunk, answer in writing:
   - **(a) bps:** does `ROUTE_FEE_BPS` change? v1 must stay `0`; v2 must
     stay `50`. Any other value is a blocker until reviewed.
   - **(b) beneficiary:** decode every base64 constant in the new file
     (`base64 -d`) and compare with the frozen values (§1). A changed
     `SWAP_ROUTE_ACCOUNT`, `ULTRA_ROUTE_ACCOUNT`, or `ROUTE_PROGRAM` is a
     blocker until reviewed. Note the audit's warning: addresses are
     base64-obfuscated and the word "referral" is scrubbed from logs
     (`cleanMessage` rewrites it to "route"), so a beneficiary change is
     invisible in logs — only this decode catches it.
   - **(c) Ultra path:** run the callers check on the new tree (same scope
     as the guard script — `.js` / `.mjs` / `.cjs` / `.ts`, non-test files):
     ```sh
     grep -rn --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' \
       --exclude-dir=node_modules --exclude-dir=test --exclude-dir=tests \
       --exclude='*.test.*' --exclude='*.spec.*' \
       --exclude=swap-route-config.js -E '\bultraOrder(Params)?\b' <new-tree>/
     ```
     Any caller outside `swap-route-config.js` = the dormant Ultra path
     has been wired in = blocker until reviewed. (The guard script itself
     passes each candidate file through a stateful comment strip before
     judging, so a mere mention in a comment does not trip it; this grep is
     the first pass — a human judges whether each hit is a mention or a
     caller. Also look for a caller masked by a comment delimiter inside a
     string literal — `//` in a URL, or `/*` inside a string, makes the
     strip discard a real caller on the same line (adv-G) or to end of file
     (adv-H); only the human read catches those.)
   - **(d) fee-mechanism sweep** (audit §4 method): sweep the new tree for
     any *other* fee/diversion path —
     `platformFee|feeAccount|commission|referral|creatorFee|platform_fee`
     outside `swap-route-config.js`, `paper-route-fee.js`, and tests, and
     `SystemProgram.transfer` / raw `transfer(` outside Jupiter swaps and
     DLMM position operations. Any new hit is a blocker until reviewed.
   - **(e) fee-application behaviour:** does the new file create a referral
     token account to force the fee (the current code never does — it only
     charges when a valid account already exists), change the quote/body
     fee params, or change the `enabled` default on `swapQuote()`? Any
     change here is a blocker until reviewed.
5. **Verdict and record.** Write the re-diff record (date, upstream
   version/commit, diff output or "no diff", answers to (a)–(e), verdict)
   and file it with the track record in
   `~/workspace/warlock-division/live-readiness/`. Verdicts:
   - **CLEAR** — no diff, or diff reviewed and fee-relevant answers all
     unchanged: proceed to §3 (guard script at build).
   - **BLOCKED** — any of (a)–(e) changed adversely or unreadable: do NOT
     deploy. Escalate to the Engineering Head; a bps change, a beneficiary
     change, or the Ultra path being wired in is a blocker **until
     reviewed** — review may clear it (e.g. a disclosed, sole-approved fee
     change with the frozen values formally updated) or reject the update.
     The frozen md5/bps values in `verify-patch.sh` are updated only as
     part of that reviewed clearance, never to silence a FAIL.
6. **Re-apply the v1 patch if needed.** If the update restores the upstream
   v1 fee (the expected case on any v1 upstream pull), re-apply the 13 Nov
   patch to the new file, then re-run this procedure from step 3 on the
   patched file: its md5 must return to
   `11fc46b9d9eb432e42678503452f5a29` and `ROUTE_FEE_BPS` to `0` before the
   build proceeds.

### 2.2 What the md5 does and does not prove

The md5 is a file-identity check: it catches *any* change to the file,
including a one-character bps edit or a swapped base64 beneficiary. It does
not by itself say *what* changed — that is what the re-diff (§2.1 steps
3–4) is for. Run both: the guard script at build (§3) is the tripwire; the
re-diff is the diagnosis. Neither replaces the other.

## 3. Running the guard script

The script reads files only (`md5sum`, `grep`, `find`); it changes nothing
itself. It needs `md5sum`, `grep`, `find`, `sed`, `awk` — standard on the
VPS and on this VM. POSIX `sh`; no bashisms, no network, no secrets.

```sh
# v1 tree only (rehearsal clone / live instance dir):
./verify-patch.sh ~/sol-lp-bot-live-rehearsal
# v2 tree only:
./verify-patch.sh --v2 ~/apps/warlock-v2
# both trees (positional: v1 first, v2 second):
./verify-patch.sh ~/sol-lp-bot-live-rehearsal ~/apps/warlock-v2
```

**When it runs:** at build, at rehearsal, at go-live, and after every
upstream update — before any deploy and before any first start. In the
rehearsal it is the R-5 drill (§4.3 of the plan): in a disposable copy of
the clone the unpatched upstream file is substituted, the md5 check must
fail before any trade, the patched file is restored, and the md5 must return
to `11fc46b9d9eb432e42678503452f5a29`.

### 3.1 Expected output — PASS (both trees)

```
== Warlock patch-guard: verify-patch.sh ==
   (read-only; changes nothing)
--- v1: <v1-tree>/swap-route-config.js ---
  md5: 11fc46b9d9eb432e42678503452f5a29 (expected 11fc46b9d9eb432e42678503452f5a29)
PASS: v1 md5 matches expected 11fc46b9d9eb432e42678503452f5a29
  bps line: const ROUTE_FEE_BPS=0;
  ROUTE_FEE_BPS: 0 (expected 0)
PASS: v1 ROUTE_FEE_BPS is 0
--- v2: <v2-tree>/swap-route-config.js ---
  md5: a1d2906597d4b3ab0e9a0be2e92644f6 (expected a1d2906597d4b3ab0e9a0be2e92644f6)
PASS: v2 md5 matches expected a1d2906597d4b3ab0e9a0be2e92644f6
  bps line: const ROUTE_FEE_BPS=50;
  ROUTE_FEE_BPS: 50 (expected 50)
PASS: v2 ROUTE_FEE_BPS is 50
--- v2: ultraOrder / ultraOrderParams callers check ---
  (dormant Ultra path must have NO callers outside swap-route-config.js;
   method: same as the 24 Nov v2 fee audit — grep all non-test JS/MJS/CJS/TS in the tree)
PASS: v2 ultraOrder has no callers outside swap-route-config.js (dormant Ultra path still unwired)
== verdict ==
PATCH-GUARD PASS: all requested checks passed.
```

Exit code `0`. Record the full output in the build record.

### 3.2 Expected output — FAIL (any mismatch)

Any failing check prints `FAIL: ...` with the got-vs-expected evidence,
ends with:

```
== verdict ==
PATCH-GUARD FAIL: GO-LIVE BLOCKER — do not start, deploy, or trade.
  Re-establish the frozen patch state and re-run until this script exits 0.
```

Exit code `1` (check failure) or `2` (usage error / no tree given). A
missing `swap-route-config.js` is also a FAIL (exit 1), not a skip.

## 4. Checklist step — live-build checklist (mandatory)

The following step is written into the live-build checklist, and the
go-live runbook (Item 7) picks it up verbatim. It is mandatory: the build
does not proceed past it on a FAIL.

> **Step PG-1 — Patch-guard (mandatory, before first start).**
> Run `./verify-patch.sh <v1-tree> [<v2-tree>]` from the build tooling
> (installed copy: `<instance>/scripts/verify-patch.sh`, mode `755`).
> **Expected output:** `PATCH-GUARD PASS: all requested checks passed.`
> with v1 md5 `11fc46b9d9eb432e42678503452f5a29` + `ROUTE_FEE_BPS: 0`, and
> (if v2 is in scope) v2 md5 `a1d2906597d4b3ab0e9a0be2e92644f6` +
> `ROUTE_FEE_BPS: 50` + `ultraOrder has no callers outside
> swap-route-config.js`. Exit code `0`.
> **On any other output or any non-zero exit:** STOP. Go-live blocker.
> Do not start, deploy, or trade. Re-establish the frozen patch state
> (§2.1 step 6 for v1) or complete the §2 re-diff review, then re-run
> until the script exits `0`. Record the full output in the build record
> either way.

**Rehearsal drill R-5** (Item 2, Phase 2) executes this step twice: once
with the unpatched file substituted in a disposable copy (must FAIL before
any trade), once after restoring the patched file (must PASS with the md5
above). Both runs are recorded.

## 5. Failure handling — what a FAIL means and what it does not authorise

- **FAIL = blocker, not a warning.** No start, no deploy, no trade until
  the script exits `0` or a §2 re-diff review formally clears the change.
- **Never edit the expected values in the script to make it pass.** The
  frozen md5/bps constants change only through a reviewed patch-guard
  update (§2.1 step 5, QC-verified, Security-countersigned). Editing them
  ad hoc is tampering with the guard, not fixing the build.
- **Never delete or bypass the step** because a deadline is near. The
  failure mode this guard exists for — a silent 0.5% fee restored by a
  routine upstream pull — is exactly the kind of thing that happens under
  time pressure.
- **If the script itself is suspected** (e.g. it passes a file known to be
  unpatched), that is a FAIL of the guard, not a pass of the build: stop,
  preserve the evidence, and escalate. The negative tests in
  `TEST-EVIDENCE.md` exist so this can be checked at any time.

## 6. Limitations and assumptions (for the reviewer)

1. **Unpatched-v1 fixture is a reconstruction, not upstream bytes.** No
   byte-identical upstream `swap-route-config.js` exists in the workspace,
   so the negative-test file (`test-fixtures/v1-unpatched-tree/`) was
   reconstructed from the descriptions in `LIVE-READINESS.md` §5.1 and the
   v2 fee audit (50 bps + base64 referral accounts + "referral" scrubbed
   from logs). It proves the guard fails on a 50-bps fee-bearing file with
   a different md5; it does not prove anything about the exact upstream
   bytes. The positive test, by contrast, uses the real patched file
   fetched read-only from the VPS.
2. **Ultra callers check is a grep heuristic.** It searches all non-test
   `.js` / `.mjs` / `.cjs` / `.ts` outside `node_modules`, `test/` and
   `tests/`, and `swap-route-config.js`, matching
   `\bultraOrder(Params)?\b`, then passes each candidate file through a
   stateful comment strip (tracks `/* … */` block comments across lines,
   strips `//`) so a mere mention in a comment does not trip it (a real
   `require`/call survives the strip). A caller hidden behind dynamic
   dispatch (`require` of a computed string, `eval`) would not be caught
   by any grep — that is why the check is a tripwire alongside the md5,
   not a proof. The re-diff sweep (§2.1 step 4d) is the deeper check.
3. **The guard verifies the file, not the running process.** It proves the
   deployed file is the frozen one; it does not prove a running process
   loaded that file (a stale process could still run old code). Restart /
   process-identity checks belong to the rehearsal (Item 2), not this item.
4. **v2 "pass" here is about the fee file only.** It says nothing about
   the v2 settings pin (Item 6, C1) or any other v2 property.
5. **Script portability:** POSIX `sh` + coreutils; verified on this VM
   only. It has not yet been run on the VPS — that happens at W-10 install
   (Phase 2), where the same tests are re-run against the clone paths.
