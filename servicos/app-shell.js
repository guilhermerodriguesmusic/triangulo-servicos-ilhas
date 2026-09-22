function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200)}
let networkWasOffline=!navigator.onLine,networkHideTimer=null;
function syncNetworkStatus(){
 const el=$('#networkStatus');if(!el)return;
 clearTimeout(networkHideTimer);
 if(!navigator.onLine){
   networkWasOffline=true;el.classList.remove('online');el.hidden=false;
   el.textContent=lang==='pt'?'Sem ligação — a mostrar o que está guardado.':'Offline — showing saved information.';
   return;
 }
 if(networkWasOffline){
   networkWasOffline=false;el.classList.add('online');el.hidden=false;
   el.textContent=lang==='pt'?'Ligação restabelecida ✓':'Back online ✓';
   networkHideTimer=setTimeout(()=>{el.hidden=true;el.classList.remove('online')},1800);
 }else el.hidden=true;
}
window.addEventListener('offline',syncNetworkStatus);window.addEventListener('online',()=>{syncNetworkStatus();loadProviders(activeSearchQuery,activeServiceGroup)});
syncNetworkStatus();
function syncVisualViewport(){
 const h=Math.round(window.visualViewport?.height||window.innerHeight);
 document.documentElement.style.setProperty('--tri-visual-vh',h+'px');
}
syncVisualViewport();
window.visualViewport?.addEventListener('resize',syncVisualViewport);
window.visualViewport?.addEventListener('scroll',syncVisualViewport);
window.addEventListener('orientationchange',()=>setTimeout(syncVisualViewport,120));
document.addEventListener('focusin',e=>{
 if(!window.matchMedia('(max-width:620px)').matches)return;
 const sheet=e.target.closest?.('.sheet.open');
 if(!sheet||!e.target.matches('input,textarea,select'))return;
 setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),180);
});
function syncInstalledUi(){const b=$('#installBtn');if(b&&isStandaloneApp())b.hidden=true}
syncInstalledUi();window.addEventListener('appinstalled',syncInstalledUi);
$('#installBtn').onclick=async()=>{
 if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true){toast(lang==='pt'?'O TRIÂNGULO já está instalado ✓':'TRIÂNGULO is already installed ✓');return}
 if(deferredInstallPrompt){
  try{
   await deferredInstallPrompt.prompt();
   await deferredInstallPrompt.userChoice;
   deferredInstallPrompt=null;
   return;
  }catch{}
 }
 location.href='/instalar/';
};
