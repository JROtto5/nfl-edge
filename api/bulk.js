/* POST /api/bulk  {urls:[...]}  -> {results:[json|null,...]} aligned with the input.
   One round-trip for a whole batch of game summaries instead of one per game. */
const {fetchOne}=require("./_espn.js");
const MAX=40;
function readBody(req){
  if(req.body&&typeof req.body==="object") return Promise.resolve(req.body);
  return new Promise(resolve=>{
    let s=""; req.on("data",c=>{ s+=c; if(s.length>200000) s=s.slice(0,200000); });
    req.on("end",()=>{ try{ resolve(JSON.parse(s||"{}")); }catch(e){ resolve({}); } });
    req.on("error",()=>resolve({}));
  });
}
module.exports=async (req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method!=="POST"){ res.status(405).json({error:"POST only"}); return; }
  const body=await readBody(req);
  const urls=Array.isArray(body.urls)?body.urls.slice(0,MAX):[];
  const results=await Promise.all(urls.map(fetchOne));
  res.status(200).json({results});
};
