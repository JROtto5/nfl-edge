# TD model, measured and improved — 2026-11-23

Main = `e06d86e` (league-clean team history). Everything below is reproducible from `~/armor-work/out/td-model-better-1123/lab` (harvest.js, evalib.js, cand.js, final.js, verify.js; box scores, play-by-play, closing lines in `lab/data`).

## Step 1 — measurement of main as it stands

Data: every finished 2026 regular-season game (NFL 162, FBS 822), box scores + ESPN closing line (core odds), history strictly before each game, team history ≥2 games. One row = a player on his team's list (every player with touches in the last 6 games, not only the top 8). y = scored any TD (rush, rec, return, defensive). p = shipped model chance (after the fixed Platt [-.28,.841]).

### NFL — all rows: n=3759, predicted 12.5%, hit 14.1%, Brier 0.1068, log-loss 0.3593 (base-rate-only log-loss 0.4068)

| model p bin | n | predicted % | hit % | hits |
|---|---|---|---|---|
| 0–5% | 1399 | 2.2 | 4.4 | 61 |
| 5–10% | 590 | 7.3 | 8.6 | 51 |
| 10–20% | 952 | 14.5 | 15.2 | 145 |
| 20–30% | 444 | 24.4 | 27.5 | 122 |
| 30–40% | 220 | 34.0 | 30.9 | 68 |
| 40–50% | 98 | 44.8 | 50.0 | 49 |
| 50–100% | 56 | 56.8 | 60.7 | 34 |

