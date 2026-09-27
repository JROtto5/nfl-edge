/* Runs The Edge Board's OWN front-end engine inside Node, against live ESPN, with a
   stubbed DOM. Same code path as a phone — signals, calls, line-freezing, fading,
   grading, alerts — so the server record can never disagree with what a viewer saw.
   The engine's localStorage is seeded from the stored document and read back after. */
const fs=require("fs"),path=require("path"),vm=require("vm");
const {fetchOne,fetchDetail}=require("./_espn.js");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function loadScript(){
  let html=null;
  try{ html=fs.readFileSync(path.join(process.cwd(),"board.html"),"utf8"); }catch(e){}
  if(!html){ const r=await fetch("https://nfl-edge-kappa.vercel.app/board.html",{cache:"no-store"}); html=await r.text(); }
  const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes("const state="));
  const j=script.lastIndexOf("})();");
  return script.slice(0,j)+"\nwindow.__ENG=()=>({state,recordStrongEdges,gradeRecords,migrateRecords,invalidateEdges,bestPlay,callNumber,isBusy:()=>detailRunning||detailQueue.length>0});\n"+script.slice(j);
}
class El{constructor(){this.dataset={};this.children=[];this.style={};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};this.hidden=false;}
  addEventListener(){}appendChild(c){this.children.push(c);}closest(){return null;}remove(){}set innerHTML(v){this._h=v;}get innerHTML(){return this._h||"";}
  set textContent(v){this._t=v;}get textContent(){return this._t||"";}querySelectorAll(){return[];}querySelector(){return null;}setAttribute(){}removeAttribute(){}click(){}}
async function runEngine({records=[],alerts=[],pastOU={},timeoutMs=40000}={}){
  const script=await loadScript();
  const els={}; const doc={getElementById:id=>els[id]||(els[id]=new El()),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,documentElement:new El(),createElement:()=>new El(),body:new El(),hidden:false};
  const ls={"edgeboard-record-v1":JSON.stringify(records),"edgeboard-alerts-v1":JSON.stringify(alerts),"edgeboard-pastou-v1":JSON.stringify(pastOU),"edgeboard-record-migr":"1","edgeboard-intro-read":"1"};
  const fakeFetch=async(u,o)=>{
    // headers must be present: the page reads X-Edge-Reason off a failed proxy call
    const hdrs=h=>({get:k=>h[k.toLowerCase()]??null});
    if(typeof u==="string"&&u.startsWith("/api/espn")){ const t=decodeURIComponent(u.split("u=")[1]); const {body,status,reason}=await fetchDetail(t);
      return {ok:!!body,status:body?200:502,headers:hdrs({"x-edge-reason":reason||"",...(body&&body._edge?{"x-edge-source":body._edge.src}:{})}),json:async()=>body??{error:"upstream failed",upstream:status,reason}}; }
    if(typeof u==="string"&&u.startsWith("/api/bulk")){ const urls=JSON.parse(o.body).urls; const res=await Promise.all(urls.map(fetchOne)); return {ok:true,status:200,headers:hdrs({}),json:async()=>({results:res})}; }
    return fetch(u,o);
  };
  const sb={document:doc,fetch:fakeFetch,localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=v;},removeItem:k=>{delete ls[k];}},
    location:{protocol:"https:",hostname:"nfl-edge-kappa.vercel.app",hash:""},history:{replaceState(){}},matchMedia:()=>({matches:false}),
    navigator:{serviceWorker:{register:()=>Promise.resolve()}},addEventListener(){},console:{log(){},warn(){},error(){}},
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},Date,Math,JSON,Promise,URL,Blob:class{},Set,Map,Number,String,Array,Object,RegExp,Error};
  sb.window=sb; vm.createContext(sb); vm.runInContext(script,sb);
  const E=sb.window.__ENG();
  const t0=Date.now();
  while(Date.now()-t0<timeoutMs){ await sleep(400); if(E.state.games.length&&!E.isBusy()&&Date.now()-t0>2500) break; }
  E.invalidateEdges(); E.migrateRecords(); E.recordStrongEdges(); E.gradeRecords();
  const games=E.state.games;
  const calls=games.filter(g=>g.state!=="post").map(g=>{ const b=E.bestPlay(g); return b?{game:g.name,kick:g.date,live:g.state==="in",call:E.callNumber(g,b.dir,g.state==="in"),p:b.p,cats:b.cats,cut:!!b.cut}:null; }).filter(Boolean).sort((a,b)=>b.p-a.p);
  return {games:games.length,live:games.filter(g=>g.state==="in").length,final:games.filter(g=>g.state==="post").length,detailsDone:!E.isBusy(),ms:Date.now()-t0,
    records:JSON.parse(ls["edgeboard-record-v1"]||"[]"),alerts:JSON.parse(ls["edgeboard-alerts-v1"]||"[]"),pastOU:JSON.parse(ls["edgeboard-pastou-v1"]||"{}"),calls};
}
module.exports={runEngine};
