# Changelog

## 2026-11-23 — TD model: the line's points count for less than a straight line, and teams differ in TDs per point

**What was wrong.** The board turned the betting line into team TDs with a straight line (implied points × k). On 2026 games the model under-rated the top players of teams the line expects to score little (college teams under 14 implied points: model 14.8% on held-out weeks vs 25.0% actual, 224 rows) and over-rated high-scoring teams (NFL 25+ points: 24.8% vs 17.2%). Blowouts spread TDs across backups, and offenses differ in how often points become TDs.

**What changed** (all constants in `api/_tdcal.js`). Team TDs = k × avg × (implied/avg)^0.5, times the team's own recent TDs-per-point (shrunk, 150 points of league-rate history). Platt calibration re-fit and moved into `_tdcal.js`. The board's "expected team TDs" and the how-it-works text match.

**How much better (held-out weeks 9+, top 8 per team, Platt re-fit weekly on earlier weeks only):** log-loss −0.0036 ± 0.0009 per player (4,712 rows, 297 games; NFL −0.0034 ± 0.0015 on 656 rows / 41 games, college −0.0036 ± 0.0010 on 4,056 / 256). Better in 14 of 15 league-weeks. A modest gain; the model was already near what box scores can say.

**Tested and dropped** (held-out Δ in `reports/td-better-1123.md`): opponent TD-allowed split, QB rushing, goal-line carries and red-zone targets from play-by-play, game script from the spread, team pace, missed-last-game multiplier, re-tuned alpha/window/decay, Platt re-fit alone, injury redistribution caps. **Not changed:** the play rule, K_SHRINK .25, the 12-pt cap. FanDuel's anytime-TD price exists only for logged plays (191 non-void, 2026-11-01 → 11-23), too few to test them; the report recommends storing the price for every listed player.

## 2026-11-14 — college plays decayed after week 3; the 55–58% tier is now a lean from week 7

**What happened.** The app's own college plays (`/api/applog`) went 123–78 (61%) in September, 39–43 (48%) in October and 10–14 (42%) in November. The first three weeks are always the best weeks of the college season (56% pooled in 2023–25, 63.5% in 2026), and 2026 totals plays from week 4 on went 58–64 (47.5%) against 339–261 (56.5%) in 2023–25.

**What I changed.**
1. `verdict.js`: a college totals-model call at 55–58% confidence is a staked play only in weeks 1–6. From week 7 it is a lean (shown, not staked). 58%+ and the dog-implied ≤10 OVER are unchanged. A game with no week number is never gated.
2. `board.html`: "total 60+ → UNDER" can no longer be promoted to a strong call (lean only). Its backtest prior now includes 2026 (20–36, 35.7%).
3. The "why" text in `verdict.js` quoted "this season" records from September (41–20, 36–24, 15–9, 52–32). They now quote the measured four-season numbers.
4. `scripts/selftest.js` tests the week gate. README backtest table has a 2026 column.

**Numbers (app's own staked plays, before → after).** 2023 195–164 → 147–126 (53.8%); 2024 203–141 → 147–100 (59.5%); 2025 211–163 → 160–105 (60.4%); 2026 172–135 (56.0%) → 148–109 (57.6%). Every season stays above 52.4%.

**What this does not fix.** October after the change is still 21–27 (44%): what is left is a 58%+ model tier at 10–10 in weeks 7+, the unranked-favorite side at 0–3 in week 7, and the dog-implied OVER. Those are too few games to judge (under 60) and I did not touch them. The gate itself leans on 2025–26 (the dropped plays went 56% / 58% in 2023 / 2024, 47% / 48% in 2025 / 2026), so treat it as a demotion to watch, not a proven cut.

**Not changed, on purpose.** A "don't fight a big line move" filter (against a 3+ pt total move the model went 54–36, 60%, in 2023–25 and 24–28 in 2026); re-fitting `_logit.json`; dropping `dogimp10`. The unranked-favorite-vs-FCS side is still staked although it went 43% in 2023 — the house rule says lean; that is Otto's call. Full numbers: `~/armor-work/out/edge-decay-cfb-1114/REPORT.md`.