By week (the model's own week 1–3 rows have thin history; late season at the bottom):

| week | games | n | predicted % | hit % | Brier | log-loss | top-3 per team: n / pred % / hit % |
|---|---|---|---|---|---|---|---|
| 3 | 16 | 379 | 15.7 | 17.7 | 0.1396 | 0.4504 | 96 / 32.9 / 27.1 |
| 4 | 16 | 419 | 14.2 | 15.5 | 0.1161 | 0.3780 | 96 / 31.8 / 31.3 |
| 5 | 15 | 410 | 13.1 | 15.1 | 0.1076 | 0.3530 | 90 / 31.9 / 36.7 |
| 6 | 14 | 412 | 12.2 | 12.1 | 0.0976 | 0.3393 | 84 / 31.5 / 28.6 |
| 7 | 14 | 418 | 12.2 | 14.1 | 0.1007 | 0.3304 | 84 / 31.5 / 36.9 |
| 8 | 14 | 429 | 11.2 | 14.7 | 0.1072 | 0.3466 | 84 / 30.1 / 36.9 |
| 9 | 15 | 462 | 12.1 | 12.3 | 0.0978 | 0.3360 | 90 / 32.1 / 32.2 |
| 10 | 14 | 440 | 11.9 | 13.4 | 0.1057 | 0.3853 | 84 / 32.1 / 32.1 |
| 11 | 12 | 390 | 10.1 | 12.3 | 0.0920 | 0.3213 | 72 / 28.2 / 33.3 |

Late season (weeks 9+): n=1292, predicted 11.5%, hit 12.7%, log-loss 0.3483; top-3: n=246 pred 31.0 hit 32.5

### CFB — all rows: n=23302, predicted 11.5%, hit 13.3%, Brier 0.1009, log-loss 0.3410 (base-rate-only log-loss 0.3913)

| model p bin | n | predicted % | hit % | hits |
|---|---|---|---|---|
| 0–5% | 9765 | 2.2 | 3.9 | 380 |
| 5–10% | 3975 | 7.2 | 9.4 | 373 |
| 10–20% | 4766 | 14.5 | 15.3 | 730 |
| 20–30% | 2638 | 24.4 | 27.6 | 727 |
| 30–40% | 1340 | 34.3 | 35.1 | 470 |
| 40–50% | 559 | 44.3 | 45.6 | 255 |
| 50–100% | 259 | 56.8 | 59.8 | 155 |

By week (the model's own week 1–3 rows have thin history; late season at the bottom):

| week | games | n | predicted % | hit % | Brier | log-loss | top-3 per team: n / pred % / hit % |
|---|---|---|---|---|---|---|---|
| 2 | 9 | 162 | 12.8 | 12.3 | 0.0972 | 0.3225 | 30 / 29.5 / 30.0 |
| 3 | 75 | 2128 | 12.2 | 17.1 | 0.1319 | 0.4429 | 393 / 28.4 / 37.9 |
| 4 | 71 | 2301 | 12.5 | 14.0 | 0.1088 | 0.3662 | 390 / 31.7 / 36.4 |
| 5 | 59 | 2185 | 12.0 | 13.9 | 0.1083 | 0.3674 | 345 / 33.4 / 33.6 |
| 6 | 58 | 2266 | 11.0 | 12.3 | 0.0951 | 0.3191 | 348 / 32.0 / 34.2 |
| 7 | 62 | 2440 | 10.9 | 12.0 | 0.0901 | 0.3054 | 363 / 32.6 / 36.4 |
| 8 | 56 | 2272 | 10.9 | 12.4 | 0.0924 | 0.3142 | 336 / 33.3 / 39.9 |
| 9 | 56 | 2195 | 11.1 | 11.7 | 0.0868 | 0.2975 | 336 / 33.3 / 35.7 |
| 10 | 63 | 2356 | 11.7 | 13.1 | 0.0984 | 0.3316 | 375 / 34.2 / 36.8 |
| 11 | 67 | 2506 | 11.6 | 12.3 | 0.0941 | 0.3142 | 402 / 33.6 / 35.8 |
| 12 | 70 | 2491 | 11.3 | 14.2 | 0.1062 | 0.3619 | 408 / 32.7 / 36.0 |

Late season (weeks 10+): n=7353, predicted 11.6%, hit 13.2%, log-loss 0.3359; top-3: n=1185 pred 33.5 hit 36.2

### Logged plays (the app's own play log, newest 200 via /api/td; 200 rows, 9 void): date 2026-11-01 → 2026-11-23
**What this is, and is not:** FanDuel's anytime-TD price is stored ONLY for logged plays (and the live board). No archive of FanDuel prices exists for the other games, so a price-vs-model comparison over 'every game' is impossible; the 200 plays are the model's own picks (selected for a model-over-price gap), so they are biased toward model optimism. The play log is also capped at the newest 200 by the API (older Oct plays are in Blob, no token here). De-vigged market = implied ÷ overround; overround measured from FanDuel's live NFL board (sum of implied over all runners ÷ expected distinct scorers = 1.31) and estimated 1.25 for college (FanDuel lists only ~20 college runners, so the same ratio can't be measured; assumption flagged).

| group | plays | W-L | hit % | avg price-implied % | avg de-vigged % | avg shown p % | avg raw model % | profit $ ($5 flat) | ROI % | LL market(dv) | LL shown | LL model | Brier market(dv) | Brier shown | Brier model |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 191 | 50-141 | 26.2 | 24.3 | 19.0 | 36.0 | 37.1 | 91.93 | 9.6 | 0.5527 | 0.5663 | 0.5702 | 0.1834 | 0.1895 | 0.1908 |
| NFL | 80 | 20-60 | 25.0 | 23.8 | 18.2 | 36.2 | 37.5 | 12.67 | 3.2 | 0.5326 | 0.5861 | 0.5895 | 0.1766 | 0.1986 | 0.2000 |
| CFB | 111 | 30-81 | 27.0 | 24.6 | 19.7 | 35.8 | 36.8 | 79.26 | 14.3 | 0.5672 | 0.5521 | 0.5563 | 0.1883 | 0.1830 | 0.1843 |
| NFL wk 8 | 22 | 4-18 | 18.2 | 15.6 | 11.9 | 38.3 | 38.3 | 21.00 | 19.1 | 0.4566 | 0.5988 | 0.5988 | 0.1439 | 0.2038 | 0.2038 |
| NFL wk 9 | 33 | 7-26 | 21.2 | 26.4 | 20.1 | 38.6 | 38.6 | -42.33 | -25.7 | 0.4759 | 0.5612 | 0.5612 | 0.1521 | 0.1864 | 0.1864 |
| NFL wk 10 | 10 | 5-5 | 50.0 | 24.8 | 19.0 | 30.8 | 32.3 | 36.50 | 73.0 | 0.8237 | 0.6639 | 0.6824 | 0.3076 | 0.2393 | 0.2457 |
| CFB wk 10 | 60 | 17-43 | 28.3 | 23.5 | 18.8 | 36.3 | 36.3 | 82.55 | 27.5 | 0.5884 | 0.5382 | 0.5382 | 0.1960 | 0.1757 | 0.1757 |
| NFL wk 11 | 15 | 4-11 | 26.7 | 29.5 | 22.5 | 31.4 | 37.3 | -2.50 | -3.3 | 0.5748 | 0.5705 | 0.5760 | 0.1914 | 0.1910 | 0.1940 |
| CFB wk 11 | 34 | 8-26 | 23.5 | 23.8 | 19.1 | 37.0 | 37.0 | 22.00 | 12.9 | 0.5785 | 0.6243 | 0.6243 | 0.1913 | 0.2160 | 0.2160 |
| CFB wk 12 | 17 | 5-12 | 29.4 | 29.9 | 23.9 | 31.9 | 38.0 | -25.29 | -29.8 | 0.4698 | 0.4563 | 0.4837 | 0.1554 | 0.1425 | 0.1510 |
| logged BEFORE the shrink/cap rule (no model field; shown p = raw model) | 157 | 41-116 | 26.1 | 23.2 | 18.3 | 37.1 | 37.1 | 129.72 | 16.5 | 0.5649 | 0.5824 | 0.5824 | 0.1878 | 0.1964 | 0.1964 |
| logged UNDER the shrink .25 + cap .12 rule (has model field) | 34 | 9-25 | 26.5 | 28.9 | 22.6 | 30.9 | 37.0 | -37.79 | -22.2 | 0.4966 | 0.4924 | 0.5139 | 0.1631 | 0.1577 | 0.1651 |
| old plays that the CURRENT rule would still play (gap 5–12 pts, model>=25%) | 108 | 32-76 | 29.6 | 28.1 | 22.0 | 34.1 | 36.0 | 8.18 | 1.5 | 0.5764 | 0.5641 | 0.5709 | 0.1948 | 0.1888 | 0.1912 |
| old plays the cap now turns into watch (gap > 12 pts) | 79 | 17-62 | 21.5 | 18.9 | 14.9 | 38.8 | 38.8 | 86.75 | 22.0 | 0.5212 | 0.5713 | 0.5713 | 0.1681 | 0.1913 | 0.1913 |

Calibration of the model-vs-price gap for logged plays:

| raw gap (model − price) | plays | hit % | price-implied % | raw model % | ROI % |
|---|---|---|---|---|---|
| 0–5 pts | 4 | 25.0 | 25.7 | 30.7 | -15.0 |
| 5–8 pts | 58 | 34.5 | 28.9 | 35.1 | 22.1 |
| 8–12 pts | 50 | 24.0 | 27.1 | 37.1 | -22.4 |
| 12–20 pts | 48 | 20.8 | 21.3 | 36.4 | 20.1 |
| 20–100 pts | 31 | 22.6 | 15.2 | 42.5 | 24.8 |

## Step 2 — candidates, walk-forward

**Protocol.** One row = a player on his team's list (top 8 per team, the board's population). History strictly before each game; the closing line is ESPN/DraftKings core odds. Every variant (and the baseline) gets the same Platt calibration, **re-fit each week on earlier weeks only**. Parameters are chosen on TUNE = weeks 5–8 only; HELD-OUT = weeks 9+ (NFL 9–11 = 656 rows / 41 games, college 9–12 = 4,056 rows / 256 games). Δ = held-out log-loss of the variant minus the baseline, per row (negative = better), ± game-clustered standard error. Rows are paired.

