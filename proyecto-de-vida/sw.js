// SPDX-License-Identifier: AGPL-3.0-only
const CACHE='proyecto-de-vida-v1-habit-periods';
const ASSETS=['./','index.html','styles.css','flame-theme.css','planning.css','planning.mjs','reminders.mjs','app.mjs','core.mjs','life-flame.mjs','assets/life-flame-loop.mp4','assets/life-flame-poster.webp','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest','vendor/lifeos.mjs','vendor/neohabit.mjs','vendor/super-productivity.mjs','vendor/beaverhabits.mjs'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))));self.skipWaiting();});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('proyecto-de-vida-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function cachedAsset(request){
 const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:true});
 if(!cached)return fetch(request);
 // Mobile media players seek with byte ranges, including during offline loops.
 const range=request.headers.get('range');
 if(range&&new URL(request.url).pathname.endsWith('.mp4')){
  const bytes=await cached.arrayBuffer(),size=bytes.byteLength,match=/^bytes=(\d*)-(\d*)$/.exec(range);
  let start=match?.[1]?Number(match[1]):0,end=match?.[2]?Number(match[2]):size-1;
  if(match&&!match[1]&&match[2]){start=Math.max(0,size-Number(match[2]));end=size-1;}
  if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  end=Math.min(end,size-1);
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}});
 }
 return cached;
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // Read this version's cache explicitly: a previous worker may still be retiring.
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./',self.registration.scope)))));
 else event.respondWith(cachedAsset(event.request));
});
