#!/bin/sh
# verify-patch.sh — Warlock patch-guard (Item 5, System-Readiness Plan §4)
#
# Read-only verification that the swap-route-config.js fee patch state is
# exactly as expected, BEFORE any build / deploy / first start.
#   v1: md5 must be 11fc46b9d9eb432e42678503452f5a29 AND ROUTE_FEE_BPS must be 0
#       (13 Nov local audit patch removed the hidden 0.5% Jupiter referral fee)
#   v2: md5 must be a1d2906597d4b3ab0e9a0be2e92644f6 AND ROUTE_FEE_BPS must be 50
#       AND the dormant Jupiter Ultra path (ultraOrder / ultraOrderParams)
#       must still have no callers outside swap-route-config.js itself.
#
# Any mismatch = GO-LIVE BLOCKER. Exit non-zero, print the evidence.
# This script READS files only. It changes nothing itself.
#
# Usage:
#   verify-patch.sh <v1-tree-path> [v2-tree-path]
#   verify-patch.sh --v1 <v1-tree-path> [--v2 <v2-tree-path>]
#   verify-patch.sh --v2 <v2-tree-path>            (v2 only)
# A "tree path" is the bot source directory containing swap-route-config.js
# (e.g. ~/sol-lp-bot-live-rehearsal, ~/apps/warlock-v2).
# Exit 0 = every requested check passed. Exit 1 = a check FAILED (blocker).
# Exit 2 = usage error / unreadable input (also a blocker: do not proceed).
#
# Expected values — frozen. Change them ONLY by a reviewed patch-guard
# update (re-diff procedure, PROCEDURE.md §2), never by editing this file
# ad hoc to make a failing check pass.
V1_EXPECTED_MD5="11fc46b9d9eb432e42678503452f5a29"
V1_EXPECTED_BPS="0"
V2_EXPECTED_MD5="a1d2906597d4b3ab0e9a0be2e92644f6"
V2_EXPECTED_BPS="50"

FAIL=0

fail() {
    # $1 = message. Marks the run failed and prints the evidence line.
    echo "FAIL: $1"
    FAIL=1
}

pass() {
    # $1 = message.
    echo "PASS: $1"
}

# --- argument parsing -------------------------------------------------------
V1_TREE=""
V2_TREE=""
while [ $# -gt 0 ]; do
    case "$1" in
        --v1)
            [ $# -ge 2 ] || { echo "FAIL: --v1 needs a path argument" >&2; exit 2; }
            V1_TREE="$2"; shift 2 ;;
        --v2)
            [ $# -ge 2 ] || { echo "FAIL: --v2 needs a path argument" >&2; exit 2; }
            V2_TREE="$2"; shift 2 ;;
        --help|-h)
            sed -n '2,28p' "$0"; exit 0 ;;
        --*)
            echo "FAIL: unknown option: $1" >&2; exit 2 ;;
        *)
            if [ -z "$V1_TREE" ]; then V1_TREE="$1";
            elif [ -z "$V2_TREE" ]; then V2_TREE="$1";
            else echo "FAIL: unexpected extra argument: $1" >&2; exit 2; fi
            shift ;;
    esac
done

if [ -z "$V1_TREE" ] && [ -z "$V2_TREE" ]; then
    echo "Usage: $0 <v1-tree-path> [v2-tree-path] | $0 --v1 <path> [--v2 <path>] | $0 --v2 <path>" >&2
    echo "FAIL: no tree path given — nothing was verified, do not proceed" >&2
    exit 2
fi

echo "== Warlock patch-guard: verify-patch.sh =="
echo "   (read-only; changes nothing)"

# --- shared per-file checks -------------------------------------------------
# check_file <label> <tree> <expected-md5> <expected-bps>
check_file() {
    _label="$1"; _tree="$2"; _exp_md5="$3"; _exp_bps="$4"
    _file="$_tree/swap-route-config.js"
    echo "--- $_label: $_file ---"
    if [ ! -f "$_file" ]; then
        fail "$_label: swap-route-config.js NOT FOUND at $_file"
        return
    fi
    if [ ! -r "$_file" ]; then
        fail "$_label: swap-route-config.js NOT READABLE at $_file"
        return
    fi
    _md5=$(md5sum "$_file" 2>/dev/null | awk '{print $1}')
    if [ -z "$_md5" ]; then
        fail "$_label: md5sum produced no output for $_file"
        return
    fi
    echo "  md5: $_md5 (expected $_exp_md5)"
    if [ "$_md5" = "$_exp_md5" ]; then
        pass "$_label md5 matches expected $_exp_md5"
    else
        fail "$_label md5 MISMATCH: got $_md5, expected $_exp_md5 — file is NOT the frozen version (upstream update / reinstall / unpatched file?)"
    fi
    _bps_line=$(grep -E 'ROUTE_FEE_BPS[[:space:]]*=' "$_file" | grep -E '(const|let|var)[[:space:]]+ROUTE_FEE_BPS' | head -n 1)
    if [ -z "$_bps_line" ]; then
        fail "$_label: no ROUTE_FEE_BPS assignment found in $_file"
    else
        echo "  bps line: $_bps_line"
        _bps=$(printf '%s' "$_bps_line" | sed -E 's/.*ROUTE_FEE_BPS[[:space:]]*=[[:space:]]*([0-9]+).*/\1/')
        echo "  ROUTE_FEE_BPS: $_bps (expected $_exp_bps)"
        if [ "$_bps" = "$_exp_bps" ]; then
            pass "$_label ROUTE_FEE_BPS is $_exp_bps"
        else
            fail "$_label ROUTE_FEE_BPS MISMATCH: got $_bps, expected $_exp_bps"
        fi
    fi
}

