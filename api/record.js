/* GET /api/record — the shared, server-graded record every device reads. */
const {readJSON}=require("./_store.js");
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","public, s-maxage=30, stale-while-revalidate=60");
  res.setHeader("Access-Control-Allow-Origin","*");
  const doc=await readJSON("edge/record.json");
  if(!doc){ res.status(200).json({updatedAt:null,records:[],alerts:[],calls:[]}); return; }
  const {pastOU,...rest}=doc; res.status(200).json(rest);
};
