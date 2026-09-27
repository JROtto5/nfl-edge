/* Upcoming-slate scanner: runs the board's fitted totals model (and the rule signals
   that held up) over EVERY NFL and college game kicking off in the next 7 days —
   not just the current Mon–Sun window — so next week's early lines show up on Sunday.
   Features mirror feats_total() / modelTotalProb() exactly (see index.html). */
const {fetchOne}=require("./_espn.js");
const {readJSON,writeJSON}=require("./_store.js");
const LOGIT=require("./_logit.json");
const FBS=new Set([1,4,5,8,9,12,15,17,18,37,151]);
const SITE={nfl:"https://site.api.espn.com/apis/site/v2/sports/football/nfl",cfb:"https://site.api.espn.com/apis/site/v2/sports/football/college-football"};
const CORE={nfl:"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl",cfb:"https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"};
const rk=r=>typeof r==="number"&&r>=1&&r<=25;
async function pool(items,n,fn){ const out=new Array(items.length); let i=0; await Promise.all(Array.from({length:n},async()=>{ while(i<items.length){ const k=i++; try{ out[k]=await fn(items[k]); }catch(e){ out[k]=null; } } })); return out; }
async function weekEvents(lg,wk){
  const d=await fetchOne(`${SITE[lg]}/scoreboard?seasontype=2&week=${wk}&dates=2026&limit=500${lg==="cfb"?"&groups=80":""}`);
  return ((d&&d.events)||[]).map(e=>{ const c=e.competitions[0]; const h=c.competitors.find(x=>x.homeAway==="home"), a=c.competitors.find(x=>x.homeAway==="away");
    return {id:e.id,lg,wk,date:e.date,state:c.status.type.state,home:h.team.abbreviation,away:a.team.abbreviation,homeLogo:h.team.logo,awayLogo:a.team.logo,
      hs:Number(h.score||0),as:Number(a.score||0),hr:(h.curatedRank||{}).current,ar:(a.curatedRank||{}).current,hc:h.team.conferenceId,ac:a.team.conferenceId,
      neutral:!!c.neutralSite,indoor:!!(c.venue||{}).indoor}; });
}
function parseOdds(d){
  for(const it of ((d&&d.items)||[])){
    if(/live/i.test((it.provider||{}).name||"")||it.overUnder==null) continue;
    const num=v=>{ if(v==null) return null; if(v==="EVEN") return 0; const n=parseFloat(String(v).replace("+","")); return Number.isNaN(n)?null:n; };
    return {total:it.overUnder,spread:it.spread,book:(it.provider||{}).name,overOdds:it.overOdds??null,underOdds:it.underOdds??null,
      openTotal:num(((it.open||{}).total||{}).alternateDisplayValue),openSpread:num((((it.homeTeamOdds||{}).open||{}).pointSpread||{}).alternateDisplayValue)};
  }
  return null;
}
async function scan(){
  const t0=Date.now(), now=Date.now(), horizon=now+7*864e5;
  const cache=(await readJSON("edge/pastodds.json"))||{};           // finished games: closing totals never change
  const out={generatedAt:new Date().toISOString(),games:[]};
  for(const lg of ["nfl","cfb"]){
    const cur=((await fetchOne(`${SITE[lg]}/scoreboard?limit=1${lg==="cfb"?"&groups=80":""}`))||{}).week||{};
    const cw=cur.number||1;
    const weeks=[]; for(let w=1;w<=cw+1;w++) weeks.push(w);
    const all=(await pool(weeks,6,w=>weekEvents(lg,w))).flat().filter(Boolean);
    const past=all.filter(g=>g.state==="post").sort((a,b)=>new Date(a.date)-new Date(b.date));
    const up=all.filter(g=>g.state==="pre"&&new Date(g.date).getTime()<=horizon);
    // closing totals for the last 3 games of every team in the upcoming slate (cached)
    const teams=new Set(up.flatMap(g=>[g.home,g.away]));
    const needIds=new Set(); const byTeam={};
    past.forEach(g=>{ [g.home,g.away].forEach(t=>{ (byTeam[t]=byTeam[t]||[]).push(g); }); });
    teams.forEach(t=>(byTeam[t]||[]).slice(-3).forEach(g=>{ if(cache[g.id]===undefined) needIds.add(g.id); }));
    const fetched=await pool([...needIds],16,id=>fetchOne(`${CORE[lg]}/events/${id}/competitions/${id}/odds`).then(d=>[id,parseOdds(d)]));
    fetched.forEach(x=>{ if(x) cache[x[0]]=x[1]?x[1].total:null; });
    const upOdds=await pool(up,16,g=>fetchOne(`${CORE[lg]}/events/${g.id}/competitions/${g.id}/odds`).then(parseOdds));
    // kickoff weather for games in the next 3 days (forecasts further out are noise)
    const wx=await pool(up,16,g=>(new Date(g.date).getTime()-now<3*864e5&&!g.indoor)?fetchOne(`${SITE[lg]}/summary?event=${g.id}`).then(d=>{ const w=((d||{}).gameInfo||{}).weather||{}; return {gust:w.gust??null,precip:w.precipitation??null,temp:w.temperature??null}; }):null);
    const M=LOGIT[lg];
    up.forEach((g,i)=>{
      const o=upOdds[i]; if(!o||o.total==null||o.spread==null){ out.games.push({...g,noLine:true}); return; }
      const hist=t=>(byTeam[t]||[]).map(x=>{ const mine=x.home===t?x.hs:x.as, theirs=x.home===t?x.as:x.hs; const tot=x.hs+x.as; const ln=cache[x.id]; return {pf:mine,pa:theirs,tot,ou:ln==null?null:(tot>ln?"O":tot<ln?"U":"P")}; });
      const h=hist(g.home), a=hist(g.away);
      const av=(L,k)=>L.length?L.reduce((s,x)=>s+x[k],0)/L.length:26;
      const tot=o.total, sp=o.spread, hImp=(tot-sp)/2, aImp=tot-hImp, dogImp=Math.min(hImp,aImp);
      const last=L=>L[L.length-1]||{};
      const fcs=lg==="cfb"&&((g.hc!=null&&!FBS.has(Number(g.hc)))||(g.ac!=null&&!FBS.has(Number(g.ac))));
      const f={total:(tot-50)/10,abs_spread:Math.abs(sp)/10,hi60:tot>=60?1:0,lo45:tot<=45?1:0,dog_imp:(dogImp-15)/10,dogimp10:dogImp<=10?1:0,
        both_r:rk(g.hr)&&rk(g.ar)?1:0,h_ppg:(av(h,"pf")-26)/10,a_ppg:(av(a,"pf")-26)/10,h_pa:(av(h,"pa")-26)/10,a_pa:(av(a,"pa")-26)/10,
        h_lastU:last(h).ou==="U"?1:0,a_lastU:last(a).ou==="U"?1:0,h_lasttot:((last(h).tot??50)-50)/15,a_lasttot:((last(a).tot??50)-50)/15,
        h_ostreak:h.length>=3&&h.slice(-3).every(x=>x.ou==="O")?1:0,a_ostreak:a.length>=3&&a.slice(-3).every(x=>x.ou==="O")?1:0,
        wk:g.wk/10,fcs:fcs?1:0,neutral:g.neutral?1:0};
      f.both_lastU=f.h_lastU*f.a_lastU;
      let z=M.w[0]; M.keys.forEach((k,j)=>{ z+=M.w[j+1]*(f[k]??0); });
      const p=1/(1+Math.exp(-z)), conf=Math.max(p,1-p), mdir=p>=.5?"OVER":"UNDER";
      out.games.push({...g,...o,dogImp:Math.round(dogImp*10)/10,model:{dir:mdir,conf:Math.round(conf*1000)/10},
        form:{home:{n:h.length,ppg:Math.round(av(h,"pf")*10)/10,pa:Math.round(av(h,"pa")*10)/10,lastOU:last(h).ou||null},away:{n:a.length,ppg:Math.round(av(a,"pf")*10)/10,pa:Math.round(av(a,"pa")*10)/10,lastOU:last(a).ou||null}},
        weather:wx[i]||null,
        flags:{windy:!!(wx[i]&&wx[i].gust>=20),dogimp10:lg==="cfb"&&dogImp<=10,bothunder:!!(f.both_lastU&&h.length&&a.length),rankclash:!!f.both_r,hightotal:lg==="cfb"&&tot>=60,fcs}});
    });
  }
  const keys=Object.keys(cache); if(keys.length>4000) keys.slice(0,keys.length-4000).forEach(k=>delete cache[k]);
  await writeJSON("edge/pastodds.json",cache);
  out.ms=Date.now()-t0;
  out.games.sort((a,b)=>new Date(a.date)-new Date(b.date));
  return out;
}
module.exports={scan};
