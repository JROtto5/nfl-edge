# TD model recalibration, 2026-11-14

**Data.** Graded plays in `/api/td` history (the live API returns only the newest 200): 2026-10-24 to 11-14, 194 non-void (43-151, 6 void; CFB 104, NFL 90). The brief's 253 plays since 10/3 were NOT readable here (no blob token), so college-only Oct 3–23 plays are missing. "Market" = 1/decimal(FanDuel price) at logging time, vig included. Time split: train = plays dated Oct (n=66, near the "too few" line of 60), test = Nov (n=128). Nothing was tuned on test.

**Baseline (all 194).** model 36.4% avg, hit 22.2%, price implied 21.3%. +$15.0 on $970 (+1.5%). Edge 5–12 pts: n=85, 25-60, +$46.2; 12+ pts: n=109, 18-91, −$31.2. (Re-derived; same pattern as the 11/14 measurement.)

## 1. Shrink toward the market: p = m + k(model − m)
Log loss (lower = better), by k: train n=66 best at k=0 (0.406; model alone 0.532). Test n=128: k=0 .530, k=.2 .526, k=1 (raw) .571. A Platt fit with the market as input (ridge toward "trust the market") put ~0 weight on the model (coef −.12 to +.005 vs 1.1–1.3 on the market). Shipped k=0.25: the train optimum is 0, the test optimum ~0.2; 0.25 keeps a little model signal and is a judgment call, not a clean fit.

Calibration by model quintile (n≈39 each; deciles would leave ~19 per bin = too few), all 194:
| model | shrunk (shipped) | price | actual hit |
|---|---|---|---|
| 26.3 | 16.9 | 13.7 | 23.7 |
| 29.2 | 19.5 | 16.3 | 20.5 |
| 33.5 | 23.6 | 20.4 | 10.3 |
| 39.6 | 25.1 | 20.3 | 12.8 |
| 53.5 | 40.0 | 35.5 | 43.6 |
Log loss all 194: model .558, shrunk .493, price alone .488. Test: model .571, shrunk .527, price .530.
Shrink alone does not change WHICH plays are made (it is monotone in the gap); it fixes the shown chance and EV.

## 2. Edge cap (raw gap above 12 pts → "Watch", not a play)
Rule = model ≥25%, raw gap ≥5 pts, plus cap. ROI at $5:
| rule | train (Oct) | test (Nov) | all |
|---|---|---|---|
| baseline | 66 plays, 11 wins, −$89.8 (−27%) | 126, 32, +$114.7 (+18%) | 192, 43, +$25.0 (+2.6%) |
| cap 12 | 26, 7, +$11.8 (+9%) | 57, 18, +$44.5 (+16%) | 83, 25, +$56.2 (+13.5%) |
**Mixed:** cap helped in train, but gave up profit in the test month (the raw 12+ gap plays made money in Nov). Pooled it is better and loses fewer bets, so shipped per the brief; n is small either way. Plays the new rule would ADD cannot be measured: the log only holds plays the old rule picked.

## 3. Freshness (box-score backtest, 833 finished 2026 games, 7,000 player-games, top 8 per team, history ≥4 games)
No per-game betting lines were readable, so team points = average of the last 6 games (a proxy). Log loss (lower better), each change alone vs base .50877:
- newest 3 games ×2: .50838 (tiny gain; (×3: .50756, no better))
- zero on a 2-game role collapse (<30% of earlier carries+targets, earlier avg ≥4): .50462
- both: .50305
These do not use the book's price, so they say the role inputs get better, not that profit rises. Not measurable on bets: the log doesn't store role inputs.

## Shipped
`api/_tdcal.js` (all constants), `api/_td.js` (recent boost, collapse), `api/_tdbuild.js` (shrink, cap, `play`/`watch`/`model`/`gap` fields, log now stores model + gap for the next fit), `index.html` (how-it-works text), selftest (6 offline TD checks, 31/31).
