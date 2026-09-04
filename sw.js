/* The Edge Board — service worker.
   Strategy is deliberately split:
   - APP SHELL (html/css/icons): stale-while-revalidate, so the app opens instantly
     from the home screen and still updates in the background.
   - LIVE DATA (ESPN API): NETWORK ONLY, never cached. Serving a stale odds line or
     an old weather reading would be worse than showing nothing — a bettor acting on
     a cached number is exactly the failure this whole tool exists to prevent.
*/
const SHELL="edge-shell-v5";
const SHELL_FILES=["/","/index.html","/intro","/intro.html","/manifest.webmanifest","/icon-192.png","/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(SHELL).then(c=>c.addAll(SHELL_FILES.map(u=>new Request(u,{cache:"reload"})))).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    const c=cs.find(x=>"focus" in x); return c?c.focus():self.clients.openWindow("/");
  }));
});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);

  // our own API is live data too — never touched by the cache
  if(url.origin===location.origin&&url.pathname.startsWith("/api/")) return;
  // never cache live sports data — stale odds are actively harmful
  if(url.hostname.endsWith("espn.com")||url.hostname.includes("espncdn")){
    e.respondWith(fetch(req).catch(()=>new Response(JSON.stringify({events:[]}),{headers:{"Content-Type":"application/json"}})));
    return;
  }
  // fonts: cache-first (they never change and shouldn't block first paint)
  if(url.hostname.includes("fonts.g")){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
      const copy=r.clone(); caches.open(SHELL).then(c=>c.put(req,copy)); return r;
    }).catch(()=>hit)));
    return;
  }
  // the page itself: NETWORK FIRST (3s), cache only as the offline fallback. Serving
  // the cached page first meant a new deploy showed up one open late on phones.
  if(url.origin===location.origin&&(req.mode==="navigate"||url.pathname==="/"||url.pathname.endsWith(".html")||url.pathname==="/intro")){
    e.respondWith((async()=>{
      const cached=caches.match(req);
      try{
        const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),3000);
        const r=await fetch(req,{signal:ctrl.signal}); clearTimeout(t);
        if(r&&r.ok){ const copy=r.clone(); caches.open(SHELL).then(c=>c.put(req,copy)); return r; }
      }catch(err){}
      return (await cached)||fetch(req);
    })());
    return;
  }
  // other app-shell files (icons, manifest): serve cached immediately, refresh in the background
  if(url.origin===location.origin){
    e.respondWith(caches.match(req).then(hit=>{
      const net=fetch(req).then(r=>{
        const copy=r.clone(); caches.open(SHELL).then(c=>c.put(req,copy)); return r;
      }).catch(()=>hit);
      return hit||net;
    }));
  }
});
