/* THE rule set for Edge — shared by the app (index.html) and the server (api/_applog.js).
   verdict(g) -> {tier, dir, conf, side, why}; playsOf(g) -> staked plays; result()/sideResult() grade them. */
/* ---- the one rule set: what's a PLAY, what's a LEAN, and how confident ---- */
function verdict(g){
  if(g.noLine) return {tier:"none",why:["No line posted yet."]};
  const m=g.model, f=g.flags, why=[]; let pick=null;
  if(g.lg==="cfb"){
    if(f.dogimp10&&!(m.dir==="UNDER"&&m.conf>=55)){ pick={dir:"OVER",tier:"play",conf:Math.max(60,m.dir==="OVER"?m.conf:0)}; why.push(`Big mismatch: the underdog is expected to score only ~${g.dogImp}. Backups and garbage-time scores push these over — this signal is 41–20 this season.`); }
    if(m.conf>=58&&(!pick||pick.dir===m.dir)){ pick={dir:m.dir,tier:"play",conf:Math.max(pick?pick.conf:0,Math.min(65,m.conf))}; why.push(`The totals model is ${m.conf}% on the ${m.dir} — its strongest tier, which hit ~60% on seasons it had never seen.`); }
    else if(!pick&&m.conf>=55){ pick={dir:m.dir,tier:"play",conf:m.conf}; why.push(`The totals model is ${m.conf}% on the ${m.dir}. This 55–58% tier has gone 36–24 (60%) in college this season.`); }
    else if(!pick&&m.conf>=52&&f.lowlast&&m.dir==="OVER"){ pick={dir:"OVER",tier:"lean",conf:55}; why.push(`A team is coming off a ≤30-point game (college overs after that: 15–9 this season) and the model tilts over at ${m.conf}%.`); }
    if(pick&&pick.dir==="OVER"&&f.lowlast&&pick.tier==="play") why.push("One of these teams just played a ≤30-point game — totals over-correct after those (15–9 this season).");
    if(pick&&f.rankclash&&pick.dir==="UNDER") why.push("Ranked vs ranked — these have leaned under the last three seasons.");
  } else {
    if(f.bothunder&&m.dir==="OVER"&&m.conf>=55){ pick={dir:"OVER",tier:"play",conf:Math.min(62,Math.max(58,m.conf))}; why.push(`Both teams' last game went under the total — NFL totals over-correct after that (over hit 55 / 59 / 63% the last three seasons) — and the model agrees at ${m.conf}%.`); }
    else if((f.windy||f.wet)&&!g.indoor&&!(m.conf>=58&&m.dir==="OVER")){ pick={dir:"UNDER",tier:m.conf>=58&&m.dir==="UNDER"?"play":"lean",conf:m.conf>=58&&m.dir==="UNDER"?Math.min(62,m.conf+1):57,half:true}; why.push(`Weather: ${g.weather.gust} mph gusts, ${g.weather.precip}% rain. NFL weather unders are 7–1 this season, but historically swingy (71 / 43 / 61% by year) and the market has usually moved the total already.`); }
    else if(f.bothunder&&!(m.dir==="UNDER"&&m.conf>=55)&&!f.windy){ pick={dir:"OVER",tier:"lean",conf:57}; why.push(`Both teams' last game went under the total. NFL totals over-correct after that: over hit 55 / 59 / 63% the last three seasons. The old board called this strong (58%); it's a lean here because the model doesn't back it (${m.conf}% ${m.dir}) and it's only 2–3 when re-checked on 2026 games.`); }
    else if(m.conf>=58){ pick={dir:m.dir,tier:"play",conf:Math.min(60,m.conf),half:true}; why.push(`The NFL totals model is ${m.conf}% on the ${m.dir}. At 58%+ it's 9–3 this season and was a small winner in each of the last three (55 / 57 / 52%) — $5 until it has a bigger sample.`); }
  }
  if(pick&&pick.dir==="OVER"&&f.windy){ why.push(`Skipped: ${g.weather.gust} mph gusts argue against an over.`); pick=null; }
  let side=null;
  if(g.lg==="nfl"&&g.spread!=null){ const a=Math.abs(g.spread), dog=g.spread>0?g.home:g.away, favT=g.spread<0?g.home:g.away;
    const o=g.openSpread!=null?Math.abs(g.openSpread):null, crossed=o!=null&&a>o&&[3,7].some(k=>o<k&&a>=k);
    if(crossed){ side={team:dog,line:+a,tier:"lean",conf:56}; why.push(`<b>Side lean:</b> the line moved through ${o<3&&a>=3?"3":"7"} toward the favorite (${o} → ${a}). Dogs getting a key number this way: 58% the last two seasons, 5–1 this season.`); }
    else if(a>=7&&a<=9.5){ side={team:dog,line:+a,tier:"lean",conf:56}; why.push(`<b>Side lean:</b> NFL dogs of +7 to +9.5 covered 57% the last three seasons and are 5–2 this season.`); }
    else if(a>=0.5&&a<=2.5){ side={team:favT,line:-a,tier:"lean",conf:55}; why.push(`<b>Side lean:</b> small NFL favorites (0.5–2.5) covered 55% the last three seasons and are 5–1 this season.`); } }
  if(f.unrfavfcs){ side={team:g.fav,line:-Math.abs(g.spread),tier:"play",conf:60}; why.push(`<b>Side:</b> ${g.fav} is unranked and laying ${Math.abs(g.spread)} to an FCS school. Unranked favorites keep their foot down in these games — the favorite has covered 52–32 (62%) this season.`); }
  if(!pick&&!side) return {tier:"none",why:why.length?why:["Nothing measured says this line is off — the book's number looks fair."]};
  if(!pick) return {tier:side.tier==="play"?"play":"none",conf:side.conf,dir:null,side,why};
  return {...pick,side,why};
}
function sideResult(g,s){ if(!s||g.state==="pre") return null; if(g.state==="in") return "live"; const cm=(g.hs-g.as)+g.spread; if(cm===0) return "push"; return ((cm>0)===(s.team===g.home))?"win":"loss"; }
function result(g,v){ if(!v.dir||g.total==null) return null; const t=g.hs+g.as; if(g.state==="post") return t===g.total?"push":((t>g.total)===(v.dir==="OVER")?"win":"loss"); if(g.state==="in") return "live"; return null; }
/* every staked play on a game (a game can carry a total AND a side) */
function playsOf(g){ const v=verdict(g), out=[];
  if(v.dir&&v.tier==="play") out.push({g,v,lab:`${v.dir} ${g.total}`,conf:v.conf,r:result(g,v),amt:v.half?5:10,price:v.dir==="OVER"?g.overOdds:g.underOdds});
  if(v.side&&v.side.tier==="play") out.push({g,v,lab:`${v.side.team} ${v.side.line}`,conf:v.side.conf,r:sideResult(g,v.side),amt:10,price:null});
  return out; }

if(typeof module!=="undefined") module.exports={verdict,result,sideResult,playsOf};
