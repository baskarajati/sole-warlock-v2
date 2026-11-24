# Item 5 — Patch-Guard: Formal Acceptance of Limitation Notes QC-N1, SEC-N1, SEC-N2

**Date:** 2026-11-24
**Decided by:** Engineering Head (owner of QC-N1 and SEC-N1) and Security Reviewer (co-owner of SEC-N2)
**Evidence read in full before deciding:** `REVIEW.md` §1 (adversarial cases adv-A and adv-C), §3 (Security countersign), §5 (notes table); `PROCEDURE.md` §5 (failure handling) and §6 (limitations); `SYSTEM-READINESS-PLAN-2026-11-24.md` §4.3 (Item 5 acceptance criteria). The reviewer's re-runs R1–R8 and the VPS re-check (§4 of REVIEW.md) were also read.
**Status of this document:** formal written acceptance of the three limitation notes below. It does **not** close Item 5 on its own. Per REVIEW.md §5 and the plan §4.3, Item 5 is NOT DONE until QC-N2 and QC-N3 are fixed and re-run (a separate builder task, not covered here) **and** these three notes are formally accepted — the second half of that condition is what this document supplies.

**Decisions at a glance**

| Note | Owner(s) | Decision |
|---|---|---|
| QC-N1 | Engineering Head | **ACCEPTED** |
| SEC-N1 | Engineering Head | **ACCEPTED** (residual procedural reliance accepted, with the md5-mitigation commitment in §SEC-N1 below) |
| SEC-N2 | Engineering Head + Security Reviewer | **ACCEPTED** (as a disclosed limitation, with the human diff-read backstop mandatory) |

No note was refused. No code change is required by any acceptance in this document.

---

## QC-N1

**Owner:** Engineering Head

**Note as written in REVIEW.md §5:**

> bps extraction reads the first integer after `=`; an expression such as `0 + 50` passes the bps check alone (adv-A). The md5 is the real gate and it catches this, so the overall verdict stays correct — but the bps check must never be cited alone as proof of fee state.

**Decision: ACCEPTED**

**Reasoning (in my own words):** The bps check is a naive text read — it takes the first digits after the equals sign and has no idea whether those digits are a plain literal or the start of an arithmetic expression. So a file that says `0 + 50` will cheerfully report "bps 0, PASS" on that check alone, and the same blindness would apply to a later reassignment after an initial literal. That is a genuine weakness of the bps check taken by itself, and I am not pretending otherwise.

What saves the overall verdict is that the bps check never stands by itself. The md5 check is a fingerprint of the entire file, byte for byte: any expression, reassignment, or one-character edit produces a different file and therefore a different md5, and the script fails the run on that mismatch. The reviewer proved this rather than asserting it — adv-A's `0 + 50` file failed with exit 1 on the md5, even though its bps line passed. So the failure mode the note describes cannot produce a false overall PASS; it can only produce a misleading single line inside a failing run, and the run's verdict is what gates a deploy, not any one line.

I considered requiring the extraction to be hardened (for example, an anchored pattern that only accepts a bare numeric literal and rejects anything else on the line). I am not requiring it, because it would change no verdict: the md5 already decides every case the hardening would catch, and adding parsing cleverness to a 201-line tripwire risks new false failures without buying any additional safety. The bps check's proper role is diagnostic — it tells the operator *what* the fee value looks like when the md5 has already said the file is not the frozen one — and I accept it on exactly that footing.

**Conditions of this acceptance (binding):**

