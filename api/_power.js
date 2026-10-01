/* Edge Power Poll — one number per team: points better than an average team on a
   NEUTRAL field. Rank by it and #1 is favored over every team below it, #2 over every
   team below it, and so on (ratings are linear, so the ordering IS the head-to-head order).

   The rating is a weighted least-squares fit over two kinds of evidence, each game giving
   one equation  rating(home) − rating(away) + HFA·(not neutral) ≈ target:
     • MARKET  — the closing spread of every finished game, plus the current spread of every
                 game on the board this week (target = −spread). Sharp money has already
                 priced injuries, QB play and "eye test"; this is the backbone (weight 2).
     • RESULTS — the actual final margin, capped (28 college / 21 NFL) so running up the
                 score doesn't count (weight 1). This is the résumé: winning matters.
   Older games fade (market half-life 5 weeks, results 8). A light prior keeps teams with
   few games sane (FBS → 0, FCS → −18). Home-field advantage is fitted, not assumed. */
const {scan}=require("./_scan.js"); const {readJSON,writeJSON}=require("./_store.js");
const FBS=new Set([1,4,5,8,9,12,15,17,18,37,151]);
const CFG={
  cfb:{cap:28,sd:15.5,mW:2,rW:1,mHalf:5,rHalf:8,top:25,tiers:[[3,"Title favorites"],[7,"Contenders"],[12,"Dangerous"],[99,"In the hunt"]]},
  nfl:{cap:21,sd:13.5,mW:2,rW:1,mHalf:5,rHalf:8,top:5, tiers:[[2,"Super Bowl favorites"],[4.5,"Contenders"],[8,"Playoff teams"],[99,"The rest"]]},
};
const PRIOR={fbs:[0,.15],fcs:[-18,.4],nfl:[0,.15]};

/* solve (AᵀWA + Λ) x = AᵀWb + Λμ with plain Gaussian elimination (~300 unknowns) */
function solve(n,rows,prior){
  const M=Array.from({length:n},()=>new Float64Array(n+1));
  for(const r of rows){ for(const [i,ci] of r.c) { for(const [j,cj] of r.c) M[i][j]+=r.w*ci*cj; M[i][n]+=r.w*ci*r.y; } }
  prior.forEach(([mu,lam],i)=>{ M[i][i]+=lam; M[i][n]+=lam*mu; });
  for(let k=0;k<n;k++){ let p=k; for(let i=k+1;i<n;i++) if(Math.abs(M[i][k])>Math.abs(M[p][k])) p=i; [M[k],M[p]]=[M[p],M[k]];
    const d=M[k][k]||1e-9; for(let i=k+1;i<n;i++){ const f=M[i][k]/d; if(!f) continue; for(let j=k;j<=n;j++) M[i][j]-=f*M[k][j]; } }
  const x=new Float64Array(n); for(let i=n-1;i>=0;i--){ let s=M[i][n]; for(let j=i+1;j<n;j++) s-=M[i][j]*x[j]; x[i]=s/(M[i][i]||1e-9); }
  return x;
}
const phi=z=>{ const t=1/(1+.2316419*Math.abs(z)), d=.3989423*Math.exp(-z*z/2), p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-p:p; };
const r1=v=>Math.round(v*10)/10;

