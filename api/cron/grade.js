/* Scheduled grader (pinged every 10 min by GitHub Actions). Loads the shared record,
   runs the engine against live data, stores the updated record + alerts + calls. */
const {runEngine}=require("../_engine.js"); const {readJSON,writeJSON}=require("../_store.js"); const {pushAlerts}=require("../_push.js");
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(!process.env.CRON_KEY||(req.query&&req.query.key)!==process.env.CRON_KEY){ res.status(401).json({error:"unauthorized"}); return; }
  const steps=[]; const t0=Date.now(); const mark=n=>steps.push(`${n}@${Date.now()-t0}ms`);
  let prev,out;
  try{
    prev=(await readJSON("edge/record.json"))||{records:[],alerts:[],pastOU:{}}; mark("read");
    out=await runEngine({records:prev.records||[],alerts:prev.alerts||[],pastOU:prev.pastOU||{}}); mark("engine");
  }catch(e){ res.status(500).json({error:String(e&&e.stack||e).slice(0,1500),steps,node:process.version}); return; }
  const lastPushTs=prev.lastPushTs||(Date.now()-15*6e4);          // first ever run: only the last 15 minutes
  const fresh=out.alerts.filter(a=>a.ts>lastPushTs);
  let push={sent:0}; try{ push=await pushAlerts(fresh); mark("push"); }catch(e){ push={error:String(e.message||e).slice(0,120)}; }
  const doc={updatedAt:new Date().toISOString(),games:out.games,live:out.live,final:out.final,detailsDone:out.detailsDone,ms:out.ms,
    records:out.records,alerts:out.alerts.slice(0,200),calls:out.calls,pastOU:out.pastOU,lastPushTs:fresh.length?Math.max(...fresh.map(a=>a.ts)):lastPushTs};
  try{ await writeJSON("edge/record.json",doc); mark("write"); }catch(e){ res.status(500).json({error:"write: "+String(e&&e.message||e),steps}); return; }
  res.status(200).json({ok:true,steps,updatedAt:doc.updatedAt,games:out.games,live:out.live,final:out.final,detailsDone:out.detailsDone,ms:out.ms,
    push,records:doc.records.length,open:doc.records.filter(r=>!r.graded).length,graded:doc.records.filter(r=>r.graded).length,alerts:doc.alerts.length,calls:doc.calls.length});
};
