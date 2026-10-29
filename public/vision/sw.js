const CACHE='vision-runtime-v1';const HOME=['./index.html','./app.js','./model-worker.js','./style.css','./visual-tags.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(HOME)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET'||req.headers.has('authorization'))return;
 const u=new URL(req.url);const local=u.origin===self.location.origin&&u.pathname.includes('/vision/');
 const provider=u.protocol==='https:'&&(u.hostname==='cdn.jsdelivr.net'||u.hostname==='huggingface.co'||u.hostname.endsWith('.huggingface.co')||u.hostname==='cas-bridge.xethub.hf.co'||u.hostname==='cdn-lfs.hf.co');
 if(!local&&!provider)return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(req);if(hit)return hit;const response=await fetch(req);if(response.ok&&response.type!=='opaque'){e.waitUntil(cache.put(req,response.clone()).catch(()=>{}));}return response;})());
});