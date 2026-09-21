const CACHE='triangulo-pwa-20260921-servicos-v4';
const CORE=[
  '/',
  '/index.html',
  '/prestadores.html',
  '/candidatura-prestador.html',
  '/how-it-works.html',
  '/privacy.html',
  '/terms.html',
  '/instalar/',
  '/servicos/',
  '/app.html',
  '/manifest.json',
  '/logo.svg',
  '/logo-v2.svg',
  '/assets/pico-home-hq.webp',
  '/icons/triangulo-blue-192.png',
  '/icons/triangulo-blue-512.png',
  '/icons/triangulo-blue-maskable-512.png',
  '/icons/triangulo-blue-180.png'
];

const PRIVATE_ENTRY_PARAMS=[
  'prestador',
  'booking_token',
  'client_token',
  'request_token',
  'match_token',
  'provider_password_token',
  'stripe',
  'payment'
];

function isPublicServicesClient(clientUrl){
  try{
    const url=new URL(clientUrl);
    if(url.origin!==self.location.origin||url.pathname!=='/servicos/')return false;
    if(PRIVATE_ENTRY_PARAMS.some(key=>url.searchParams.has(key)))return false;
    if(url.hash==='#prestador'||url.hash==='#provider'||url.hash.startsWith('#provider-password='))return false;
    return true;
  }catch{
    return false;
  }
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))
    )
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.clients.claim();
    const keys=await caches.keys();
    await Promise.all(
      keys.filter(key=>key.startsWith('triangulo-')&&key!==CACHE).map(key=>caches.delete(key))
    );

    // If a normal /servicos/ tab is still showing a pre-fix cached onboarding,
    // refresh it once under the new worker. Never touch private/deep-link flows.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(windows.map(client=>{
      if(!isPublicServicesClient(client.url))return Promise.resolve();
      return client.navigate(client.url).catch(()=>{});
    }));
  })());
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
    event.respondWith(networkFirst(request,'/servicos/'));
    return;
  }

  event.respondWith(networkFirst(request));
});
