/* Self-test for The Edge Board. Runs the page's OWN script in a Node vm against live
   ESPN through the real /api handlers (the method the README describes), then asserts
   the things that have actually broken in production. Dev only; nothing is deployed.

   Run:  node scripts/selftest.js
*/
const fs=require("fs"),path=require("path"),vm=require("vm");
const ROOT=path.join(__dirname,"..");
const {fetchOne,fetchDetail,clampLimit,dayList,ESPN_MAX_LIMIT}=require(path.join(ROOT,"api/_espn.js"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(name,cond,extra="")=>{ if(cond){pass++;console.log(`  PASS  ${name}${extra?"  — "+extra:""}`);} else {fail++;console.log(`  FAIL  ${name}${extra?"  — "+extra:""}`);} };

/* ---- stubbed DOM, same shape the server grader uses ---- */
class El{constructor(){this.dataset={};this.children=[];this.style={};this.hidden=false;
  this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  addEventListener(){}appendChild(c){this.children.push(c);}closest(){return null;}remove(){}
  set innerHTML(v){this._h=v;}get innerHTML(){return this._h||"";}
  set textContent(v){this._t=v;}get textContent(){return this._t||"";}
  querySelectorAll(){return[];}querySelector(){return null;}setAttribute(){}removeAttribute(){}click(){}}

function loadScript(){
  const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
  const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes("const state="));
  const j=script.lastIndexOf("})();");
  return script.slice(0,j)+"\nwindow.__T=()=>({state,bestPlay,topPlays,bestBets,edgesFor,callNumber,playProb,renderBest,invalidateEdges,recomputeExposure,isBusy:()=>detailRunning||detailQueue.length>0});\n"+script.slice(j);
}

async function runPage({fetchOverride}={}){
  const els={};
  const doc={getElementById:id=>els[id]||(els[id]=new El()),addEventListener(){},querySelectorAll:()=>[],
    querySelector:()=>null,documentElement:new El(),createElement:()=>new El(),body:new El(),hidden:false};
  const ls={};
  const realFetch=async(u,o)=>{
    if(typeof u==="string"&&u.startsWith("/api/espn")){
      const t=decodeURIComponent(u.split("u=")[1]);
      const {body,status,reason}=await fetchDetail(t);
      return {ok:!!body,status:body?200:502,headers:{get:k=>k.toLowerCase()==="x-edge-reason"?(reason||null):null},
        json:async()=>body??{error:"upstream failed",upstream:status,reason}};
    }
    if(typeof u==="string"&&u.startsWith("/api/bulk")){
      const urls=JSON.parse(o.body).urls; const res=await Promise.all(urls.map(fetchOne));
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>({results:res})};
    }
    if(typeof u==="string"&&u.startsWith("/api/")) return {ok:false,status:404,headers:{get:()=>null},json:async()=>({})};
    throw new Error("direct ESPN calls are blocked from a browser (CORS) — must not be relied on");
  };
  const sb={document:doc,fetch:fetchOverride?fetchOverride(realFetch):realFetch,
    localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=v;},removeItem:k=>{delete ls[k];}},
    location:{protocol:"https:",hostname:"local.test",hash:"",search:"?static=1"},history:{replaceState(){}},
    matchMedia:()=>({matches:false}),navigator:{serviceWorker:{register:()=>Promise.resolve()}},
    addEventListener(){},console:{log(){},warn(){},error(){}},
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},Date,Math,JSON,Promise,URL,
    Blob:class{},Set,Map,Number,String,Array,Object,RegExp,Error,isNaN,parseFloat,parseInt};
  sb.window=sb; vm.createContext(sb); vm.runInContext(loadScript(),sb);
  const T=sb.window.__T();
  const t0=Date.now();
  while(Date.now()-t0<60000){ await sleep(400); if(T.state.games.length&&!T.isBusy()&&Date.now()-t0>4000) break; }
  return {T,els};
}