**Honest caveat on the protocol:** about 60 settings across 14 families were scored, and the held-out weeks were printed next to the tune weeks, so they were not blind. Settings were picked by the tune weeks only (and the two kept changes are consistent in both and in 14 of 15 league-weeks), but the true forward test is next week's games.

| candidate | settings tried | best on TUNE | held-out Δ ± SE (n rows / games) | verdict |
|---|---|---|---|---|
| **Line dampening**: team TDs ∝ (implied/avg)^γ instead of straight-line | γ .3–1.25 | .3 (kept .5, the largest γ within 1 SE of the best) | **−3.60e-3 ± 0.90 with team factor** (4,712 / 297); γ alone −2.51 ± 0.87 | **KEEP** |
| **Team TDs-per-point** (shrunk team factor, 150 pts) | weight .5–2, 75–400 pts | 1, 150 | with γ: see above; alone −0.87 ± 0.26 (4,712 / 297) | **KEEP** |
| Opponent TD-allowed by rush/pass | strength .25–1 | .25 | +0.21 ± 0.14 (4,712 / 297) | drop (worse) |
| QB rushing multiplier | ×.7–1.6 | ×1.3 | +0.12 ± 0.39 (4,712 / 297) | drop (QB rush TDs already ride the carry share) |
| Goal-line carries (≤5 yds, from play-by-play) in the carry prior | weight .25–1 | .25 | +0.06 ± 0.50 (4,712 / 297); bigger weights clearly worse | drop |
| Red-zone targets (≤10 yds to go) in the target prior | weight .25–1 | .25 | +1.73 ± 0.67 (4,712 / 297) | drop (worse) |
| Game script from spread (favourites shift to rush share) | .15–.8 | .15 | +0.47 ± 0.44 | drop |
| Team pace (offensive plays per game) | .5–1.5 | .5 | −0.27 ± 0.11, but tune −0.06 ± 0.10 (not significant) | drop (0.05%, no tune signal) |
| "Missed last game" multiplier (now ×.8) | .6–1.0 | .6 | −0.26 ± 0.29 | drop (noise) |
| Re-tune alpha / games window / decay / recent boost | 4 settings each | 55 / 8 / .75 / 1 | −0.09 ± 0.40 / −0.30 ± 0.82 / +0.37 ± 0.32 / −0.32 ± 0.65 | drop (current values stand) |
| Re-fit the Platt calibration alone | pooled / top-8 / per league | — | −0.88 ± 1.07 | drop alone (new constants ship with the change above) |
| Injuries: OUT removal + hand the share to the rest (cap now ×1.6) | cap ×1.0–3.0 with absentees taken from the box score | — | all within ±0.5e-3 ± 0.5 (5,216 rows / 224 games) | leave as is |
| Injuries: Questionable / Doubtful | — | — | **not testable**: ESPN returns *today's* injury report for finished games (week-1 games show Nov-23 statuses); no historical report exists | not tested |
| K_SHRINK (blend toward FanDuel) | .0–1.0, price as is and de-vigged | .25–.4 | 191 logged plays only; held (11/12+, n=76) log-loss .5659 / .5655 / .5663 at K = 0 / .1 / .25, then worse | keep .25 |

