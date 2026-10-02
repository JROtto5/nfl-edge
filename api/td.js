/* GET /api/td — anytime-TD board + play log + backtest (see _tdbuild.js). Rebuilt at most every 20 min. */
const {buildTD}=require("./_tdbuild.js"); const {readJSON,writeJSON}=require("./_store.js");
let building=null;
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=1800"); res.setHeader("Access-Control-Allow-Origin","*");
  const doc=await readJSON("edge/td.json"); const age=doc&&doc.generatedAt?(Date.now()-new Date(doc.generatedAt))/6e4:999;
  if(doc&&age<20&&!(req.query&&req.query.fresh)){ res.status(200).json(doc); return; }
  try{ building=building||buildTD().then(async d=>{ await writeJSON("edge/td.json",d); return d; }).finally(()=>{ building=null; }); res.status(200).json(await building); }
  catch(e){ if(doc) res.status(200).json({...doc,stale:true}); else res.status(502).json({error:String(e.message||e).slice(0,200)}); }
};
