/* Web Push to subscribed phones. Subscriptions live in one Blob document whose path
   includes PUSH_SECRET — the store is public-read, so the unguessable path is what
   keeps the endpoints private (they are capability URLs themselves). */
const webpush=require("web-push"); const {readJSON,writeJSON}=require("./_store.js");
const DOC=()=>`push/${process.env.PUSH_SECRET||"nosecret"}.json`;
function configured(){ return !!(process.env.VAPID_PUBLIC&&process.env.VAPID_PRIVATE&&process.env.PUSH_SECRET); }
function setup(){ webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:otto@phoneburner.com",process.env.VAPID_PUBLIC,process.env.VAPID_PRIVATE); }
async function loadSubs(){ return (await readJSON(DOC()))||{subs:[]}; }
async function saveSubs(doc){ return writeJSON(DOC(),doc); }
async function sendTo(sub,payload){
  try{ await webpush.sendNotification(sub,JSON.stringify(payload),{TTL:3600}); return {ok:true}; }
  catch(e){ return {ok:false,status:e.statusCode||0,msg:String(e.message||e).slice(0,120)}; }
}
/* Send the alerts that are new since the last run. Many at once collapse into one summary. */
async function pushAlerts(newAlerts){
  if(!configured()||!newAlerts.length) return {sent:0,subs:0,pruned:0,skipped:!configured()};
  setup(); const doc=await loadSubs(); if(!doc.subs.length) return {sent:0,subs:0,pruned:0};
  const payloads=newAlerts.length>4
    ?[{title:`The Edge Board — ${newAlerts.length} updates`,body:newAlerts.slice(0,3).map(a=>a.text).join(" · ")+" …",tag:"edge-summary",url:"/#alerts"}]
    :newAlerts.map(a=>({title:a.kind==="result"?"Result":a.kind==="live"?"Live bet":a.kind==="fade"?"Call faded":a.kind==="steam"?"Line move":"New call",body:a.text,tag:a.id,url:"/#alerts"}));
  let sent=0,pruned=0; const keep=[];
  for(const sub of doc.subs){
    let dead=false;
    for(const p of payloads){ const r=await sendTo(sub,p); if(r.ok) sent++; else if(r.status===404||r.status===410){ dead=true; break; } }
    if(dead) pruned++; else keep.push(sub);
  }
  if(pruned){ doc.subs=keep; await saveSubs(doc); }
  return {sent,subs:doc.subs.length,pruned};
}
module.exports={configured,setup,loadSubs,saveSubs,sendTo,pushAlerts};
