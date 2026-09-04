/* Shared server-side ESPN fetcher for The Edge Board.
   The phone used to make 60+ direct ESPN calls per load. This runs on Vercel, does
   the fetching once, and keeps a short in-memory cache per function instance so
   every viewer in the same ~20s window shares one upstream hit. Live data is never
   held longer than that — a stale line is worse than a slow one. */
const ALLOW=/^https:\/\/(site\.api\.espn\.com|sports\.core\.api\.espn\.com)\//;
const TTL_MS=10000;   // scores must feel live; 10s is the most we hold anything
const MAX_ENTRIES=600;
const cache=new Map();            // url -> {t, body}

async function fetchOne(u){
  if(typeof u!=="string"||!ALLOW.test(u)) return null;
  const hit=cache.get(u);
  if(hit&&Date.now()-hit.t<TTL_MS) return hit.body;
  try{
    // NO custom headers: ESPN's Akamai edge returns 403 to a custom or spoofed
    // browser user-agent from a cloud IP, and 200 to the plain default fetch.
    const r=await fetch(u);
    if(!r.ok) return null;
    const body=await r.json();
    cache.set(u,{t:Date.now(),body});
    if(cache.size>MAX_ENTRIES){ cache.delete(cache.keys().next().value); }
    return body;
  }catch(e){ return null; }
}
module.exports={fetchOne,ALLOW};
