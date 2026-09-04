# The Edge Board

Live NFL + college football betting-edge board. Pulls weather, injuries, odds, line
movement and in-game scores from ESPN's public feeds, runs them through a set of
measured signals, and shows where the line looks wrong — with an honest record of how
those calls actually did.

**Live:** https://nfl-edge-kappa.vercel.app (installable as a phone app)

## What it does

- **Rolling Mon→Sun week** across NFL and FBS college football, auto-refreshing.
- **~30 signals** — wind/precip/cold on totals, QB out (role-weighted by that team's
  actual passing leader), steam/line movement, juice leans, opponent-adjusted power
  ratings vs the market, ranked huge-dog spots, ranked-vs-ranked unders, rest/short
  prep, coaching, altitude, dome fades, live in-play pace vs the **live** line, more.
- **Weighted stacking** — signals agreeing on a side are scored by evidence weight,
  not counted; conflicts between signals are surfaced, never hidden.
- **Projected lines** — our own Massey-style power ratings blended with ESPN's
  matchup model, with injury adjustments; edge vs the market shown per game.
- **Stake sizing** — each strong play gets an estimated hit probability from the
  best evidence available and a quarter-Kelly stake against your bankroll.
- **🏆 Best bets of the week** sort, ★ Top Plays, Props (directional), Parlay Builder.
- **Track Record** — every strong call is logged the moment it appears with the line
  frozen, graded when the game goes final, with closing-line value, a per-signal
  self-audit, fade detection, and live covering/trailing status for open calls.

## Backtests (2024 + 2025 seasons, real closing lines, 2,246 games)

Every rule is judged on two full seasons and must beat break-even (52.4%) in **each**
season separately — the second season is out-of-sample for anything found on the first.

| Signal | NFL | College |
|---|---|---|
| Our ratings vs closer, 3+ pt gap, week 10+ | **57.8%** (58.5 / 57.1) | 51.3% — failed 2024, held at lean |
| Ranked vs ranked → UNDER | — | **59.6%** (56.4 / 62.0) |
| Unranked laying 21+ vs FCS → favorite | — | **58.4%** (57.8 / 58.9) |
| Total 60+ → UNDER | — | **57.0%** (60.7 / 53.4) |
| Dog implied ≤10 pts → OVER | — | **56.9%** (55.8 / 57.8) |
| Either team's last game ≤30 combined → OVER | **58.3%** (57.1 / 59.4) | 54.9% (lean) |
| Dog +7 to +9.5 | **61.4%** (65.8 / 57.8), lean-capped | — |
| Favorites of 10+ | 58.0% (57.9 / 58.1), lean-capped | — |
| 4pm Sunday window → OVER | 57.9% (57.6 / 58.2), lean-capped, no mechanism | — |
| Ranked laying 28+ vs unranked FBS → dog | — | 53.8% — **62% in 2025, 43% in 2024**, demoted |
| Team held to ≤7 last game | 50.8% (33 / 69) removed | 52.8% (47 / 58) removed |
| Fade the rested college team | — | 52.3% (47 / 58) removed |
| Primetime dog | 47.1% (37 / 57) removed | 48.0% |
| Home dogs / divisional under / always-over CFB / revenge games | coin flips | coin flips |

114 rule×league tests were run ("the wall"); every result, including the failures, is
shown in the app's Results → Advanced section. Weather signals cannot be backtested
(ESPN strips forecasts from finished games) and can never make a strong call alone.

## Architecture

```
index.html          single-file app (state, signals, projections, views)
intro.html          45s animated intro, Web Audio synthesized music
sw.js               PWA service worker: page network-first, ESPN + /api never cached
api/_espn.js        server-side ESPN fetcher, allow-listed hosts, ~20s memory cache
api/espn.js         GET  /api/espn?u=<espn url>     single proxied call, CDN-cached
api/bulk.js         POST /api/bulk {urls:[...]}     one round-trip per batch of games
manifest.webmanifest, icon-*.png
```

The client routes all ESPN traffic through `/api` when served over http(s) and falls
back to calling ESPN directly if the API is unavailable, so a static copy still works.

Data sources: `site.api.espn.com` scoreboard + summary (odds, weather, injuries,
predictor, last-five, pickcenter), `sports.core.api.espn.com` odds (keeps the
pregame closer and the live line after kickoff; retains closing odds for completed
games, which is what makes the backtests possible).

## Testing

There is no build step. Signals are tested by running the page's script in a Node
`vm` sandbox against captured ESPN JSON (real slates, real live-odds payloads) plus
synthetic known-answer scenarios, and the API handlers are called directly in Node.
No debug hooks are ever shipped — `grep -c __DBG index.html` must be `0` before deploy.

## Deploy

```
vercel --prod
```

## Honesty rules

- A "strong" label has to be earned by weighted evidence, not by counting leans.
- Calls are graded against the number that was actually called, never a later one.
- Negative backtest results are shown, and they lower the signal's weight.
- Nothing here places a bet or promises anything. Reference math only.
