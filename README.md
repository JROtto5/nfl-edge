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

## Backtests (2025 season, real closing lines)

Walk-forward, no lookahead. Break-even at -110 is 52.4%.

| Signal | NFL | College |
|---|---|---|
| Our ratings vs closer, 3+ pt gap, mature teams | 57.1% (n=70) | 55.0% (n=309) |
| Same, early season | **40.4%** (n=57) → gated off | 48.5% (n=68) → gated off |
| Disagree with market by 6+ | 42.9% → refused | 50.7% → refused |
| Ranked laying 24+ vs unranked → dog | — | 54.4% (n=79), 58.9% at 28+ |
| Ranked vs ranked → UNDER | — | 62.0% (n=50) |
| Always OVER | 52.6% | 49.3% |
| Home dogs ATS | 52.3% | 50.0% |
| Rested team ATS | 48.8% | — |

Priors are kept **per league** because the leagues disagree. Weather signals cannot
be backtested (ESPN strips forecasts from finished games) and keep hand-set weights.
Every measured rate is shown in the app's Track Record view, including the losing ones.

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
