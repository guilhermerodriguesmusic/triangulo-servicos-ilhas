const CACHE='triangulo-pwa-20260923-v1-0-rc89';
const CORE=[
  '/',
  '/index.html',
  '/prestadores.html',
  '/candidatura-prestador.html',
  '/how-it-works.html',
  '/sobre-nos.html',
  '/privacy.html',
  '/terms.html',
  '/instalar/',
  '/servicos/',
  '/servicos/app-shell.css',
  '/servicos/app-shell.js',
  '/servicos/provider-area.css',
  '/servicos/provider-area.js',
  '/servicos/request-photos.css',
  '/servicos/request-photos.js',
  '/app.html',
  '/manifest.json',
  '/logo.svg',
  '/logo-v2.svg',
  '/assets/pico-home-hq.webp',
  '/icon-192.png',
  '/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png'
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

function isServicesPath(url){
  return url.origin===self.location.origin && url.pathname==='/servicos/';
}

function hasPrivateEntryParams(url){
  return PRIVATE_ENTRY_PARAMS.some(key=>url.searchParams.has(key));
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // Precache independently so one optional asset cannot break the whole PWA install.
    await Promise.all(CORE.map(async url=>{
      try{
        const request=new Request(url,{cache:'reload'});
        const response=await fetch(request);
        if(response&&response.ok)await cache.put(url,response);
      }catch(err){
        console.warn('TRIANGULO precache skipped',url,err);
      }
    }));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys.filter(key=>key.startsWith('triangulo-')&&key!==CACHE).map(key=>caches.delete(key))
    );
    // Claim open tabs without forcing a visible reload/navigation.
    await self.clients.claim();
  })());
});

async function networkFirst(request,fallback,cacheKey=request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      cache.put(cacheKey,response.clone()).catch(()=>{});
    }
    return response;
  }catch{
    return (await caches.match(cacheKey)) || (await caches.match(request)) || (fallback?await caches.match(fallback):undefined) || Response.error();
  }
}

async function privateNavigation(request,fallback){
  try{
    return await fetch(request,{cache:'no-store'});
  }catch{
    return (fallback?await caches.match(fallback):undefined) || Response.error();
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  try{
    const response=await fetch(request);
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch{
    return Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    // Never persist private request/session tokens in Cache Storage.
    if(isServicesPath(url)&&hasPrivateEntryParams(url)){
      event.respondWith(privateNavigation(request,'/servicos/'));
      return;
    }
    // /servicos/ is one static document; query strings are client-side state.
    if(isServicesPath(url)){
      event.respondWith(networkFirst(request,'/servicos/','/servicos/'));
      return;
    }
    // Keep public pages on the same route when offline (including ?lang=pt/en).
    event.respondWith(networkFirst(request,url.pathname,url.pathname));
    return;
  }

  // Installed Android app: serve static assets from local cache whenever possible.
  if(['image','style','script','font','manifest'].includes(request.destination)||url.pathname==='/manifest.json'){
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
