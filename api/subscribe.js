/* GET  /api/subscribe            -> {publicKey}   (VAPID public key for the browser)
   POST /api/subscribe            {subscription}  -> stores it; ?test=1 also sends a test push
   POST /api/subscribe            {unsubscribe:endpoint} -> removes it */
const P=require("./_push.js");
function readBody(req){ if(req.body&&typeof req.body==="object") return Promise.resolve(req.body); return new Promise(r=>{ let s=""; req.on("data",c=>s+=c); req.on("end",()=>{ try{ r(JSON.parse(s||"{}")); }catch(e){ r({}); } }); req.on("error",()=>r({})); }); }
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(!P.configured()){ res.status(503).json({error:"push not configured"}); return; }
  if(req.method==="GET"){ res.status(200).json({publicKey:process.env.VAPID_PUBLIC}); return; }
  if(req.method!=="POST"){ res.status(405).json({error:"GET or POST"}); return; }
  const body=await readBody(req); const doc=await P.loadSubs();
  if(body.unsubscribe){ const n=doc.subs.length; doc.subs=doc.subs.filter(s=>s.endpoint!==body.unsubscribe); await P.saveSubs(doc); res.status(200).json({ok:true,removed:n-doc.subs.length}); return; }
  const sub=body.subscription; if(!sub||!sub.endpoint||!/^https:\/\//.test(sub.endpoint)){ res.status(400).json({error:"bad subscription"}); return; }
  if(!doc.subs.some(s=>s.endpoint===sub.endpoint)){ doc.subs.push({endpoint:sub.endpoint,keys:sub.keys,expirationTime:sub.expirationTime||null,ts:Date.now()}); if(doc.subs.length>50) doc.subs=doc.subs.slice(-50); await P.saveSubs(doc); }
  let test=null;
  if(req.query&&req.query.test){ P.setup(); test=await P.sendTo(sub,{title:"The Edge Board",body:"Push is on. New calls, live bets, fades and results will reach this phone even when the app is closed.",tag:"edge-test",url:"/#alerts"}); }
  res.status(200).json({ok:true,subs:doc.subs.length,test});
};
