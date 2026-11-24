# baskarajati paper-window config — Warlock 2.0 (E-config)

Paper instance running on sole's VPS (`~/apps/warlock-v2`, service
`warlock-v2-paper.service`). Paper only: `PAPER=1`, `DRY_RUN=1`,
`LIVE_CONFIRMED=0`, `STOP` present, no key stored. Window runs to
**30 Nov 2026 21:52 CET**; judged in SOL.

Values verified against the VPS `.env` on 24 Nov 2026 (values only — the
`.env` file itself is never committed; it holds no secrets but is
instance-specific).

## Book

| Setting | Value |
|---|---|
| Book | 14 SOL (deposited 23 Nov 2026; 5 SOL, then 8 SOL, then 14 SOL by sole's decisions) |
| Capital asset | SOL (`CAPITAL_ASSET=SOL` — SOL opens spend capital directly, USDC-quoted pools skipped) |
| Position size | 2.0 SOL (`POSITION_SOL_OPEN=2.0`) |
| Max positions | 7 (`MAX_POSITIONS=7`) |
| Max hold | 12 h (`MAX_HOURS=12`) |

## Screen

| Setting | Value |
|---|---|
| Min fee/TVL 30m | 0.6% (`MIN_FT=0.6`) |
| Min pool age | 0.5 h (`MIN_AGE_H=0.5`) |
| Bin step | 80–400 (`MIN_BIN_STEP=80`, `MAX_BIN_STEP=400`) |
| Max pump 1h | 15% (`MAX_PUMP1H=0.15`) |
| Max pump 24h | 200% (`MAX_PUMP24H_PCT=200`) |
| Min vol24h / TVL | 0 — gate neutralised (`MIN_VOL24H_TVL_X=0`) |

## Exits

| Setting | Value |
|---|---|
| Take profit | 13% (`TP_USD_PCT=13`) |
| Emergency stop | −20% (`EMERGENCY_DROP=0.20`) |
| SL+ | arm +3%, lock +0.1% (`EMERGENCY_SLPLUS_ARM_PCT=3`, `EMERGENCY_SLPLUS_LOCK_PCT=0.1`) |
| Reshape cap | 5 per leg (`RESHAPE_MAX=5`) — freeze, not exit: once a position has reshaped 5 times it stays open and keeps earning fees; the −20% stop stays live. See the `RESHAPE_MAX` commit. |

## Notes

- This config is the full Book E system from Warlock v1 (Batch 1 arm E:
  freeze after 5 reshapes), mapped onto the v2 codebase with no divergence.
- `PAPER_USDC=0` — the book is SOL-denominated; there is no USDC book.
- Config is settings, not code: every number above is changeable without a
  rebuild. The code takes thresholds as parameters (see `paper-settings.js`
  `FIELDS`).
