const TRIANGULO_PHOTO_MAX=5;
const TRIANGULO_PHOTO_MAX_BYTES=2500000;
const TRIANGULO_PHOTO_MAX_DIM=1600;
const trianguloPhotoSelections={matching:[],direct:[]};

function requestPhotoPickerMarkup(prefix='request'){
  return '<div class="request-photo-picker" data-photo-picker="'+prefix+'">'
    +'<div class="request-photo-head"><div><b data-pt="Fotografias · opcional" data-en="Photos · optional">'+(lang==='pt'?'Fotografias · opcional':'Photos · optional')+'</b>'
    +'<small data-pt="Ajudam o prestador a perceber melhor o trabalho e a dar um orçamento mais certo." data-en="They help the provider understand the job and give a more accurate quote.">'+(lang==='pt'?'Ajudam o prestador a perceber melhor o trabalho e a dar um orçamento mais certo.':'They help the provider understand the job and give a more accurate quote.')+'</small></div>'
    +'<button type="button" class="request-photo-add" data-photo-add="'+prefix+'">＋ '+(lang==='pt'?'Adicionar fotos':'Add photos')+'</button></div>'
    +'<input id="'+prefix+'PhotoInput" class="request-photo-input" type="file" accept="image/*" multiple hidden>'
    +'<div id="'+prefix+'PhotoPreview" class="request-photo-preview" hidden></div>'
    +'<div id="'+prefix+'PhotoNote" class="request-photo-note">'+(lang==='pt'?'Até 5 fotos · removemos metadados e localização antes do envio.':'Up to 5 photos · metadata and location are removed before upload.')+'</div>'
    +'</div>';
}

function photoKeyForPrefix(prefix){return prefix==='matchingRequest'?'matching':'direct'}
function initRequestPhotoPicker(prefix,key=photoKeyForPrefix(prefix)){
  const input=document.getElementById(prefix+'PhotoInput');
  const add=document.querySelector('[data-photo-add="'+prefix+'"]');
  if(!input||!add)return;
  add.onclick=()=>input.click();
  input.onchange=()=>{
    const existing=trianguloPhotoSelections[key]||[];
    const incoming=[...(input.files||[])];
    const room=Math.max(0,TRIANGULO_PHOTO_MAX-existing.length);
    if(incoming.length>room)toast(lang==='pt'?'Podes enviar no máximo 5 fotografias.':'You can upload up to 5 photos.');
    trianguloPhotoSelections[key]=existing.concat(incoming.slice(0,room));
    input.value='';
    renderRequestPhotoPicker(prefix,key);
  };
  renderRequestPhotoPicker(prefix,key);
}
function renderRequestPhotoPicker(prefix,key=photoKeyForPrefix(prefix)){
  const box=document.getElementById(prefix+'PhotoPreview');
  const note=document.getElementById(prefix+'PhotoNote');
  const files=trianguloPhotoSelections[key]||[];
  if(!box)return;
  box.innerHTML='';
  box.hidden=!files.length;
  files.forEach((file,index)=>{
    const item=document.createElement('div');item.className='request-photo-thumb';
    const img=document.createElement('img');img.alt=lang==='pt'?'Fotografia selecionada':'Selected photo';
    const url=URL.createObjectURL(file);img.src=url;img.onload=()=>URL.revokeObjectURL(url);
    const remove=document.createElement('button');remove.type='button';remove.className='request-photo-remove';remove.setAttribute('aria-label',lang==='pt'?'Remover fotografia':'Remove photo');remove.textContent='×';
    remove.onclick=()=>{trianguloPhotoSelections[key].splice(index,1);renderRequestPhotoPicker(prefix,key)};
    item.append(img,remove);box.appendChild(item);
  });
  if(note)note.textContent=files.length
    ?(lang==='pt'?files.length+' de 5 fotografias selecionadas':files.length+' of 5 photos selected')
    :(lang==='pt'?'Até 5 fotos · removemos metadados e localização antes do envio.':'Up to 5 photos · metadata and location are removed before upload.');
}
function refreshRequestPhotoPickers(){
  if(document.getElementById('matchingRequestPhotoPreview'))renderRequestPhotoPicker('matchingRequest','matching');
  if(document.getElementById('bookRequestPhotoPreview'))renderRequestPhotoPicker('bookRequest','direct');
}
function resetRequestPhotos(key){
  trianguloPhotoSelections[key]=[];
  const prefix=key==='matching'?'matchingRequest':'bookRequest';
  renderRequestPhotoPicker(prefix,key);
}
function selectedRequestPhotoCount(key){return (trianguloPhotoSelections[key]||[]).length}

