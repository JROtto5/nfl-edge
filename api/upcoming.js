/* GET /api/upcoming — the model's read on every NFL + college game in the next 7 days.
   Rebuilt at most every 20 minutes (stored in Blob); ?fresh=1 forces a rebuild. */
const {scan}=require("./_scan.js"); const {readJSON,writeJSON}=require("./_store.js");
let building=null;
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","public, s-maxage=120, stale-while-revalidate=600"); res.setHeader("Access-Control-Allow-Origin","*");
  const fresh=req.query&&req.query.fresh;
  const doc=await readJSON("edge/upcoming.json");
  const age=doc&&doc.generatedAt?(Date.now()-new Date(doc.generatedAt))/6e4:999;
  if(doc&&age<20&&!fresh){ res.status(200).json(doc); return; }
  try{
    building=building||scan().then(async d=>{ await writeJSON("edge/upcoming.json",d); return d; }).finally(()=>{ building=null; });
    res.status(200).json(await building);
  }catch(e){ if(doc) res.status(200).json({...doc,stale:true}); else res.status(502).json({error:String(e.message||e).slice(0,200)}); }
};
