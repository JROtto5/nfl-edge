/* Builds the TD board: model every NFL + college game in the next 4 days, attach FanDuel
   anytime-TD prices, pick plays, freeze them into the log at the price shown, grade them
   from the final box score, and recompute the backtest over every 2026 game. */
const T=require("./_td.js"); const {fetchOne}=require("./_espn.js"); const {readJSON,writeJSON}=require("./_store.js");
const FD={nfl:"nfl",cfb:"ncaaf"}, AK="FhMFpcPWXMeyZxOx", FDB="https://sbapi.nj.sportsbook.fanduel.com/api";
const RULE={minP:.25, minEdge:.05, perGame:3, stake:5};      // TD plays are long odds → $5 a play
const OUT=/^(out|doubtful|injured reserve|suspension|suspended)/i;
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g,"").replace(/[^a-z0-9 ]/g,"").replace(/\bstate\b/g,"st").replace(/\s+/g," ").trim();
const dec=a=>a>0?1+a/100:1+100/Math.abs(a);
async function fdJSON(u){ try{ const r=await fetch(u); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } }

async function fdPrices(games){
  const out={}, status={};
  for(const lg of ["nfl","cfb"]){
    const page=await fdJSON(`${FDB}/content-managed-page?page=CUSTOM&customPageId=${FD[lg]}&_ak=${AK}&timezone=America%2FNew_York`);
    status[lg]=page?"ok":"unavailable"; if(!page) continue;
    const evs=Object.values((page.attachments||{}).events||{}).filter(e=>/ @ /.test(e.name));
    const mine=games.filter(g=>g.lg===lg);
    const pairs=[];
    for(const e of evs){ const [A,H]=e.name.split(" @ ").map(norm);
      const g=mine.find(g=>g.hn.includes(H)&&g.an.includes(A))||mine.find(g=>g.hn.includes(A)&&g.an.includes(H));
      if(g) pairs.push([g,e.eventId]); }
    await T.pool(pairs,8,async([g,id])=>{ const d=await fdJSON(`${FDB}/event-page?_ak=${AK}&eventId=${id}&tab=td-scorer-props`);
      const m=Object.values(((d||{}).attachments||{}).markets||{}).find(m=>m.marketName==="Any Time Touchdown Scorer"); if(!m) return;
      const px={}; m.runners.forEach(r=>{ if(r.runnerStatus&&r.runnerStatus!=="ACTIVE") return; const a=(((r.winRunnerOdds||{}).americanDisplayOdds)||{}).americanOdds; if(a!=null) px[norm(r.runnerName)]=a; });
      out[g.id]=px; });
  }
  return {prices:out,status};
}

function backtest(boxes,lines){
  const res={nfl:[],cfb:[]};
  for(const b of boxes){ const g=lines[b.id]; if(!g) continue; const k=T.tdPerPoint(boxes,b.lg);
    for(const team of Object.keys(b.t)){ const hist=T.teamHistory(boxes,team,new Date(b.date)); if(hist.length<2) continue;
      T.teamLambdas(hist,T.implied(g,team),k,b.lg).forEach((x,i)=>{ const a=b.t[team].pl[x.id]; res[b.lg].push({p:x.p,y:a&&(a.rtd+a.rctd+a.xtd)>0?1:0,rank:i}); }); } }
  const out={};
  for(const lg of ["nfl","cfb"]){ const R=res[lg]; if(!R.length){ out[lg]=null; continue; }
    const bins=[[0,.1],[.1,.2],[.2,.3],[.3,.4],[.4,.5],[.5,.6],[.6,1]].map(([lo,hi])=>{ const B=R.filter(r=>r.p>=lo&&r.p<hi); return {lo,hi,n:B.length,pred:B.length?Math.round(1000*B.reduce((s,r)=>s+r.p,0)/B.length)/10:null,hit:B.length?Math.round(1000*B.reduce((s,r)=>s+r.y,0)/B.length)/10:null}; });
    const top=R.filter(r=>r.rank===0), t3=R.filter(r=>r.rank<3), hi=R.filter(r=>r.p>=.5);
    const rate=A=>({n:A.length,hit:A.reduce((s,r)=>s+r.y,0),pred:Math.round(1000*A.reduce((s,r)=>s+r.p,0)/Math.max(1,A.length))/10});
    out[lg]={players:R.length,bins,top:rate(top),top3:rate(t3),over50:rate(hi)};
  }
  return out;
}

