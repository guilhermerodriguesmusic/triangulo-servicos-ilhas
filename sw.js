const CACHE='triangulo-pwa-20260919-2';
const CORE=[
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))
    )
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>Promise.all(
        keys.filter(key=>key.startsWith('triangulo-')&&key!==CACHE).map(key=>caches.delete(key))
      ))
    ])
  );
});

async function networkFirst(request,fallback){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch{
    return (await caches.match(request)) || (fallback?await caches.match(fallback):undefined) || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,'/app.html'));
    return;
  }

  event.respondWith(networkFirst(request));
});
