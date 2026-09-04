/* GET /api/espn?u=<encoded ESPN url>  -> proxied JSON, cached ~20s here and at the CDN. */
const {fetchOne,ALLOW}=require("./_espn.js");
module.exports=async (req,res)=>{
  const u=(req.query&&req.query.u)||"";
  if(!ALLOW.test(u)){ res.status(400).json({error:"url not allowed"}); return; }
  const body=await fetchOne(u);
  res.setHeader("Cache-Control",/scoreboard/.test(u)?"public, s-maxage=10":"public, s-maxage=20, stale-while-revalidate=60");
  res.setHeader("Access-Control-Allow-Origin","*");
  if(body==null){ res.status(502).json({error:"upstream failed"}); return; }
  res.status(200).json(body);
};
