/* Tiny JSON-document layer over Vercel Blob. One document per path. Blob URLs are
   CDN-cached (60s minimum), so reads add a cache-busting query. */
const {put,list}=require("@vercel/blob");
async function readJSON(pathname){
  try{
    const l=await list({prefix:pathname,limit:5});
    const b=l.blobs.find(x=>x.pathname===pathname); if(!b) return null;
    const r=await fetch(`${b.url}?v=${Date.now()}`,{cache:"no-store"}); if(!r.ok) return null;
    return await r.json();
  }catch(e){ return null; }
}
async function writeJSON(pathname,obj){
  const r=await put(pathname,JSON.stringify(obj),{access:"public",addRandomSuffix:false,allowOverwrite:true,contentType:"application/json",cacheControlMaxAge:60});
  return r.url;
}
module.exports={readJSON,writeJSON};
