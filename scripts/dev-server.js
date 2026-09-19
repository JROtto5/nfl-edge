/* Local dev server for The Edge Board. Serves the static files and routes the
   /api/* handlers through the real Vercel function code, so a local run exercises
   the same proxy path production does. Not deployed; dev only. */
const http=require("http"), fs=require("fs"), path=require("path"), url=require("url");
const ROOT=path.join(__dirname,"..");
const PORT=Number(process.env.PORT||4399);
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".json":"application/json",".png":"image/png",".webmanifest":"application/manifest+json",
  ".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};

function shim(req,res){
  res.status=c=>{res.statusCode=c;return res;};
  res.json=o=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(o));};
  res.send=b=>res.end(b);
  const q=url.parse(req.url,true).query; req.query=q;
  return res;
}
const handlers={
  "/api/espn":require("../api/espn.js"),
  "/api/bulk":require("../api/bulk.js"),
};
/* Fault injection for verifying failure behaviour: FAIL=cfb|nfl|all makes the proxy
   502 that league's scoreboard calls, which is what the real ESPN break looked like. */
const FAIL=(process.env.FAIL||"").toLowerCase();
const failMatch=u=>FAIL&&/scoreboard/.test(u)&&(FAIL==="all"
  ||(FAIL==="cfb"&&u.includes("college-football"))||(FAIL==="nfl"&&/\/nfl\//.test(u)));
http.createServer(async (req,res)=>{
  const p=url.parse(req.url).pathname;
  if(handlers[p]){
    const raw=url.parse(req.url,true).query.u||"";
    if(failMatch(decodeURIComponent(raw))){ res.statusCode=502; res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({error:"upstream failed",upstream:400,reason:"INJECTED: ESPN 400 Failed to get events endpoint."})); return; }
    try{ await handlers[p](req,shim(req,res)); }catch(e){ res.statusCode=500; res.end(String(e)); } return; }
  if(p.startsWith("/api/")){ res.statusCode=404; res.end("{}"); return; }
  let f=p==="/"?"/index.html":p;
  if(!path.extname(f)) f+=".html";                       // cleanUrls
  const full=path.join(ROOT,path.normalize(f));
  if(!full.startsWith(ROOT)||!fs.existsSync(full)){ res.statusCode=404; res.end("not found"); return; }
  res.setHeader("Content-Type",TYPES[path.extname(full)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  fs.createReadStream(full).pipe(res);
}).listen(PORT,()=>console.log(`edge board dev → http://localhost:${PORT}`));
