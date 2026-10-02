/* Anytime-TD engine (NFL + college).
   A player's chance to score = 1 − e^(−λ), where
     λ = team's expected offensive TDs × the player's share of them.
   • Team expected TDs come from the betting line: implied points (total & spread) × k,
     with k (offensive TDs per point) measured from this season's box scores.
   • The player's share splits into rushing and receiving: his share of the team's rush TDs
     and rec TDs, each SHRUNK toward his share of carries / targets (opportunity is far more
     stable than a handful of TDs). Recent games count more (0.85^gamesAgo, last 6 games).
   • Players listed Out / Doubtful / IR are removed and their share is handed to the rest.
   Plays = model chance beats FanDuel's anytime price by a margin. Every play is logged
   with the price at the time and graded from the final box score. */
const {fetchOne}=require("./_espn.js");
const SITE={nfl:"https://site.api.espn.com/apis/site/v2/sports/football/nfl",cfb:"https://site.api.espn.com/apis/site/v2/sports/football/college-football"};
/* tuned on every 2026 game (log-loss): opportunity share dominates (alpha 30), missing the
   last game is a mild penalty, then a pooled Platt calibration pulls the top end in. */
const P={ alpha:{nfl:30,cfb:30}, decay:.85, games:6, absentMult:.8, platt:[-.28,.841] };
const calib=p=>{ const q=Math.min(.98,Math.max(.005,p)), z=P.platt[0]+P.platt[1]*Math.log(q/(1-q)); return 1/(1+Math.exp(-z)); };
async function pool(items,n,fn){ const out=new Array(items.length); let i=0; await Promise.all(Array.from({length:n},async()=>{ while(i<items.length){ const k=i++; try{ out[k]=await fn(items[k]); }catch(e){ out[k]=null; } } })); return out; }

/* ---------- box scores ---------- */
function parseBox(s,lg){
  const comp=((s.header||{}).competitions||[])[0]; if(!comp) return null;
  const st=comp.status&&comp.status.type; if(!st||st.state!=="post") return null;
  const t={};
  comp.competitors.forEach(c=>{ t[c.team.abbreviation]={pts:Number(c.score||0),home:c.homeAway==="home",pl:{}}; });
  const abs=Object.keys(t); abs.forEach((a,i)=>{ t[a].opp=abs[1-i]; });
  ((s.boxscore||{}).players||[]).forEach(tp=>{ const T=t[tp.team.abbreviation]; if(!T) return;
    tp.statistics.forEach(sc=>{ const K=sc.keys||[];
      sc.athletes.forEach(a=>{ const id=a.athlete.id, v={}; K.forEach((k,j)=>v[k]=a.stats[j]);
        const p=T.pl[id]=T.pl[id]||{n:a.athlete.displayName,ra:0,rtd:0,rec:0,tg:0,rctd:0,xtd:0};
        const n=k=>{ const x=parseFloat(v[k]); return Number.isFinite(x)?x:0; };
        if(sc.name==="rushing"){ p.ra+=n("rushingAttempts"); p.rtd+=n("rushingTouchdowns"); }
        else if(sc.name==="receiving"){ p.rec+=n("receptions"); p.tg+=v.receivingTargets!=null?n("receivingTargets"):n("receptions")/.65; p.rctd+=n("receivingTouchdowns"); }
        else if(sc.name==="kickReturns") p.xtd+=n("kickReturnTouchdowns");
        else if(sc.name==="puntReturns") p.xtd+=n("puntReturnTouchdowns");
        else if(sc.name==="interceptions") p.xtd+=n("interceptionTouchdowns");
        else if(sc.name==="defensive") p.xtd+=n("defensiveTouchdowns");
      }); }); });
  // keep only players who touched the ball or scored
  Object.values(t).forEach(T=>{ for(const [id,p] of Object.entries(T.pl)) if(!(p.ra||p.rec||p.tg||p.xtd)) delete T.pl[id]; });
  return {id:String(s.header.id),lg,date:comp.date,t};
}
async function listFinished(lg){
  const cur=((await fetchOne(`${SITE[lg]}/scoreboard?limit=1${lg==="cfb"?"&groups=80":""}`))||{}).week||{};
  const weeks=[]; for(let w=1;w<=(cur.number||1);w++) weeks.push(w);
  const evs=(await pool(weeks,6,w=>fetchOne(`${SITE[lg]}/scoreboard?seasontype=2&week=${w}&dates=2026&limit=500${lg==="cfb"?"&groups=80":""}`))).flatMap(d=>(d&&d.events)||[]);
  return evs.filter(e=>e.competitions[0].status.type.state==="post").map(e=>e.id);
}
/* cache: {id: box|null}. Fetches only games not cached yet. */
async function updateBoxes(cache,limit=400){
  for(const lg of ["nfl","cfb"]){
    const ids=(await listFinished(lg)).filter(id=>cache[id]===undefined).slice(0,limit);
    const got=await pool(ids,16,id=>fetchOne(`${SITE[lg]}/summary?event=${id}`).then(s=>s&&parseBox(s,lg)));
    ids.forEach((id,i)=>{ if(got[i]) cache[id]=got[i]; });
  }
  return cache;
}