async function buildTD(){
  const now=Date.now();
  const [boxDoc,up,past,log]=await Promise.all([readJSON("edge/tdbox.json"),readJSON("edge/upcoming.json"),readJSON("edge/pastfull.json"),readJSON("edge/tdlog.json")]);
  const cache=boxDoc||{}; const n0=Object.keys(cache).length;
  await T.updateBoxes(cache,150);
  if(Object.keys(cache).length!==n0) await writeJSON("edge/tdbox.json",cache);
  const boxes=Object.values(cache);
  const k={nfl:T.tdPerPoint(boxes,"nfl"),cfb:T.tdPerPoint(boxes,"cfb")};
  // upcoming games with a line, kicking off in the next 4 days
  const slate=((up&&up.games)||[]).filter(g=>g.state==="pre"&&!g.noLine&&g.total!=null&&g.spread!=null&&new Date(g.date).getTime()-now<4*864e5);
  const sums=await T.pool(slate,12,g=>fetchOne(`${T.SITE[g.lg]}/summary?event=${g.id}`));
  const games=slate.map((g,i)=>{ const s=sums[i]||{}; const outSet={};
    (s.injuries||[]).forEach(t=>{ const ab=t.team&&t.team.abbreviation; (t.injuries||[]).forEach(j=>{ if(OUT.test(j.status||"")){ (outSet[ab]=outSet[ab]||new Set()).add(String(j.athlete&&j.athlete.id)); outSet[ab].add(j.athlete&&j.athlete.displayName); } }); });
    const comp=((s.header||{}).competitions||[])[0]||{}; const tm=ab=>((comp.competitors||[]).find(c=>c.team&&c.team.abbreviation===ab)||{}).team||{};
    const H=tm(g.home),A=tm(g.away);
    return {...g,outSet,hn:[H.displayName,H.location,H.shortDisplayName,g.homeName].filter(Boolean).map(norm),an:[A.displayName,A.location,A.shortDisplayName,g.awayName].filter(Boolean).map(norm)}; });
  const {prices,status}=await fdPrices(games);
  const L=log||{plays:{}}; const plays=[];
  const board=games.map(g=>{
    const teams=[g.away,g.home].map(team=>{ const hist=T.teamHistory(boxes,team,new Date(g.date));
      const pl=T.teamLambdas(hist,T.implied(g,team),k[g.lg],g.lg,g.outSet[team]||new Set()).slice(0,8).map(x=>{
        const a=prices[g.id]?prices[g.id][norm(x.n)]:undefined; const imp=a!=null?1/dec(a):null;
        return {id:x.id,n:x.n,p:Math.round(x.p*1000)/10,price:a??null,imp:imp!=null?Math.round(imp*1000)/10:null,edge:imp!=null?Math.round((x.p-imp)*1000)/10:null,raS:Math.round(x.raS*100),tgS:Math.round(x.tgS*100)}; });
      return {team,implied:Math.round(T.implied(g,team)*10)/10,games:hist.length,players:pl}; });
    // plays: model beats FanDuel's price by the margin, best edges first, max 3 a game
    const cand=teams.flatMap(t=>t.players.map(p=>({...p,team:t.team}))).filter(p=>p.price!=null&&p.p>=RULE.minP*100&&p.edge>=RULE.minEdge*100).sort((a,b)=>b.edge-a.edge).slice(0,RULE.perGame);
    cand.forEach(p=>{ const key=g.id+"|"+p.id; const rec=L.plays[key];
      if(!rec) L.plays[key]={key,gid:g.id,lg:g.lg,date:g.date,away:g.away,home:g.home,team:p.team,pid:p.id,n:p.n,price:p.price,p:p.p,edge:p.edge,amt:RULE.stake,firstTs:now,result:null};
      plays.push({...p,gid:g.id,lg:g.lg,date:g.date,away:g.away,home:g.home,awayLogo:g.awayLogo,homeLogo:g.homeLogo,logged:L.plays[key]}); });
    return {id:g.id,lg:g.lg,date:g.date,away:g.away,home:g.home,awayLogo:g.awayLogo,homeLogo:g.homeLogo,awayName:g.awayName,homeName:g.homeName,total:g.total,spread:g.spread,priced:!!prices[g.id],teams};
  });
  // grade: win if he scored, void if he didn't play (FanDuel voids those), else loss
  Object.values(L.plays).forEach(r=>{ if(r.result) return; const b=cache[r.gid]; if(!b) return; const T_=b.t[r.team]; const a=T_&&T_.pl[r.pid];
    r.result=!a?"void":(a.rtd+a.rctd+a.xtd)>0?"win":"loss"; r.won=r.result==="win"?Math.round(r.amt*(dec(r.price)-1)*100)/100:r.result==="loss"?-r.amt:0; });
  await writeJSON("edge/tdlog.json",L);
  const lines={}; Object.entries(past||{}).forEach(([id,o])=>{ if(o&&o.total!=null&&o.spread!=null) lines[id]=o; });
  const graded=Object.values(L.plays).filter(r=>r.result).sort((a,b)=>new Date(b.date)-new Date(a.date));
  board.sort((a,b)=>new Date(a.date)-new Date(b.date)); plays.sort((a,b)=>b.edge-a.edge);
  return {generatedAt:new Date().toISOString(),rule:RULE,fanduel:status,k,games:board,plays,history:graded.slice(0,200),backtest:backtest(boxes,lines)};
}
module.exports={buildTD,norm};
