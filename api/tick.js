/* Public, rate-limited backstop for the scheduler: any open board calls this on load and
   every poll. If the shared record is older than 8 minutes it runs the grader; otherwise
   it returns immediately. No key needed because it can only ever do the scheduled job. */
const {readJSON}=require("./_store.js");
let running=false, lastRun=0;   // the blob read is CDN-cached ~60s, so also remember our own last run
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store"); res.setHeader("Access-Control-Allow-Origin","*");
  const doc=await readJSON("edge/record.json");
  const age=doc&&doc.updatedAt?(Date.now()-new Date(doc.updatedAt).getTime())/6e4:999;
  if(age<8||Date.now()-lastRun<8*6e4){ res.status(200).json({ran:false,ageMin:Math.round(age*10)/10}); return; }
  if(running){ res.status(200).json({ran:false,busy:true,ageMin:Math.round(age)}); return; }
  running=true; lastRun=Date.now();
  try{
    const grade=require("./cron/grade.js");
    const fake={h:{},setHeader(){},status(c){this.c=c;return this;},json(b){this.b=b;return this;}};
    await grade({query:{key:process.env.CRON_KEY}},fake);
    res.status(200).json({ran:true,ageMinBefore:Math.round(age),result:fake.b&&{games:fake.b.games,records:fake.b.records,graded:fake.b.graded,push:fake.b.push}});
  }catch(e){ res.status(500).json({ran:false,error:String(e.message||e).slice(0,200)}); }
  finally{ running=false; }
};
