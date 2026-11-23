/* Every TD-model calibration constant lives here (fit 2026-11-14 on the logged plays, Oct train / Nov test;
   see reports/td-calibration-1114.md; LINE_GAMMA / AVG_TEAM_PTS / TEAM_K_POINTS / PLATT re-fit 2026-11-23 walk-forward
   on every finished 2026 game, see reports/td-better-1123.md). Change them here and nowhere else. */
module.exports={
  LINE_GAMMA:.5,       // a team's expected TDs = k × avg × (implied points / avg)^γ. γ=1 was the old straight line; underdogs' top players scored ~2x what it gave them
  AVG_TEAM_PTS:{nfl:23,cfb:26.5}, // league-average points per team per game (2026 box scores: 23.1 / 26.4); the pivot of the curve above
  TEAM_K_POINTS:150,   // a team's own TDs-per-point (last 6 games) counts as if it had this many points of history on top of the league rate
  PLATT:[-.205,.842],  // final calibration: logit(shown chance) = PLATT[0] + PLATT[1] × logit(raw chance); fit on the top 8 per team, weeks 5+
  K_SHRINK:.25,        // shown chance = market + K × (model − market). 0 = trust the book, 1 = trust the model
  EDGE_CAP:.12,        // a model-vs-price gap above this is demoted from a play to a "watch" (the book likely knows something)
  MIN_RAW_EDGE:.05,    // smallest model-vs-price gap that makes a play
  MIN_EDGE:.01,        // and the shrunk chance must still beat the price by this much
  RECENT_GAMES:3,      // the newest N games count extra in carry / target shares
  RECENT_BOOST:2,      // ... by this multiple
  COLLAPSE_GAMES:2,    // a role collapse = his last N games ...
  COLLAPSE_RATIO:.3,   // ... averaged under this fraction of his earlier touches per game
  COLLAPSE_MIN_TOUCH:4 // (only judged for players who averaged at least this many carries+targets before)
};