async function decodePhoto(file){
  if('createImageBitmap' in window){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      return {width:bitmap.width,height:bitmap.height,draw:(ctx,w,h)=>ctx.drawImage(bitmap,0,0,w,h),close:()=>bitmap.close()};
    }catch{}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),close:()=>URL.revokeObjectURL(url)});
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('unsupported_image'))};
    img.src=url;
  });
}
function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_encode_failed')),'image/jpeg',quality))}
async function compressRequestPhoto(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('not_image');
  const decoded=await decodePhoto(file);
  try{
    let maxDim=TRIANGULO_PHOTO_MAX_DIM,quality=.84,blob=null;
    for(let attempt=0;attempt<4;attempt++){
      const scale=Math.min(1,maxDim/Math.max(decoded.width,decoded.height));
      const w=Math.max(1,Math.round(decoded.width*scale)),h=Math.max(1,Math.round(decoded.height*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);decoded.draw(ctx,w,h);
      blob=await canvasBlob(canvas,quality);
      canvas.width=1;canvas.height=1;
      if(blob.size<=TRIANGULO_PHOTO_MAX_BYTES)return blob;
      maxDim=Math.max(900,Math.round(maxDim*.8));quality=Math.max(.58,quality-.09);
    }
    if(blob&&blob.size<=TRIANGULO_PHOTO_MAX_BYTES)return blob;
    throw new Error('image_too_large');
  }finally{decoded.close?.()}
}

async function photoEdge(body){
  const {data,error}=await db.functions.invoke('request-photos',{body});
  if(error)throw error;
  if(!data||data.ok!==true)throw new Error(data&&data.error?data.error:'photo_api_error');
  return data;
}
async function uploadRequestPhotos(clientToken,key,statusEl=null){
  const files=[...(trianguloPhotoSelections[key]||[])];
  if(!files.length)return {uploaded:0,failed:0};
  let uploaded=0,failed=0;
  for(let i=0;i<files.length;i++){
    let ticket=null;
    try{
      if(statusEl)statusEl.textContent=lang==='pt'?'A preparar fotografia '+(i+1)+' de '+files.length+'…':'Preparing photo '+(i+1)+' of '+files.length+'…';
      const blob=await compressRequestPhoto(files[i]);
      ticket=await photoEdge({action:'ticket',client_token:clientToken,bytes:blob.size,content_type:'image/jpeg'});
      if(statusEl)statusEl.textContent=lang==='pt'?'A enviar fotografia '+(i+1)+' de '+files.length+'…':'Uploading photo '+(i+1)+' of '+files.length+'…';
      const up=await db.storage.from('request-photos').uploadToSignedUrl(ticket.path,ticket.upload_token,blob,{contentType:'image/jpeg'});
      if(up.error)throw up.error;
      await photoEdge({action:'complete',client_token:clientToken,photo_id:ticket.photo_id,path:ticket.path,bytes:blob.size});
      uploaded++;
    }catch(e){
      console.error('request photo upload',e);failed++;
      if(ticket&&ticket.photo_id)photoEdge({action:'discard',client_token:clientToken,photo_id:ticket.photo_id}).catch(()=>{});
    }
  }
  if(statusEl)statusEl.textContent='';
  return {uploaded,failed};
}

async function fetchRequestPhotos({access,token,request_kind=null,request_id=null}){
  try{
    const data=await photoEdge({action:'list',access,token,request_kind,request_id});
    return Array.isArray(data.items)?data.items:[];
  }catch(e){console.error('request photos list',e);return []}
}
function photoGalleryHtml(items){
  if(!items||!items.length)return '';
  return '<div class="request-photo-gallery">'+items.map((x,i)=>'<a href="'+escapeHtml(x.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+(lang==='pt'?'Abrir fotografia ':'Open photo ')+(i+1)+'"><img src="'+escapeHtml(x.url)+'" alt="'+(lang==='pt'?'Fotografia do pedido':'Request photo')+'" loading="lazy"></a>').join('')+'</div>';
}
async function loadProviderRequestPhotos(token,container){
  if(!container||!token){if(container)container.hidden=true;return}
  container.hidden=true;container.innerHTML='';
  const items=await fetchRequestPhotos({access:'provider_request',token});
  if(!items.length)return;
  container.innerHTML='<b class="request-photo-gallery-title">'+(lang==='pt'?'Fotografias do pedido':'Request photos')+'</b>'+photoGalleryHtml(items);
  container.hidden=false;
}
async function hydrateProviderDashboardPhotos(sessionToken){
  if(!sessionToken)return;
  const slots=[...document.querySelectorAll('[data-provider-photo-kind][data-provider-photo-id]')];
  await Promise.all(slots.map(async slot=>{
    const items=await fetchRequestPhotos({
      access:'provider_session',token:sessionToken,
      request_kind:slot.dataset.providerPhotoKind,
      request_id:slot.dataset.providerPhotoId
    });
    if(!items.length)return;
    slot.innerHTML='<b class="request-photo-gallery-title">📷 '+(lang==='pt'?'Fotografias do pedido':'Request photos')+'</b>'+photoGalleryHtml(items);
    slot.hidden=false;
  }));
}

window.requestPhotoPickerMarkup=requestPhotoPickerMarkup;
window.initRequestPhotoPicker=initRequestPhotoPicker;
window.refreshRequestPhotoPickers=refreshRequestPhotoPickers;
window.resetRequestPhotos=resetRequestPhotos;
window.selectedRequestPhotoCount=selectedRequestPhotoCount;
window.uploadRequestPhotos=uploadRequestPhotos;
window.fetchRequestPhotos=fetchRequestPhotos;
window.loadProviderRequestPhotos=loadProviderRequestPhotos;
window.hydrateProviderDashboardPhotos=hydrateProviderDashboardPhotos;

const generalMount=document.getElementById('matchingRequestPhotosMount');
if(generalMount){generalMount.innerHTML=requestPhotoPickerMarkup('matchingRequest');initRequestPhotoPicker('matchingRequest','matching')}