1. The md5 is the gate; the bps check is diagnostic only. This is recorded in the track record.
2. The bps value must never be cited alone — in a build record, a rehearsal record, or a report to sole — as proof of fee state. A fee-state claim must cite the md5 match (and the run's overall exit 0).
3. This acceptance collapses if the md5 check is ever removed, disabled, or bypassed: on its own, the bps check is not a gate, and any future design that drops the md5 must re-open QC-N1.

---

## SEC-N1

**Owner:** Engineering Head

**Note as written in REVIEW.md §5:**

> Editing the frozen constants in `verify-patch.sh` to match a tampered file is not technically prevented — the no-ad-hoc-edit rule is procedural only.

**Decision: ACCEPTED** — the residual procedural reliance is accepted in writing, **with** the mitigation commitment below. The mitigation is part of the acceptance, not an optional extra.

**Reasoning (in my own words):** Nothing in the script defends itself. Whoever can write to `verify-patch.sh` can change the four frozen constants at the top to match whatever file is actually deployed, and the script will then report PASS on a file it was built to reject. There is no signature on the script, no second copy of the expected values held elsewhere for it to cross-check against, and no permission trick that fixes this — the operator who runs the guard needs read access to it, and on this setup read and write travel together. The rule in PROCEDURE.md §5 ("never edit the expected values to make it pass") is a rule people follow, not a lock the machine enforces, and I accept it as such rather than describing it as something stronger.

I am accepting that residual reliance rather than requiring a technical control (signing, a separate expected-values store, a read-only install) because, for a two-person operation at this stage, the available technical controls only move the trust one step sideways — someone still has to hold the key or the second store, and that holder is again a person following a procedure. What the proposed mitigation does, and what makes it worth adopting, is turn a *silent* edit into a *detectable* one: an attacker or a careless operator who edits the installed script leaves a fingerprint mismatch against a record kept off the VPS, and the mismatch is checked before the guard is trusted. Detection before use is the right level of control for a build-step tripwire; prevention by cryptography would be disproportionate here and would delay the track for no verdict-changing gain.

One point of precision matters: the md5 quoted in the review (`7cfd429105d7f8bb7aaebbfceed829b0`) is the md5 of the script **as reviewed**, before the QC-N2/QC-N3 fixes. Those fixes will change the script and therefore its md5. The review-time value must **not** be treated as the value to check against after the fixes. The mitigation below therefore references the md5 **at W-10 install time**, of the fixed script as actually installed.

**Mitigation commitment (exact):**

- **Where the script md5 is recorded:** in the track record, `~/workspace/warlock-division/live-readiness/TRACK-RECORD-2026-11-24.md`, in the Item 5 entry, at W-10 install time — and nowhere else as the authoritative copy. The entry records four things together: (i) the md5 of the installed copy at `~/sol-lp-bot-live-rehearsal/scripts/verify-patch.sh`, (ii) the install date, (iii) who installed it, and (iv) that the installed script is the post-QC-N2/QC-N3 fixed version (i.e. the md5 recorded is the fixed script's md5, not the review-time `7cfd429105d7f8bb7aaebbfceed829b0`). The per-run build/rehearsal record also carries the md5 observed on that run, but the track-record entry is the reference value all runs are compared against. (I do not edit the track record myself; the track coordinator records this entry at W-10 install.)
- **When it is re-verified:** before **every** VPS run of the guard — at build, at the R-5 rehearsal drill, at go-live, and after every upstream update — the operator first runs `md5sum ~/sol-lp-bot-live-rehearsal/scripts/verify-patch.sh` (or the equivalent installed path at go-live build) and compares the result with the track-record value **before** invoking the script. The observed md5 and the comparison result are written into that run's build/rehearsal record alongside the guard output.
- **What drift triggers:** any mismatch between the installed script's md5 and the track-record value is a **blocker**. The guard must not be run, its output must not be trusted, and the build/deploy/start must not proceed. It is treated as a FAIL of the guard under PROCEDURE.md §5: stop, preserve the evidence (the observed md5, the recorded md5, the file), and escalate to the Engineering Head. The script is re-established only from the workspace master copy and only through a reviewed patch-guard update (re-diff under PROCEDURE.md §2.1 step 5, QC-verified, Security-countersigned) — never by editing the installed copy in place to make the numbers agree. A legitimate change to the script (such as the QC-N2/QC-N3 fixes) updates the track-record md5 only as part of that reviewed update, with the new md5, date, and reason recorded in the same entry.
- **Honest limit of this mitigation:** it detects tampering of the installed copy against an off-VPS record; it does not prevent tampering, and it depends on the operator actually performing the pre-run check and on the track record itself not being altered. That is the residual procedural reliance being accepted here, stated plainly.

---

## SEC-N2

**Owners:** Engineering Head + Security Reviewer

**Note as written in REVIEW.md §5:**

> Dynamic dispatch (`m["ultra"+"Order"]`, `eval`, computed `require`) evades the Ultra callers check entirely — **demonstrated: adv-C exits 0 on a real caller**. Disclosed in `PROCEDURE.md` §6.2; the re-diff greps in §2.1 step 4(c)/(d) do not close it either.

**Decision: ACCEPTED** — as a disclosed limitation, with the human line-by-line diff-read backstop mandatory (see conditions below).

**Reasoning (in my own words):** The callers check works by searching the tree for the literal text `ultraOrder`. Dynamic dispatch defeats that by construction: the name is assembled at runtime from pieces (`"ultra" + "Order"`), or reached through `eval`, or loaded via a computed `require`, so the literal string never appears in the source for any grep to find. This is not a bug in one pattern that a better pattern would fix — it is a property of text search against code that can build names dynamically. Extending the grep to more spellings would only chase the next variant. The reviewer demonstrated the hole empirically rather than theorising about it: adv-C put a genuine Ultra caller into a v2 tree via `m["ultra" + "Order"]`, and the guard exited 0. I accept that demonstration at face value.

Two things make this different from QC-N1, and I want them on the record. First, there is no second automated check that backstops this one: the config file itself is untouched by a dynamic-dispatch caller, so the md5 and bps checks pass legitimately and tell us nothing about it. Second, the re-diff greps in PROCEDURE.md §2.1 steps 4(c) and 4(d) are the same kind of text search, so they have the same blind spot and do not close the hole either. The only backstop is a person reading the new tree. That is a weaker backstop than a second automated check, and it is fallible in the way human reading is fallible — but it is a real backstop if it is actually performed, because a dynamic-dispatch caller is visible to a reader going through the changed code line by line, in a way it is not visible to grep. I am accepting the limitation on that basis, honestly and without claiming the check proves dormancy.

I am not requiring a different mitigation (for example, an AST-based static analysis that resolves computed property accesses) because no grep can fix this and an AST check is a new tool, not a tweak — it is out of scope for this item, as the review states, and building it now would delay a guard whose common-case value (catching a plainly wired-in Ultra path, as R6 demonstrates) is already proven. The right place to revisit it is a future item if and when the Ultra path becomes a live concern; it is recorded here as future work, not as a commitment of this item.

**Conditions of this acceptance (binding):**

1. The Ultra callers check is a **tripwire for the common case** (a plain `require`/call added by an upstream update), not a proof that the dormant Ultra path is unwired. It must never be described as such a proof.
2. The backstop is the **human line-by-line diff read in PROCEDURE.md §2.1 step 4**, and that read is **mandatory** on every upstream update, reinstall, or fresh clone — it must not be skipped on a clean grep. "Clean grep, no diff read" is not a CLEAR verdict. The read must answer questions (a)–(e) in writing, and the reader must specifically look for indirect/dynamic invocation (computed property access, `eval`, computed `require`, string-concatenated names) in the changed hunks, not only for the literal `ultraOrder`.
3. A guard PASS on a known, unchanged tree remains valid — the risk this note covers arises at update time, when new code enters the tree, which is exactly when the §2.1 re-diff (including the mandatory human read) is required before any deploy.
4. A future AST-based check is out of scope for Item 5. If one is built later, SEC-N2 is re-opened and re-decided against it; until then, this acceptance stands as the recorded position.

---

## What this acceptance does not do

- It does not mark Item 5 DONE. QC-N2 (multi-line block-comment false positive) and QC-N3 (`.mjs`/`.cjs`/`.ts` scan coverage) remain to be fixed and re-run by the builder before DONE, per REVIEW.md §5.
- It does not change any frozen value, any script, or PROCEDURE.md. No builder file was edited in producing this document.
- It does not authorise any VPS write, any live money, or any go-live step. The W-10 install and its md5 recording happen only under the track's already-approved write table, at Phase 2.