/* ---------- model ---------- */
// offensive (rush+rec) TDs per point, measured from the box scores
function tdPerPoint(boxes,lg){ let td=0,pts=0; boxes.forEach(b=>{ if(b.lg!==lg) return; Object.values(b.t).forEach(T=>{ pts+=T.pts; Object.values(T.pl).forEach(p=>td+=p.rtd+p.rctd); }); }); return pts?td/pts:.105; }
function teamHistory(boxes,team,before){
  return boxes.filter(b=>b.t[team]&&new Date(b.date)<before).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,P.games).map(b=>b.t[team]);
}
/* expected TD rate per player for one team, given implied points */
function teamLambdas(hist,implied,k,lg,out=new Set()){
  if(!hist.length) return [];
  const pl={}; let RA=0,TG=0,RTD=0,CTD=0,W=0;
  hist.forEach((T,g)=>{ const w=Math.pow(P.decay,g); W+=w;
    Object.entries(T.pl).forEach(([id,p])=>{ const q=pl[id]=pl[id]||{id,n:p.n,ra:0,tg:0,rtd:0,rctd:0,xtd:0,gp:0,last:false};
      q.ra+=w*p.ra; q.tg+=w*p.tg; q.rtd+=w*p.rtd; q.rctd+=w*p.rctd; q.xtd+=w*p.xtd; q.gp+=w; if(g===0) q.last=true; RA+=w*p.ra; TG+=w*p.tg; RTD+=w*p.rtd; CTD+=w*p.rctd; }); });
  const fr=(RTD+1.5)/(RTD+CTD+3), a=P.alpha[lg], E=implied*k;
  let L=Object.values(pl).map(q=>{
    const raS=RA?q.ra/RA:0, tgS=TG?q.tg/TG:0;
    const rS=(q.rtd+a*raS)/(RTD+a), cS=(q.rctd+a*tgS)/(CTD+a);
    let lam=E*(fr*rS+(1-fr)*cS)+ .25*q.xtd/W;          // return / defensive TDs: small, real
    if(!q.last) lam*=P.absentMult;                       // missed his team's last game
    return {id:q.id,n:q.n,lam,raS,tgS,tds:Math.round((q.rtd+q.rctd+q.xtd)/1)};
  });
  // injuries: drop listed players, hand their share to everyone else
  const before=L.reduce((s,x)=>s+x.lam,0); L=L.filter(x=>!out.has(x.id)&&!out.has(x.n));
  const after=L.reduce((s,x)=>s+x.lam,0); if(after>0&&before>after) L.forEach(x=>x.lam*=Math.min(1.6,before/after));
  return L.map(x=>({...x,raw:1-Math.exp(-x.lam),p:calib(1-Math.exp(-x.lam))})).sort((a,b)=>b.p-a.p);
}
const implied=(g,team)=>{ const h=(g.total-g.spread)/2; return team===g.home?h:g.total-h; };   // spread is the home line

module.exports={calib,parseBox,updateBoxes,listFinished,tdPerPoint,teamHistory,teamLambdas,implied,P,pool,SITE};
