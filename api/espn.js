/* GET /api/espn?u=<encoded ESPN url>  -> proxied JSON, cached ~20s here and at the CDN.
   A failure reports WHY, in the body and in a header. It never answers with an empty
   payload that looks like data — a swallowed feed error is how the college slate
   disappeared from this board for a week without anything looking wrong. */
const {fetchDetail,ALLOW}=require("./_espn.js");
module.exports=async (req,res)=>{
  const u=(req.query&&req.query.u)||"";
  if(!ALLOW.test(u)){ res.status(400).json({error:"url not allowed"}); return; }
  const {body,status,reason}=await fetchDetail(u);
  res.setHeader("Cache-Control",/scoreboard/.test(u)?"public, s-maxage=10":"public, s-maxage=20, stale-while-revalidate=60");
  res.setHeader("Access-Control-Allow-Origin","*");
  if(body==null){
    res.setHeader("Cache-Control","no-store");   // never let the CDN hold on to a failure
    res.setHeader("X-Edge-Upstream",String(status||0));
    res.setHeader("X-Edge-Reason",String(reason||"upstream failed").replace(/[^\x20-\x7e]/g,"").slice(0,180));
    res.status(502).json({error:"upstream failed",upstream:status||0,reason:reason||"upstream failed"});
    return;
  }
  if(body._edge) res.setHeader("X-Edge-Source",String(body._edge.src||"espn"));
  res.status(200).json(body);
};