K_SHRINK, the play rule and "shown p vs price" cannot be tested at any larger scale: FanDuel's anytime-TD price is stored only for the logged plays. That is the main limit of this study. **Recommendation:** store the board's FanDuel price + model chance for every listed player each build (not only plays). One more week of that makes K_SHRINK and the play thresholds testable on thousands of rows.

## Step 3 — what changed, before → after (held-out, walk-forward Platt for both sides)

| slice | rows (top 8 per team) | games | log-loss before | log-loss after | Δ (after−before) ± SE | Brier before → after |
|---|---|---|---|---|---|---|
| TUNE wk 5–8, NFL+CFB (used to pick γ) | 4624 | 292 | 0.5176 | 0.5138 | -3.82e-3 ± 0.71 | 0.1698 → 0.1684 |
| **HELD-OUT wk 9+, NFL+CFB** | 4712 | 297 | 0.5121 | 0.5085 | -3.60e-3 ± 0.90 | 0.1671 → 0.1660 |
| HELD-OUT wk 9+, NFL only (wk 9–11) | 656 | 41 | 0.4562 | 0.4528 | -3.38e-3 ± 1.45 | 0.1431 → 0.1418 |
| HELD-OUT wk 9+, CFB only (wk 9–12) | 4056 | 256 | 0.5211 | 0.5175 | -3.63e-3 ± 1.02 | 0.1710 → 0.1699 |

