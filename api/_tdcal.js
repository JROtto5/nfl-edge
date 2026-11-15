/* Every TD-model calibration constant lives here (fit 2026-11-14 on the logged plays, Oct train / Nov test;
   see reports/td-calibration-1114.md). Change them here and nowhere else. */
module.exports={
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
