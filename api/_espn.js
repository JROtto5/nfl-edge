/* Shared server-side ESPN fetcher for The Edge Board.
   The phone used to make 60+ direct ESPN calls per load. This runs on Vercel, does
   the fetching once, and keeps a short in-memory cache per function instance so
   every viewer in the same ~20s window shares one upstream hit. Live data is never
   held longer than that — a stale line is worse than a slow one.

   This is now the ONLY way the app can reach ESPN. ESPN's Akamai edge returns 403
   with no Access-Control-Allow-Origin to browser-shaped requests (real UA + Origin +
   Sec-Fetch headers), so the client's old "fall back to calling ESPN directly"
   safety net cannot work from a browser any more — it fails CORS every time. Two
   consequences: (1) every repair for a broken upstream shape belongs HERE, and
   (2) a failure here has to be reported, never turned into an empty list. */
const ALLOW=/^https:\/\/(site\.api\.espn\.com|sports\.core\.api\.espn\.com)\//;
const TTL_MS=10000;   // scores must feel live; 10s is the most we hold anything
const MAX_ENTRIES=600;
const cache=new Map();            // url -> {t, body}

/* ESPN's scoreboard `limit` tops out at 500. Ask for more and it does NOT clamp to
   the max — it silently drops the parameter and hands back its default of 25 events.
   On a 75-game college Saturday that is indistinguishable from a quiet slate, and it
   is why season-to-date results (which asked for limit=900) were being built from 25
   games a week. Clamp it so no caller can trip over that again. */
const ESPN_MAX_LIMIT=500;
const clampLimit=u=>u.replace(/([?&]limit=)(\d+)/g,(m,p,n)=>p+Math.min(ESPN_MAX_LIMIT,Number(n)||ESPN_MAX_LIMIT));

const isScoreboard=u=>/\/scoreboard(\?|$)/.test(u);
const rangeOf=u=>{ const m=/[?&]dates=(\d{8})-(\d{8})/.exec(u); return m?{a:m[1],b:m[2]}:null; };

/* One raw upstream call. Returns {body,status,reason} — never throws, never lies:
   body is null unless ESPN actually answered with JSON. */
async function fetchRaw(u){
  try{
    // NO custom headers: ESPN's Akamai edge returns 403 to a custom or spoofed
    // browser user-agent from a cloud IP, and 200 to the plain default fetch.
    const r=await fetch(u);
    if(!r.ok){
      let msg=""; try{ msg=(await r.text()).slice(0,200); }catch(e){}
      return {body:null,status:r.status,reason:`ESPN ${r.status}${msg?` ${msg}`:""}`};
    }
    return {body:await r.json(),status:200,reason:null};
  }catch(e){ return {body:null,status:0,reason:`fetch failed: ${e&&e.message||e}`}; }
}

/* Rebuild a date range that ESPN no longer serves.
   ESPN stopped answering `scoreboard?dates=YYYYMMDD-YYYYMMDD` — it returns
   HTTP 400 {"code":400,"message":"Failed to get events endpoint."} for BOTH nfl and
   college-football (first seen 2026-09-17). Single-date queries still answer, and
   day-by-day reassembly is exact: for college week 3, 20260917+18+19 gives the same
   75 events the week query does. Capped so one request can never fan out into a
   season's worth of fetches — a longer span is reported, not quietly truncated. */
const MAX_RANGE_DAYS=16;
const CONCURRENCY=6;
function dayList(a,b){
  const mk=s=>Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8));
  const ymd=t=>{ const d=new Date(t); return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`; };
  const end=mk(b); const out=[];
  for(let t=mk(a); t<=end; t+=864e5){ out.push(ymd(t)); if(out.length>MAX_RANGE_DAYS) return out; }
  return out;
}
async function rebuildRange(u,a,b){
  const days=dayList(a,b);
  if(days.length>MAX_RANGE_DAYS)
    return {body:null,status:0,reason:`dates=${a}-${b} spans more than ${MAX_RANGE_DAYS} days; not rebuilt day-by-day`};
  const urls=days.map(d=>u.replace(/([?&]dates=)\d{8}-\d{8}/,`$1${d}`));
  const parts=[];
  for(let i=0;i<urls.length;i+=CONCURRENCY) parts.push(...await Promise.all(urls.slice(i,i+CONCURRENCY).map(fetchRaw)));
  const ok=parts.filter(p=>p.body&&Array.isArray(p.body.events));
  if(!ok.length) return {body:null,status:parts[0]?parts[0].status:0,
    reason:`rebuilt ${days.length}-day range but every day failed (${parts[0]?parts[0].reason:"no response"})`};
  const seen=new Set(), events=[];
  ok.forEach(p=>p.body.events.forEach(e=>{ if(e&&e.id!=null&&!seen.has(e.id)){ seen.add(e.id); events.push(e); } }));
  // report the week/season of the day nearest today, which is the one the board means
  const today=Date.now();
  const mk=s=>Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8));
  let meta=null, bestGap=Infinity;
  parts.forEach((p,i)=>{ if(!p.body||!p.body.week) return; const gap=Math.abs(mk(days[i])-today); if(gap<bestGap){ bestGap=gap; meta=p.body; } });
  meta=meta||ok[0].body;
  return {status:200,reason:null,body:{
    leagues:meta.leagues,season:meta.season,week:meta.week,events,
    _edge:{src:"rebuilt-by-day",days:days.length,daysOk:ok.length,daysFailed:days.length-ok.length,
      why:"ESPN no longer serves dates=START-END scoreboard queries"}}};
}

/* The fetcher every caller uses. Returns {body,status,reason}; body is null on failure.
   Scoreboard answers are stamped with `_edge.src` so a client can tell a real,
   server-verified empty slate apart from something that only looks like one. */
async function fetchDetail(u){
  if(typeof u!=="string"||!ALLOW.test(u)) return {body:null,status:0,reason:"url not allowed"};
  const url=isScoreboard(u)?clampLimit(u):u;
  const hit=cache.get(url);
  if(hit&&Date.now()-hit.t<TTL_MS) return {body:hit.body,status:200,reason:null,cached:true};
  let res=await fetchRaw(url);
  const rng=rangeOf(url);
  if(!res.body&&rng&&isScoreboard(url)) res=await rebuildRange(url,rng.a,rng.b);
  if(!res.body) return res;
  if(isScoreboard(url)&&res.body&&typeof res.body==="object"&&!res.body._edge) res.body._edge={src:"espn"};
  cache.set(url,{t:Date.now(),body:res.body});
  if(cache.size>MAX_ENTRIES){ cache.delete(cache.keys().next().value); }
  return res;
}

/* Back-compat shape used by bulk.js and the engine: body or null. */
async function fetchOne(u){ return (await fetchDetail(u)).body; }

module.exports={fetchOne,fetchDetail,ALLOW,ESPN_MAX_LIMIT,clampLimit,dayList,MAX_RANGE_DAYS};