Per week, each week scored with a Platt fit only on earlier weeks:

| league | week | rows | games | Δ log-loss (neg = better) ± SE |
|---|---|---|---|---|
| NFL | 5 | 240 | 15 | -1.63e-3 ± 2.51 |
| NFL | 6 | 224 | 14 | 0.87e-3 ± 1.57 |
| NFL | 7 | 224 | 14 | -1.57e-3 ± 1.16 |
| NFL | 8 | 224 | 14 | -2.50e-3 ± 2.78 |
| NFL | 9 | 240 | 15 | -5.16e-3 ± 2.79 |
| NFL | 10 | 224 | 14 | -0.54e-3 ± 2.38 |
| NFL | 11 | 192 | 12 | -4.46e-3 ± 1.81 |
| CFB | 5 | 920 | 59 | -5.57e-3 ± 1.72 |
| CFB | 6 | 928 | 58 | -4.38e-3 ± 2.18 |
| CFB | 7 | 968 | 62 | -4.30e-3 ± 1.48 |
| CFB | 8 | 896 | 56 | -3.59e-3 ± 1.20 |
| CFB | 9 | 896 | 56 | -0.43e-3 ± 1.36 |
| CFB | 10 | 1000 | 63 | -2.97e-3 ± 1.96 |
| CFB | 11 | 1072 | 67 | -3.89e-3 ± 1.77 |
| CFB | 12 | 1088 | 70 | -6.62e-3 ± 2.63 |

Calibration by the team's implied points, held-out weeks 9+, top 8 per team (predicted → hit), before | after:

| league | implied pts | rows | before pred % | after pred % | hit % |
|---|---|---|---|---|---|
| NFL | 0–19 | 128 | 17.8 | 19.1 | 13.3 |
| NFL | 19–22 | 192 | 20.9 | 20.9 | 20.8 |
| NFL | 22–25 | 144 | 22.4 | 21.8 | 26.4 |
| NFL | 25–+ | 192 | 24.8 | 23.3 | 17.2 |
| CFB | 0–14 | 224 | 14.8 | 18.8 | 25.0 |
| CFB | 14–21 | 1016 | 20.3 | 22.0 | 22.3 |
| CFB | 21–28 | 1792 | 24.3 | 24.3 | 23.0 |
| CFB | 28–+ | 1024 | 28.6 | 26.8 | 28.4 |

Play-range rows (shown p ≥ 25%), held-out wk 9+: before n=1780, predicted 34.4%, hit 35.1%; after n=1793, predicted 34.8%, hit 35.4%.

## What shipped
- `api/_tdcal.js`: `LINE_GAMMA .5`, `AVG_TEAM_PTS {nfl 23, cfb 26.5}`, `TEAM_K_POINTS 150`, `PLATT [-.205, .842]` (re-fit on the top 8 per team, weeks 5+ of the new model; the old pair was [-.28, .841]).
- `api/_td.js`: `teamTDs()` (dampened team TDs), `teamEff()` (shrunk team TDs-per-point), both in `teamLambdas`; Platt now read from `_tdcal.js`.
- `api/_tdbuild.js`: the board's "expected team TDs" uses the same number; `index.html` step text says so.
- Not changed: the play rule (min 25%, raw gap 5–12 pts, max 3 a game), K_SHRINK, EDGE_CAP, injury handling, collapse rule. Nothing measured says to move them, and the price data to test them does not exist yet.
- The Platt constants were fit on all weeks (including the held-out ones), so the "as shipped" held-out numbers are slightly in-sample; the table above uses a walk-forward Platt for both sides.
