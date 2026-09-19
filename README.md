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
- **🏆 Best Bets** — its own view: the plays that clear the bar, split NFL / college,
  each one showing the number behind it, the sample that number came from, the market
  price and which book set it. It says **"nothing worth betting"** when nothing qualifies
  rather than ranking the least-bad options. Plus the Best bets sort, ★ Top Plays,
  Props (directional), Parlay Builder.
- **Track Record** — every strong call is logged the moment it appears with the line
  frozen, graded when the game goes final, with closing-line value, a per-signal
  self-audit, fade detection, and live covering/trailing status for open calls.

## Backtests (2023–2025, real closing lines, 3,371 games)

Every rule is judged on three full seasons and must beat break-even (52.4%) in **each**
season. Only three-for-three signals can make a strong call on their own.

| Signal | NFL | College | Status |
|---|---|---|---|
| Our ratings vs closer, 3+ pt gap, week 10+ | **56.5%** (54 / 59 / 57) | 50.4% | NFL strong; CFB held at lean |
| Total 60+ → UNDER | — | **56.1%** (55 / 61 / 53) | strong |
| Dog implied ≤10 pts → OVER | — | **56.0%** (54 / 56 / 58) | strong |
| Both teams' last game went UNDER → OVER | **58.4%** (55 / 59 / 63) | 53.6% | not live yet |
| Favorites of 10+ | 56.2% (52 / 58 / 58) | — | lean (thin) |
| Ranked vs ranked → UNDER | — | 56.7% (51 / 56 / 62) | lean |
| Unranked laying 21+ vs FCS → favorite | — | 53.1% (**43** / 58 / 59) | lean |
| Dog +7 to +9.5 | 57.5% (49 / 66 / 58) | — | lean |
| Ranked laying 28+ vs FBS → dog | — | 53.0% (51 / 43 / 62) | lean |
| Primetime dog, 4pm over, held-to-≤7, rested-team fade, total ≤45 under | one-season wonders | | removed |
| Home dogs, always-over, divisional under, revenge, rest | coin flips | coin flips | not signals |

A second wall used true opening/closing lines (line-movement rules: nothing except a move against a ranked team, 58/58/53%) and full box scores (yards per play, turnovers, third downs: nothing — the market prices efficiency; turnover-luck "regression" is a stable loser at 44%). Closing-line-value per spot drives a bet-timing note on every call.

117 rule×league tests were run ("the wall"); every result, including the failures, is
shown in the app's Results → Advanced section. Weather was backtested on real kickoff conditions (Open-Meteo archive, 3,040 outdoor
games): NFL 20+ mph gusts → UNDER 57.9% but 71/43/61% by season; college wind 50%;
rain over in college, cold over in the NFL. Weather is lean-only with measured weights.

A fitted 21-feature logistic **totals** model (leave-one-season-out: college ≥58% confidence
62.9/65.2/55.4%, NFL 55/56.5/52.4%) is the best-validated call on the board; side models
failed and are not shipped.

## Architecture

```
index.html          single-file app (state, signals, projections, views)
intro.html          45s animated intro, Web Audio synthesized music
sw.js               PWA service worker: page network-first, ESPN + /api never cached
api/_espn.js        server-side ESPN fetcher: allow-listed hosts, ~10s memory cache,
                    limit clamped to ESPN's real max of 500, and dead `dates=A-B`
                    scoreboard ranges rebuilt day-by-day
api/espn.js         GET  /api/espn?u=<espn url>     single proxied call, CDN-cached
api/bulk.js         POST /api/bulk {urls:[...]}     one round-trip per batch of games
scripts/selftest.js dev: runs the page in a Node vm against live ESPN and asserts
scripts/dev-server.js  dev: static files + the real /api handlers on localhost
manifest.webmanifest, icon-*.png
```

**All ESPN traffic must go through `/api`.** ESPN's Akamai edge answers browser-shaped
cross-origin requests (real user-agent + `Origin` + `Sec-Fetch-*`) with **403 and no
`Access-Control-Allow-Origin`**, so the old client-side "fall back to calling ESPN
directly" path fails CORS every time and a purely static copy no longer loads data.
Every repair for a changed upstream shape belongs in `api/_espn.js`, and a failure
there is reported — never turned into an empty list.

Data sources: `site.api.espn.com` scoreboard + summary (odds, weather, injuries,
predictor, last-five, pickcenter), `sports.core.api.espn.com` odds (keeps the
pregame closer and the live line after kickoff; retains closing odds for completed
games, which is what makes the backtests possible).

## Testing

There is no build step. Signals are tested by running the page's script in a Node
`vm` sandbox against captured ESPN JSON (real slates, real live-odds payloads) plus
synthetic known-answer scenarios, and the API handlers are called directly in Node.
No debug hooks are ever shipped — `grep -c __DBG index.html` must be `0` before deploy.

```
node scripts/selftest.js          # runs the page in a vm against live ESPN, asserts
node scripts/dev-server.js        # http://localhost:4399 with the real /api handlers
FAIL=cfb node scripts/dev-server.js   # inject a league feed outage to check it's visible
```

`selftest.js` covers the failures that have actually happened: the dead date-range
query, ESPN's silent 500-event `limit` ceiling, both leagues reaching the board, a
fabricated empty feed being reported instead of shown as "no games", and Best Bets
being willing to say nothing.

## Deploy

```
vercel --prod
```

## Honesty rules

- A "strong" label has to be earned by weighted evidence, not by counting leans.
- Calls are graded against the number that was actually called, never a later one.
- Negative backtest results are shown, and they lower the signal's weight.
- Nothing here places a bet or promises anything. Reference math only.