(async()=>{
console.log("\n— unit: ESPN quirks we now guard against —");
ok("limit is clamped to ESPN's real max of 500",
   /limit=500/.test(clampLimit("https://x/scoreboard?limit=900&groups=80")),
   clampLimit("https://x/scoreboard?limit=900&groups=80"));
ok("a limit under the cap is left alone", /limit=100(&|$)/.test(clampLimit("https://x/scoreboard?limit=100")));
ok("a 9-day range enumerates 9 days", dayList("20260914","20260922").length===9);
ok("an over-long range is reported, not truncated", dayList("20260801","20260919").length>16);

console.log("\n— upstream: the two ESPN behaviours that broke the board —");
const range=await fetchDetail("https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20260914-20260922&limit=400&groups=80");
ok("the dead date-range query is rebuilt and returns games",
   !!range.body&&range.body.events.length>0, `${range.body?range.body.events.length:0} events, src=${range.body&&range.body._edge&&range.body._edge.src}`);
const wk=await fetchDetail("https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=400&groups=80");
ok("the rebuilt range matches ESPN's own current-week count",
   !!range.body&&!!wk.body&&range.body.events.length>=wk.body.events.length,
   `rebuilt ${range.body&&range.body.events.length} vs week ${wk.body&&wk.body.events.length}`);
const over=await fetchDetail("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20260801-20260919&limit=900");
ok("an unrebuildable range fails loudly with a reason", over.body===null&&/more than 16 days/.test(over.reason||""), over.reason);
const big=await fetchDetail(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=3&seasontype=2&limit=900&groups=80`);
ok("asking over the limit cap no longer silently returns 25 events",
   !!big.body&&big.body.events.length>25, `${big.body?big.body.events.length:0} events`);

console.log("\n— page: both leagues on the board —");
const {T,els}=await runPage();
const S=T.state;
const nfl=S.games.filter(g=>g.lg==="nfl"), cfb=S.games.filter(g=>g.lg==="cfb");
ok("NFL games are on the board", nfl.length>0, `${nfl.length}`);
ok("COLLEGE games are on the board", cfb.length>0, `${cfb.length}`);
ok("no league reported a feed error", Object.keys(S.feedErr||{}).length===0, JSON.stringify(S.feedErr||{}));
ok("college games carry a market number (so they can produce edges)",
   cfb.filter(g=>g.state==="pre"&&g.spread!=null).length>0,
   `${cfb.filter(g=>g.state==="pre"&&g.spread!=null).length} of ${cfb.filter(g=>g.state==="pre").length} upcoming priced`);
ok("season-to-date results survive the limit cap (more than 25 per league)",
   S.results.filter(r=>r.lg==="cfb").length>25 && S.results.filter(r=>r.lg==="nfl").length>0,
   `cfb ${S.results.filter(r=>r.lg==="cfb").length}, nfl ${S.results.filter(r=>r.lg==="nfl").length}`);
// MIN_RATED_GAMES is 3, so early in the season most teams are legitimately unrated.
// The invariant that matters: every team with 3+ completed results IS rated.
const played={};
S.results.forEach(r=>{ played[r.home]=(played[r.home]||0)+1; played[r.away]=(played[r.away]||0)+1; });
const eligible=Object.keys(played).filter(t=>played[t]>=3);
const missing=eligible.filter(t=>!(S.power||{})[t]);
ok("every team with 3+ completed results has a power rating",
   eligible.length>0&&missing.length===0,
   `${eligible.length} eligible, ${Object.keys(S.power||{}).length} rated${missing.length?`, missing ${missing.slice(0,5).join(",")}`:""}`);

console.log("\n— page: a fabricated empty feed must not read as an empty slate —");
const {T:T2}=await runPage({fetchOverride:real=>async(u,o)=>{
  // exactly what the old service worker did: answer every failed feed with 200 {"events":[]}
  if(typeof u==="string"&&u.startsWith("/api/espn")) return {ok:true,status:200,headers:{get:()=>null},json:async()=>({events:[]})};
  return real(u,o);
}});
ok("a fabricated empty feed is reported as a feed error, not shown as 'no games'",
   Object.keys(T2.state.feedErr||{}).length>0, JSON.stringify(T2.state.feedErr||{}));

console.log("\n— best bets —");
const bb=T.bestBets();
ok("bestBets() exists and returns a ranked list", Array.isArray(bb.rows), `${bb.rows.length} qualifying`);
ok("every listed bet clears the stated bar", bb.rows.every(r=>r.p>=bb.bar), `bar ${bb.bar}%`);
ok("the list is ranked by estimated hit rate", bb.rows.every((r,i)=>i===0||bb.rows[i-1].p>=r.p));
ok("no contested play is presented as a bet", bb.rows.every(r=>!r.contested));
ok("every bet carries its evidence and the source of its number",
   bb.rows.every(r=>r.cats.length>0&&r.why&&r.src), bb.rows.length?`e.g. ${bb.rows[0].why}`:"n/a");
ok("every bet names the market number it is priced against",
   bb.rows.every(r=>r.call&&/\d/.test(r.call)), bb.rows.length?`e.g. ${bb.rows[0].call}`:"n/a");

ok("only staked plays are presented as bets; the rest are separated",
   bb.rows.every(r=>r.inCut)&&bb.rows.every(r=>r.stake.dollars>=0), `${bb.rows.length} staked, ${bb.unstaked.length} clear-but-unstaked, ${bb.near.length} below the bar`);

console.log("\n— best bets: it has to be allowed to say nothing —");
// Same live slate, but with every market number removed: the signals that need a
// spread or a total cannot fire, so the page must say so rather than pad the list.
const gamesBackup=T.state.games;
T.state.games=gamesBackup.filter(g=>g.lg==="nfl").map(g=>({...g,spread:null,total:null,mlHome:null,mlAway:null}));
T.state.detail={}; T.state.league="nfl"; T.invalidateEdges(); T.recomputeExposure();
const empty=T.bestBets();
T.renderBest();
const html=els.board?els.board.innerHTML:"";
ok("with no market numbers, nothing qualifies", empty.rows.length===0, `${empty.rows.length} rows`);
ok('it says "Nothing worth betting" instead of padding the list',
   /Nothing worth betting in nfl today/i.test(html)&&!/class="toprow bbrow"/.test(html));
ok("it explains the bar it failed, and does not blame missing data",
   /clears the bar/.test(html)&&/not a gap in the data/.test(html));
T.state.games=gamesBackup; T.state.league="all"; T.invalidateEdges(); T.recomputeExposure();

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
})().catch(e=>{ console.error("harness error:",e); process.exit(1); });