# --- v1 ----------------------------------------------------------------------
if [ -n "$V1_TREE" ]; then
    check_file "v1" "$V1_TREE" "$V1_EXPECTED_MD5" "$V1_EXPECTED_BPS"
fi

# --- v2 ----------------------------------------------------------------------
if [ -n "$V2_TREE" ]; then
    check_file "v2" "$V2_TREE" "$V2_EXPECTED_MD5" "$V2_EXPECTED_BPS"
    _v2file="$V2_TREE/swap-route-config.js"
    if [ -f "$_v2file" ]; then
        echo "--- v2: ultraOrder / ultraOrderParams callers check ---"
        echo "  (dormant Ultra path must have NO callers outside swap-route-config.js;"
        echo "   method: same as the 24 Nov v2 fee audit — grep all non-test JS/MJS/CJS/TS in the tree)"
        # Search every .js/.mjs/.cjs/.ts file except node_modules, test/spec
        # files, and the definition file itself. Any hit = the Ultra path
        # has been wired in.
        # Heuristic, documented: a bare grep also matches a *mention* of the
        # name in a comment. A comment mention is not a caller, so each
        # candidate file is passed through a comment strip before the
        # verdict. The strip is stateful across lines: it tracks /* ... */
        # block comments that span multiple lines (a mention on a middle
        # line of a block comment is a comment, not a caller — QC-N2 fix),
        # and it still strips single-line // comments. One input line
        # produces exactly one output line, so grep -n line numbers stay
        # correct. A real call, require/import, or string use survives the
        # strip. The frozen md5 above still guards swap-route-config.js
        # itself; this check is the tripwire for the rest of the tree.
        # Any surviving hit is printed verbatim as evidence.
        _caller_files=$(find "$V2_TREE" -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.ts' \) \
            -not -path '*/node_modules/*' \
            -not -path '*/test/*' -not -path '*/tests/*' \
            -not -name '*.test.js' -not -name '*.spec.js' \
            -not -name '*.test.mjs' -not -name '*.spec.mjs' \
            -not -name '*.test.cjs' -not -name '*.spec.cjs' \
            -not -name '*.test.ts' -not -name '*.spec.ts' \
            -not -name 'swap-route-config.js' \
            -exec grep -l -E '\bultraOrder(Params)?\b' {} + 2>/dev/null)
        _code_hits=""
        for _f in $_caller_files; do
            _hits=$(awk '
                BEGIN { in_block = 0 }
                {
                    out = ""
                    i = 1
                    n = length($0)
                    while (i <= n) {
                        if (in_block) {
                            if (substr($0, i, 2) == "*/") { in_block = 0; i += 2 }
                            else { i++ }
                        } else if (substr($0, i, 2) == "//") {
                            break
                        } else if (substr($0, i, 2) == "/*") {
                            in_block = 1; i += 2
                        } else {
                            out = out substr($0, i, 1); i++
                        }
                    }
                    print out
                }
            ' "$_f" 2>/dev/null \
                | grep -n -E '\bultraOrder(Params)?\b' || true)
            if [ -n "$_hits" ]; then
                _code_hits="$_code_hits$_f:
$_hits
"
            fi
        done
        if [ -z "$_code_hits" ]; then
            pass "v2 ultraOrder has no callers outside swap-route-config.js (dormant Ultra path still unwired)"
        else
            echo "  code references found outside swap-route-config.js:"
            printf '%s\n' "$_code_hits" | sed 's/^/    /'
            fail "v2 ultraOrder/ultraOrderParams HAS CALLERS outside swap-route-config.js — dormant Ultra path has been wired in"
        fi
    fi
fi

# --- verdict -----------------------------------------------------------------
echo "== verdict =="
if [ "$FAIL" -eq 0 ]; then
    echo "PATCH-GUARD PASS: all requested checks passed."
    exit 0
else
    echo "PATCH-GUARD FAIL: GO-LIVE BLOCKER — do not start, deploy, or trade."
    echo "  Re-establish the frozen patch state and re-run until this script exits 0."
    exit 1
fi