function rate(lg,past,upcoming,now){
  const C=CFG[lg], idx=new Map(), meta={};
  const isFbs=c=>lg==="nfl"||(c!=null&&FBS.has(Number(c)));
  const add=(ab,g,side)=>{ if(!idx.has(ab)) idx.set(ab,idx.size);
    const m=meta[ab]=meta[ab]||{team:ab,fbs:isFbs(g[side==="home"?"hc":"ac"]),w:0,l:0,t:0,games:[]};
    m.name=g[side+"Name"]||m.name; m.logo=g[side+"Logo"]||m.logo; m.color=g[side+"Color"]||m.color; m.ap=g[side==="home"?"hr":"ar"]; };
  past.forEach(g=>{ add(g.home,g,"home"); add(g.away,g,"away"); });
  upcoming.forEach(g=>{ add(g.home,g,"home"); add(g.away,g,"away"); });
  const n=idx.size, H=n;                                 // last unknown = home-field advantage
  const wk=t=>Math.max(0,(now-new Date(t).getTime())/(7*864e5));
  const row=(g,y,w)=>({c:[[idx.get(g.home),1],[idx.get(g.away),-1],...(g.neutral?[]:[[H,1]])],y,w});
  const mk=[],rs=[];
  past.forEach(g=>{
    if(g.spread!=null&&!g.noLine) mk.push(row(g,-g.spread,C.mW*Math.pow(.5,wk(g.date)/C.mHalf)));
    const mar=g.hs-g.as; rs.push(row(g,Math.max(-C.cap,Math.min(C.cap,mar)),C.rW*Math.pow(.5,wk(g.date)/C.rHalf)));
    const h=meta[g.home],a=meta[g.away]; if(mar>0){h.w++;a.l++;} else if(mar<0){a.w++;h.l++;} else {h.t++;a.t++;}
    h.games.push({opp:g.away,pf:g.hs,pa:g.as,date:g.date,home:true}); a.games.push({opp:g.home,pf:g.as,pa:g.hs,date:g.date,home:false});
  });
  upcoming.forEach(g=>{ if(g.spread!=null&&!g.noLine&&g.state==="pre") mk.push(row(g,-g.spread,C.mW*1.2)); });
  const pri=[...idx.keys()].map(ab=>lg==="nfl"?PRIOR.nfl:meta[ab].fbs?PRIOR.fbs:PRIOR.fcs); pri.push([lg==="nfl"?1.5:2.5,1]);
  const fit=rows=>{ const x=solve(n+1,rows,pri); const fb=[...idx.keys()].filter(t=>meta[t].fbs); const mu=fb.reduce((s,t)=>s+x[idx.get(t)],0)/fb.length;
    const o={}; idx.forEach((i,t)=>o[t]=x[i]-mu); return {r:o,hfa:x[H]}; };
  const all=fit([...mk,...rs]), mkt=fit(mk), res=fit(rs);
  let teams=[...idx.keys()].filter(t=>meta[t].fbs&&meta[t].games.length).map(t=>{ const m=meta[t], R=all.r[t];
    const opp=m.games.map(x=>all.r[x.opp]); const sos=opp.length?opp.reduce((s,v)=>s+v,0)/opp.length:0;
    const wins=m.games.filter(x=>x.pf>x.pa).sort((a,b)=>all.r[b.opp]-all.r[a.opp]);
    const losses=m.games.filter(x=>x.pf<x.pa).sort((a,b)=>all.r[a.opp]-all.r[b.opp]);
    return {team:t,name:m.name,logo:m.logo,color:m.color,ap:m.ap>=1&&m.ap<=25?m.ap:null,rating:r1(R),market:r1(mkt.r[t]),results:r1(res.r[t]),sos:r1(sos),
      rec:`${m.w}-${m.l}${m.t?"-"+m.t:""}`,
      bestWin:wins[0]?{opp:wins[0].opp,score:`${wins[0].pf}-${wins[0].pa}`,oppRating:r1(all.r[wins[0].opp])}:null,
      worstLoss:losses[0]?{opp:losses[0].opp,score:`${losses[0].pf}-${losses[0].pa}`,oppRating:r1(all.r[losses[0].opp])}:null}; });
  teams.sort((a,b)=>b.rating-a.rating);
  const top=teams[0];
  teams.forEach((t,i)=>{ t.rank=i+1; t.vsTop=r1(top.rating-t.rating); t.winVsTop=i?Math.round(100*phi((t.rating-top.rating)/C.sd)):null;
    t.winVsNext=teams[i+1]?Math.round(100*phi((t.rating-teams[i+1].rating)/C.sd)):null;
    t.tier=C.tiers.find(([g])=>top.rating-t.rating<=g)[1]; });
  return {hfa:r1(all.hfa),games:past.length,marketRows:mk.length,teams};
}

async function buildPower(){
  const now=Date.now();
  const [pastDoc,upDoc,hist]=await Promise.all([scan({past:true}),readJSON("edge/upcoming.json"),readJSON("edge/power-hist.json")]);
  const H=hist||{cfb:{},nfl:{}};
  const out={generatedAt:new Date().toISOString(),leagues:{}};
  for(const lg of ["cfb","nfl"]){
    const past=pastDoc.games.filter(g=>g.lg===lg&&g.state==="post");
    const up=((upDoc&&upDoc.games)||[]).filter(g=>g.lg===lg&&g.state==="pre");
    const R=rate(lg,past,up,now);
    const week=Math.max(0,...past.map(g=>g.wk||0));                 // poll is "after week N"
    const prev=H[lg][week-1]||null;
    R.teams.forEach(t=>{ t.prev=prev&&prev[t.team]||null; t.move=t.prev?t.prev-t.rank:null; });
    H[lg][week]=Object.fromEntries(R.teams.slice(0,40).map(t=>[t.team,t.rank]));
    out.leagues[lg]={...R,week,top:CFG[lg].top,nTeams:R.teams.length,hasPrev:!!prev,teams:R.teams.slice(0,lg==="nfl"?32:40)};
  }
  await writeJSON("edge/power-hist.json",H);
  return out;
}
module.exports={buildPower,rate,solve};
