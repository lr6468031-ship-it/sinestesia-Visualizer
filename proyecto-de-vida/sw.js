// SPDX-License-Identifier: AGPL-3.0-only
const CACHE='proyecto-de-vida-v1';
const ASSETS=['./','index.html','styles.css','app.mjs','core.mjs','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest','vendor/lifeos.mjs','vendor/neohabit.mjs','vendor/super-productivity.mjs','vendor/beaverhabits.mjs'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))));self.skipWaiting();});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('proyecto-de-vida-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // Read this version's cache explicitly: a previous worker may still be retiring.
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./',self.registration.scope)))));
 else event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true})).then(cached=>cached||fetch(event.request)));
});
