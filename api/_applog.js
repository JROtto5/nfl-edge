/* The app's own record: every completed 2026 game run through verdict.js (the exact rules
   the Today tab uses), with each team's form built only from games BEFORE it, graded
   against the closing line. So History = "what this app would have played". */
const {scan}=require("./_scan.js"); const V=require("../verdict.js");
async function buildLog(){
  const d=await scan({past:true});
  const plays=[];
  d.games.filter(g=>!g.noLine).forEach(g=>{
    V.playsOf(g).forEach(x=>{ if(!x.r||x.r==="live") return;
      plays.push({id:g.id+"|"+x.lab,lg:g.lg,date:g.date,away:g.away,home:g.home,awayLogo:g.awayLogo,homeLogo:g.homeLogo,as:g.as,hs:g.hs,
        pick:x.lab,conf:Math.round(x.conf),amt:x.amt,price:x.price,result:x.r,kind:x.v.side&&x.lab.startsWith(x.v.side.team)?"side":"total"}); });
  });
  plays.sort((a,b)=>new Date(a.date)-new Date(b.date));
  return {generatedAt:new Date().toISOString(),games:d.games.length,plays};
}
module.exports={buildLog};
