let providerAccountData=null,providerSessionToken=store.get('tri_provider_session','');

function paShow(id){
  ['paLoading','paSignedOut','paPasswordSet','paNotProvider','paDashboard'].forEach(x=>{const el=$('#'+x);if(el)el.hidden=x!==id});
  const view=$('#providerAreaView');
  if(view){
    view.classList.remove('pa-state-loading','pa-state-signedout','pa-state-password','pa-state-missing','pa-state-dashboard');
    const map={paLoading:'pa-state-loading',paSignedOut:'pa-state-signedout',paPasswordSet:'pa-state-password',paNotProvider:'pa-state-missing',paDashboard:'pa-state-dashboard'};
    if(map[id])view.classList.add(map[id]);
  }
}
function providerStatusLabel(status){
  if(status==='active')return lang==='pt'?'Perfil ativo':'Profile active';
  return lang==='pt'?'Perfil pausado':'Profile paused';
}
function providerBookingStatus(status,paymentStatus){
  if(status==='quoted')return lang==='pt'?'Orçamento enviado · aguarda cliente':'Quote sent · awaiting customer';
  if(status==='confirmed'){
    if(paymentsLive&&paymentStatus!=='paid')return lang==='pt'?'Aceite · pagamento pendente':'Accepted · payment pending';
    return lang==='pt'?'Confirmado':'Confirmed';
  }
  const pt={requested:'Novo pedido',declined:'Recusado',expired:'Expirado',completed:'Concluído',cancelled:'Cancelado'};
  const en={requested:'New request',declined:'Declined',expired:'Expired',completed:'Completed',cancelled:'Cancelled'};
  return (lang==='pt'?pt:en)[status]||status;
}
async function openProviderArea(){
  document.title=lang==='pt'?'Área do prestador — TRIÂNGULO':'Provider area — TRIÂNGULO';
  $('#splash').classList.add('hidden');
  $('#mainShell').classList.add('hidden');
  $('#providerRequestView').hidden=true;
  $('#providerAreaView').hidden=false;
  await loadProviderAccount();
}
function closeProviderArea(){
  $('#providerAreaView').hidden=true;
  document.title=lang==='pt'?'TRIÂNGULO — Serviços locais nas ilhas':'TRIÂNGULO — Local services across the islands';
  history.replaceState({},'',location.pathname);
  $('#splash').classList.add('hidden');$('#mainShell').classList.remove('hidden');
  runSearch(activeSearchQuery,activeServiceGroup);
}
async function loadProviderAccount(){
  providerSessionToken=store.get('tri_provider_session','');
  const status=$('#providerLoginStatus');
  providerAccountData=null;

  // Never block the provider entry screen behind a spinner.
  // Show the sign-in form immediately; if a valid saved session exists,
  // replace it with the dashboard as soon as the session check returns.
  paShow('paSignedOut');
  if(status)status.textContent='';
  if(!providerSessionToken)return;

  if(status)status.textContent=lang==='pt'?'A recuperar a tua sessão…':'Restoring your session…';

  let response;
  try{
    response=await Promise.race([
      Promise.resolve(db.rpc('provider_session_context',{p_session_token:providerSessionToken})),
      new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'timeout'},timedOut:true}),5000))
    ]);
  }catch(e){
    response={data:null,error:e};
  }

  const {data,error}=response||{};
  if(response&&response.timedOut){
    providerSessionToken='';store.set('tri_provider_session','');
    if(status)status.textContent='';
    return;
  }
  if(error||!data||!data.ok){
    if(error)console.error('provider_session_context',error);
    providerSessionToken='';store.set('tri_provider_session','');
    if(status)status.textContent='';
    return;
  }

  providerAccountData=data;
  if(status)status.textContent='';
  renderProviderDashboard(data);
  paShow('paDashboard');
}
function renderProviderDashboard(data){
  const p=data.profile||{},bookings=data.bookings||[],matches=data.matches||[],services=data.services||[],requests=[...bookings,...matches];
  $('#paDisplayName').textContent=p.business_name||p.name||(lang==='pt'?'Prestador':'Provider');
  $('#paAccountEmail').textContent=data.email||data.phone||'';
  const pending=requests.filter(x=>x.status==='requested'||x.status==='sent');
  $('#paQuickStatus').textContent=p.status==='active'?(lang==='pt'?'Ativo':'Active'):(lang==='pt'?'Pausado':'Paused');
  $('#paStatusHelp').textContent=p.status==='active'?(lang==='pt'?'Visível aos clientes.':'Visible to customers.'):(lang==='pt'?'Escondido dos clientes.':'Hidden from customers.');
  $('#paPauseBtn').textContent=p.status==='active'?(lang==='pt'?'Pausar':'Pause'):(lang==='pt'?'Reativar':'Reactivate');
  $('#paQuickRequests').textContent=pending.length?(lang==='pt'?pending.length+' por responder':pending.length+' to answer'):(lang==='pt'?'Tudo em dia':'All caught up');
  const nextPending=pending.slice().sort((a,b)=>String(a.service_date||'').localeCompare(String(b.service_date||'')))[0];
  $('#paQuickNextRequest').textContent=nextPending
    ?((nextPending.service_date||'')+(nextPending.service_time?' · '+nextPending.service_time:''))
    :(lang==='pt'?'Sem pedidos pendentes.':'No pending requests.');
  const activeServices=services.filter(x=>x.status==='active');
  $('#paQuickPrice').textContent=activeServices.length+' '+(lang==='pt'?(activeServices.length===1?'ativo':'ativos'):(activeServices.length===1?'active':'active'));
  const priced=activeServices.filter(x=>x.pricing_type!=='quote'&&x.price!=null).sort((a,b)=>Number(a.price)-Number(b.price))[0];
  $('#paQuickClientPrice').textContent=priced?((lang==='pt'?'Desde ':'From ')+providerPrice(priced)):(lang==='pt'?'Preços por serviço':'Prices per service');
  $('#paQuickAvailability').textContent=p.availability|| (lang==='pt'?'Não indicada':'Not set');
  const availabilityHint=$('#paAvailabilityHint');
  availabilityHint.textContent=lang==='pt'?'Podes alterar quando quiseres.':'You can change this anytime.';

  const pay=data.payment_account||{},payBadge=$('#paPaymentsBadge'),payHelp=$('#paPaymentsHelp'),payBtn=$('#paPaymentsBtn');
  $('#paPaymentsCard').hidden=!paymentsLive;
  const paymentsReady=!!pay.payouts_enabled&&pay.transfers_capability==='active';
  if(!paymentsLive){
    payBadge.classList.remove('active');
    payBadge.classList.add('paused');
    payBadge.textContent=lang==='pt'?'Em preparação':'Coming soon';
    payHelp.textContent=lang==='pt'?'Os pagamentos através do TRIÂNGULO ainda não estão ativos. Avisaremos antes da ativação.':'Payments through TRIÂNGULO are not active yet. We will let you know before activation.';
    payBtn.textContent=lang==='pt'?'Pagamentos em breve':'Payments coming soon';
    payBtn.disabled=true;
  }else{
    payBtn.disabled=false;
    payBadge.classList.toggle('active',paymentsReady);
    payBadge.classList.toggle('paused',!paymentsReady);
    if(paymentsReady){
      payBadge.textContent=lang==='pt'?'Ativo':'Active';
      payHelp.textContent=lang==='pt'?'Pronto para receber pagamentos através do TRIÂNGULO.':'Ready to receive payments through TRIÂNGULO.';
      payBtn.textContent=lang==='pt'?'Gerir pagamentos →':'Manage payments →';
    }else if(pay.connected){
      payBadge.textContent=lang==='pt'?'Verificação pendente':'Verification pending';
      payHelp.textContent=lang==='pt'?'Conclui a verificação da Stripe para poderes receber.':'Complete Stripe verification so you can receive payments.';
      payBtn.textContent=lang==='pt'?'Continuar verificação →':'Continue verification →';
    }else{
      payBadge.textContent=lang==='pt'?'Por ativar':'Not active';
      payHelp.textContent=lang==='pt'?'Ativa os pagamentos para poderes receber através do TRIÂNGULO.':'Activate payments so you can receive money through TRIÂNGULO.';
      payBtn.textContent=lang==='pt'?'Ativar pagamentos →':'Activate payments →';
    }
  }

  const f=$('#providerProfileForm');
  f.name.value=p.name||'';
  f.business_name.value=p.business_name||'';
  f.locality.value=p.locality||'';
  f.description.value=p.description||'';
  f.pricing_type.value=p.pricing_type||'quote';
  f.price.value=p.price==null?'':p.price;
  f.availability.value=p.availability||'';
  f.website.value=p.website||'';
  f.other_service.value=p.other_service||'';
  $$('[data-pa-island]').forEach(x=>x.checked=(p.service_islands||[]).includes(x.value));
  $$('[data-pa-cat]').forEach(x=>x.checked=(p.categories||[]).includes(x.value));
  syncProviderOther();syncProviderPrice();

  renderProviderServices(services);
  $('#paRequestCount').textContent=pending.length;
  if(!requests.length){
    $('#paBookings').innerHTML='<div class="pa-note">'+(lang==='pt'?'Ainda não tens pedidos. Quando houver um pedido compatível ou um cliente escolher um serviço teu, aparece aqui.':'No requests yet. Matching requests and direct service requests will appear here.')+'</div>';
  }else{
    const ordered=[...requests].sort((a,b)=>{
      const ap=(a.status==='requested'||a.status==='sent')?0:(a.status==='quoted'||a.status==='accepted'||a.status==='confirmed'||a.status==='selected')?1:2;
      const bp=(b.status==='requested'||b.status==='sent')?0:(b.status==='quoted'||b.status==='accepted'||b.status==='confirmed'||b.status==='selected')?1:2;
      if(ap!==bp)return ap-bp;return String(a.service_date||'').localeCompare(String(b.service_date||''));
    });
    $('#paBookings').innerHTML=ordered.map(x=>{
      const generic=x.kind==='matching',isPending=generic?x.status==='sent':x.status==='requested';
      const when=escapeHtml((x.service_date?formatServiceDate(x.service_date):'')+' · '+formatServiceTime(x.service_time));
      const note=escapeHtml(x.description||x.notes||(lang==='pt'?'Sem nota adicional':'No additional note'));
      const place=x.location_text||((x.island||'')+(lang==='pt'?' · zona não indicada':' · area not provided'));
      const ownAmount=Number(x.provider_amount!=null?x.provider_amount:x.price);
      const clientTotal=x.total_amount!=null?Number(x.total_amount):(Number.isFinite(ownAmount)&&ownAmount>0?ownAmount+(Math.round(ownAmount*TRIANGULO_SERVICE_FEE_RATE*100)/100):NaN);
      const fixedPriceSummary=!x.requires_quote&&Number.isFinite(ownAmount)&&ownAmount>0&&Number.isFinite(clientTotal)
        ?'<div class="pa-inline-quote-preview">'+(lang==='pt'?'Tu recebes ':'You receive ')+formatEuro(ownAmount)+' · '+(lang==='pt'?'cliente vê ':'customer sees ')+formatEuro(clientTotal)+'</div>'
        :'';
      let actions='';
      if(isPending&&x.response_token){
        if(x.requires_quote)actions='<div class="pa-booking-actions pa-quote-actions" style="grid-template-columns:1fr"><input data-pa-quote-amount="'+x.response_token+'" type="number" min="0.01" max="100000" step="0.01" inputmode="decimal" placeholder="'+(lang==='pt'?'Valor que queres receber (€)':'Amount you want to receive (€)')+'" style="width:100%;border:1px solid #d5e3ea;border-radius:10px;padding:10px"><div class="pa-inline-quote-preview" data-pa-quote-preview="'+x.response_token+'" hidden></div><button class="accept" data-pa-quote="'+x.response_token+'" data-kind="'+(generic?'matching':'direct')+'">'+(lang==='pt'?'Enviar orçamento':'Send quote')+'</button><button class="decline" data-pa-respond="decline" data-kind="'+(generic?'matching':'direct')+'" data-token="'+x.response_token+'">'+(lang==='pt'?'Não posso':'Decline')+'</button></div>';
        else actions='<div class="pa-booking-actions"><button class="accept" data-pa-respond="accept" data-kind="'+(generic?'matching':'direct')+'" data-token="'+x.response_token+'">'+(lang==='pt'?'Tenho disponibilidade':'I’m available')+'</button><button class="decline" data-pa-respond="decline" data-kind="'+(generic?'matching':'direct')+'" data-token="'+x.response_token+'">'+(lang==='pt'?'Não posso':'Decline')+'</button></div>';
      }
      const hasClient=x.client_name||x.client_email||x.client_phone;
      const client=hasClient?'<div class="pa-client"><b>'+(lang==='pt'?'Contacto do cliente':'Customer contact')+'</b><br>'+escapeHtml(x.client_name||'')+(x.client_email?'<br>'+escapeHtml(x.client_email):'')+(x.client_phone?'<br>'+escapeHtml(x.client_phone):'')+'</div>':'';
      let stateLabel;
      if(generic){const pt={sent:'Novo pedido compatível',accepted:'Disponível · aguarda cliente',quoted:'Orçamento enviado · aguarda cliente',selected:'Serviço confirmado',completed:'Concluído',declined:'Recusado',expired:'Expirado'};const en={sent:'New matching request',accepted:'Available · awaiting customer',quoted:'Quote sent · awaiting customer',selected:'Service confirmed',completed:'Completed',declined:'Declined',expired:'Expired'};stateLabel=(lang==='pt'?pt:en)[x.status]||x.status}
      else stateLabel=providerBookingStatus(x.status,x.payment_status);
      const locked=!hasClient&&(x.status==='confirmed'||x.status==='accepted'||x.status==='quoted')?'<div class="pa-note" style="text-align:left">'+(lang==='pt'?'🔒 O contacto é libertado quando o serviço fica confirmado.':'🔒 Contact is released when the service is confirmed.')+'</div>':'';
      return '<div class="pa-booking"><div class="pa-booking-top"><b>'+escapeHtml(x.service_title||(lang==='pt'?'Serviço':'Service'))+'</b><span class="pa-booking-status '+escapeHtml(x.status||'')+'">'+escapeHtml(stateLabel)+'</span></div><div class="pa-request-meta"><span>📍 '+escapeHtml(place)+'</span><span>🗓 '+when+'</span></div><div class="pa-request-brief"><b>'+(lang==='pt'?'O que é para fazer':'Job details')+'</b><span>'+note+'</span></div>'+fixedPriceSummary+actions+locked+client+'</div>';
    }).join('');

    document.querySelectorAll('[data-pa-quote-amount]').forEach(input=>{
      const update=()=>{
        const amount=Number(input.value),box=$('[data-pa-quote-preview="'+input.dataset.paQuoteAmount+'"]');
        if(!box)return;
        if(!Number.isFinite(amount)||amount<=0){box.hidden=true;box.textContent='';return}
        const total=amount+(Math.round(amount*TRIANGULO_SERVICE_FEE_RATE*100)/100);
        box.hidden=false;
        box.textContent=lang==='pt'
          ?('Tu recebes '+formatEuro(amount)+' · cliente vê '+formatEuro(total))
          :('You receive '+formatEuro(amount)+' · customer sees '+formatEuro(total));
      };
      input.addEventListener('input',update);update();
    });
    document.querySelectorAll('[data-pa-quote]').forEach(btn=>btn.onclick=async()=>{
      const token=btn.dataset.paQuote,input=$('[data-pa-quote-amount="'+token+'"]'),amount=Number(input&&input.value),generic=btn.dataset.kind==='matching';
      if(!amount||amount<=0){toast(lang==='pt'?'Indica o valor do orçamento.':'Enter the quote amount.');return}
      const total=amount+(Math.round(amount*TRIANGULO_SERVICE_FEE_RATE*100)/100);
      const question=lang==='pt'
        ?'Enviar este orçamento? Tu recebes '+formatEuro(amount)+' e o cliente verá '+formatEuro(total)+'. Depois de enviado não pode ser alterado.'
        :'Send this quote? You receive '+formatEuro(amount)+' and the customer will see '+formatEuro(total)+'. It cannot be changed after sending.';
      if(!window.confirm(question))return;
      const oldLabel=btn.textContent;btn.disabled=true;btn.textContent=lang==='pt'?'A enviar…':'Sending…';
      const response=generic?await db.rpc('respond_service_request_match',{p_token:token,p_action:'accept',p_amount:amount}):await db.rpc('submit_booking_quote',{p_token:token,p_amount:amount});
      btn.disabled=false;btn.textContent=oldLabel;const r=response.data,error=response.error;
      if(error||!r||!r.ok){toast((r&&r.message)||(lang==='pt'?'Não foi possível enviar o orçamento.':'Could not send the quote.'));return}
      toast(lang==='pt'?'Orçamento enviado ✓':'Quote sent ✓');await loadProviderAccount();
    });
    document.querySelectorAll('[data-pa-respond]').forEach(btn=>btn.onclick=async()=>{
      const action=btn.dataset.paRespond;
      const generic=btn.dataset.kind==='matching';
      if(action==='decline'&&!window.confirm(lang==='pt'?'Tens a certeza de que não podes aceitar este pedido? Esta resposta é definitiva.':'Are you sure you cannot accept this request? This response is final.'))return;
      if(action==='accept'){
        const question=generic
          ?(lang==='pt'?'Confirmar que tens disponibilidade? O cliente será avisado e poderá escolher o teu serviço.':'Confirm that you are available? The customer will be notified and can choose your service.')
          :(lang==='pt'?'Aceitar este pedido? O serviço ficará confirmado e os contactos poderão ser disponibilizados.':'Accept this request? The service will be confirmed and contact details may be released.');
        if(!window.confirm(question))return;
      }
      const oldLabel=btn.textContent;btn.disabled=true;if(action==='decline')btn.textContent=lang==='pt'?'A recusar…':'Declining…';
      const response=generic?await db.rpc('respond_service_request_match',{p_token:btn.dataset.token,p_action:action,p_amount:null}):await db.rpc('respond_to_booking',{p_token:btn.dataset.token,p_action:action});
      const r=response.data,error=response.error;btn.disabled=false;btn.textContent=oldLabel;
      if(error||!r||!r.ok){toast((r&&r.message)||(lang==='pt'?'Não foi possível responder.':'Could not respond.'));return}
      toast(lang==='pt'?'Resposta registada ✓':'Response saved ✓');await loadProviderAccount();
    });
  }
}
function renderProviderServices(services){
 const box=$('#paServicesList');if(!box)return;
 if(!services.length){box.innerHTML='<div class="pa-note">'+(lang==='pt'?'Ainda não tens serviços individuais. Adiciona o primeiro.':'You do not have individual services yet. Add the first one.')+'</div>';return}
 box.innerHTML=services.map(s=>'<div class="pa-booking"><div class="pa-booking-top"><b>'+escapeHtml(s.title)+'</b><span class="pa-booking-status '+escapeHtml(s.status)+'">'+(s.status==='active'?(lang==='pt'?'Ativo':'Active'):(lang==='pt'?'Pausado':'Paused'))+'</span></div><small>'+escapeHtml(s.category_code)+' · '+escapeHtml(s.pricing_type==='quote'?(lang==='pt'?'Sob orçamento':'Quote'):providerOwnPrice(s))+'</small><div class="pa-booking-actions"><button class="accept" data-edit-service="'+s.id+'">'+(lang==='pt'?'Editar':'Edit')+'</button><button class="'+(s.status==='active'?'decline':'accept')+'" data-toggle-service="'+s.id+'">'+(s.status==='active'?(lang==='pt'?'Pausar':'Pause'):(lang==='pt'?'Reativar':'Reactivate'))+'</button></div></div>').join('');
 $$('[data-edit-service]').forEach(btn=>btn.onclick=()=>openServiceEditor(btn.dataset.editService));
 $$('[data-toggle-service]').forEach(btn=>btn.onclick=()=>toggleProviderService(btn.dataset.toggleService));
}
function openServiceEditor(id=null){
 const form=$('#paServiceForm'),s=id&&providerAccountData?(providerAccountData.services||[]).find(x=>x.id===id):null;
 form.reset();form.service_id.value=s?s.id:'';
 form.title.value=s?s.title:'';
 form.category_code.value=s?s.category_code:'home';
 form.description.value=s&&s.description?s.description:'';
 form.pricing_type.value=s?s.pricing_type:'hour';
 form.price.value=s&&s.price!=null?s.price:'';
 form.availability.value=s&&s.availability?s.availability:'';
 form.dataset.status=s&&s.status?s.status:'active';
 form.style.display='block';syncServicePriceField();form.scrollIntoView({behavior:'smooth',block:'center'});
}
function syncServicePriceField(){
 const form=$('#paServiceForm'),quote=form.pricing_type.value==='quote';
 form.price.disabled=quote;form.price.required=!quote;if(quote)form.price.value='';
}
$('#paServiceForm [name="pricing_type"]').onchange=syncServicePriceField;
$('#paServiceForm').onsubmit=async e=>{
 e.preventDefault();const form=e.target,status=$('#paServiceStatus'),d=Object.fromEntries(new FormData(form));
 if(containsDirectContactText(d.title)||containsDirectContactText(d.description)||containsDirectContactText(d.availability)){status.textContent=lang==='pt'?'Não coloques telefone, email, WhatsApp, redes sociais ou links nos campos públicos do serviço.':'Do not add phone numbers, email, WhatsApp, social media or links to public service fields.';return}
 const payload={category_code:d.category_code,title:(d.title||'').trim(),description:(d.description||'').trim()||null,pricing_type:d.pricing_type,price:d.pricing_type==='quote'?null:Number(d.price),availability:(d.availability||'').trim()||null,status:form.dataset.status||'active'};
 status.textContent=lang==='pt'?'A guardar…':'Saving…';
 const {data,error}=await db.rpc('provider_session_save_service',{p_session_token:providerSessionToken,p_service_id:d.service_id||null,p_payload:payload});
 if(error||!data||!data.ok){status.textContent=(data&&data.message)||(lang==='pt'?'Não foi possível guardar.':'Could not save.');return}
 status.textContent=lang==='pt'?'Serviço guardado ✓':'Service saved ✓';form.style.display='none';await loadProviderAccount();await loadProviders(activeSearchQuery,activeServiceGroup);
};
async function toggleProviderService(id){
 if(!id)return;
 const {data,error}=await db.rpc('provider_session_remove_service',{p_session_token:providerSessionToken,p_service_id:id});
 if(error||!data||!data.ok){toast((data&&data.message)||(lang==='pt'?'Não foi possível alterar o serviço.':'Could not update the service.'));return}
 const active=data.status==='active';
 toast(active?(lang==='pt'?'Serviço reativado ✓':'Service reactivated ✓'):(lang==='pt'?'Serviço pausado ✓':'Service paused ✓'));
 await loadProviderAccount();await loadProviders(activeSearchQuery,activeServiceGroup);
}
function syncProviderOther(){
  const on=$('#paOtherCat')&&$('#paOtherCat').checked;
  $('#paOtherService').hidden=!on;
  $('#paOtherService').required=!!on;
  if(!on)$('#paOtherService').value='';
}
function updateProviderPricePreview(){
  const box=$('#paPricePreview'),price=Number($('#paPrice').value),quote=$('#paPricingType').value==='quote';
  if(!box)return;
  if(quote||!Number.isFinite(price)||price<=0){box.style.display='none';box.textContent='';return}
  const fee=Math.round(price*TRIANGULO_SERVICE_FEE_RATE*100)/100,total=price+fee;
  box.textContent=lang==='pt'
    ?'Tu recebes '+price.toFixed(2).replace('.',',')+' € · cliente vê '+total.toFixed(2).replace('.',',')+' €'
    :'You receive €'+price.toFixed(2)+' · customer sees €'+total.toFixed(2);
  box.style.display='block';
}
function syncProviderPrice(){
  const quote=$('#paPricingType').value==='quote';
  $('#paPrice').disabled=quote;
  $('#paPrice').required=!quote;
  if(quote)$('#paPrice').value='';
  updateProviderPricePreview();
}
function openProviderProfileEditor(focusSelector){
  const form=$('#providerProfileForm');
  form.hidden=false;
  form.scrollIntoView({behavior:'smooth',block:'start'});
  if(focusSelector)setTimeout(()=>{const el=$(focusSelector);if(el)el.focus()},250);
}
async function providerSignOut(){
  const token=store.get('tri_provider_session','');
  if(token){try{await db.rpc('provider_logout',{p_session_token:token})}catch{}}
  providerSessionToken='';providerAccountData=null;store.set('tri_provider_session','');
  $('#providerLoginStatus').textContent='';
  paShow('paSignedOut');
}
async function openProviderPayments(){
  if(!paymentsLive){toast(lang==='pt'?'Os pagamentos ainda não estão ativos.':'Payments are not active yet.');return}
  if(!providerSessionToken){toast(lang==='pt'?'Inicia sessão primeiro.':'Sign in first.');return}
  const btn=$('#paPaymentsBtn'),old=btn.textContent;
  btn.disabled=true;btn.textContent=lang==='pt'?'A abrir Stripe…':'Opening Stripe…';
  try{
    const {data,error}=await db.functions.invoke('stripe-connect-onboarding',{body:{provider_session_token:providerSessionToken}});
    if(error||!data||!data.ok){console.error(error,data);toast(lang==='pt'?'Não foi possível abrir a verificação.':'Could not open verification.');return}
    if(data.state==='ready'){toast(lang==='pt'?'Pagamentos já estão ativos ✓':'Payments are already active ✓');await loadProviderAccount();return}
    if(data.url){location.href=data.url;return}
    toast(lang==='pt'?'Verificação indisponível.':'Verification unavailable.');
  }catch(e){console.error(e);toast(lang==='pt'?'Não foi possível abrir a Stripe.':'Could not open Stripe.')}
  finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent=old}}
}
$$('[data-toggle-password]').forEach(btn=>btn.onclick=()=>{const input=$('#'+btn.dataset.togglePassword);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?(lang==='pt'?'Ocultar':'Hide'):(lang==='pt'?'Mostrar':'Show');btn.setAttribute('aria-label',btn.textContent+' password')});
$('#providerLoginEmail').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#providerLoginPassword').focus()}});
$('#providerLoginPassword').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#providerLoginBtn').click()}});
$('#providerNewPassword').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#providerNewPassword2').focus()}});
$('#providerNewPassword2').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#providerSetPasswordBtn').click()}});
$('#providerEntryBtn').onclick=openProviderArea;

$('#paPaymentsBtn').onclick=openProviderPayments;
$('#paQuickRequestsBtn').onclick=()=>$('#paRequestsCard').scrollIntoView({behavior:'smooth',block:'start'});
$('#paQuickPriceBtn').onclick=()=>$('#paServicesCard').scrollIntoView({behavior:'smooth',block:'start'});
$('#paQuickAvailabilityBtn').onclick=()=>openProviderProfileEditor('#providerProfileForm [name="availability"]');
$('#paCloseProfileBtn').onclick=()=>{const f=$('#providerProfileForm');f.hidden=true;$('#paDashboard').scrollIntoView({behavior:'smooth',block:'start'})};
$('#paAddServiceBtn').onclick=()=>openServiceEditor();
$('#paCancelServiceBtn').onclick=()=>{$('#paServiceForm').style.display='none';$('#paServiceStatus').textContent=''};
$('#providerAreaBack').onclick=closeProviderArea;
$('#providerLogoutBtn').onclick=providerSignOut;
$('#providerLogoutFromMissing').onclick=providerSignOut;
$('#paOtherCat').onchange=syncProviderOther;
$('#paPricingType').onchange=syncProviderPrice;
$('#paPrice').addEventListener('input',updateProviderPricePreview);
$('#providerLoginBtn').onclick=async()=>{
  const email=$('#providerLoginEmail').value.trim(),password=$('#providerLoginPassword').value,status=$('#providerLoginStatus');
  if(!email){status.textContent=lang==='pt'?'Indica o teu email ou telefone.':'Enter your email or phone number.';return}
  if(!password){status.textContent=lang==='pt'?'Indica a tua password.':'Enter your password.';return}
  status.textContent=lang==='pt'?'A entrar…':'Signing in…';
  const {data,error}=await db.rpc('provider_password_login',{p_email:email,p_password:password});
  if(error||!data||!data.ok){
    console.error(error);status.textContent=lang==='pt'?'Email/telefone ou password incorretos. Se é o primeiro acesso, cria a tua password.':'Incorrect email/phone or password. If this is your first sign-in, create your password.';return
  }
  providerSessionToken=data.session_token;store.set('tri_provider_session',providerSessionToken);
  $('#providerLoginPassword').value='';status.textContent='';
  history.replaceState({},'',location.pathname+'?prestador=1');
  await loadProviderAccount();
  $('#providerAreaView').scrollTo({top:0,behavior:'smooth'});
  toast(lang==='pt'?'Sessão iniciada ✓':'Signed in ✓');
};
$('#providerForgotBtn').onclick=async()=>{
  const email=$('#providerLoginEmail').value.trim(),status=$('#providerLoginStatus');
  if(!email){status.textContent=lang==='pt'?'Escreve primeiro o email ou telefone da tua candidatura.':'Enter the email or phone number from your application first.';return}
  status.textContent=lang==='pt'?'A preparar recuperação…':'Preparing recovery…';
  const {data,error}=await db.rpc('request_provider_password_reset',{p_email:email});
  if(error||!data||!data.ok){console.error(error);status.textContent=lang==='pt'?'Não foi possível preparar a recuperação. Tenta novamente.':'Could not prepare recovery. Please try again.';return}
  status.textContent=lang==='pt'?'Se estes dados estiverem associados a um perfil aprovado, vais receber instruções para criar ou repor a password. Se usares WhatsApp, a ligação pode ser enviada manualmente pelo TRIÂNGULO.':'If these details are linked to an approved profile, you will receive instructions to create or reset your password. If you use WhatsApp, TRIÂNGULO may send the link manually.';
};
$('#paPauseBtn').onclick=async()=>{
  if(!providerAccountData)return;
  const p=providerAccountData.profile||{};
  const next=p.status==='active'?'paused':'active';
  const payload={
    name:p.name,business_name:p.business_name,locality:p.locality,description:p.description,
    pricing_type:p.pricing_type,price:p.price,availability:p.availability,website:p.website,
    service_islands:p.service_islands||[],categories:p.categories||[],other_service:p.other_service,status:next
  };
  $('#paPauseBtn').disabled=true;
  const {data,error}=await db.rpc('provider_session_update_profile',{p_session_token:providerSessionToken,p_payload:payload});
  $('#paPauseBtn').disabled=false;
  if(error||!data||!data.ok){toast(lang==='pt'?'Não foi possível alterar o perfil.':'Could not update profile.');return}
  toast(next==='paused'?(lang==='pt'?'Perfil pausado':'Profile paused'):(lang==='pt'?'Perfil reativado ✓':'Profile reactivated ✓'));
  await loadProviderAccount();loadProviders();
};
$('#providerProfileForm').onsubmit=async e=>{
  e.preventDefault();
  if(!providerAccountData)return;
  const f=e.target,status=$('#providerProfileStatus'),d=Object.fromEntries(new FormData(f));
  const islands=$$('[data-pa-island]:checked').map(x=>x.value),cats=$$('[data-pa-cat]:checked').map(x=>x.value);
  if(!islands.length){status.textContent=lang==='pt'?'Seleciona pelo menos uma ilha.':'Select at least one island.';return}
  if(!cats.length){status.textContent=lang==='pt'?'Seleciona pelo menos um serviço.':'Select at least one service.';return}
  if(containsDirectContactText(d.name)||containsDirectContactText(d.locality)||containsDirectContactText(d.availability)){status.textContent=lang==='pt'?'Não coloques telefone, email, WhatsApp, redes sociais ou links nos campos públicos do perfil.':'Do not add phone numbers, email, WhatsApp, social media or links to public profile fields.';return}
  if(containsDirectContactText(d.description)||containsDirectContactText(d.other_service)){status.textContent=lang==='pt'?'Não coloques telefone, email, WhatsApp, redes sociais ou links na descrição pública.':'Do not add phone numbers, email, WhatsApp, social media or links to the public description.';return}
  if(d.pricing_type!=='quote'&&(!d.price||Number(d.price)<=0)){status.textContent=lang==='pt'?'Indica quanto queres receber ou escolhe “Sob orçamento”.':'Enter how much you want to earn or choose “Quote”.';$('#paPrice').focus();return}
  const payload={
    name:d.name.trim(),business_name:d.business_name&&d.business_name.trim()?d.business_name.trim():null,
    locality:d.locality&&d.locality.trim()?d.locality.trim():null,
    description:d.description.trim(),pricing_type:d.pricing_type,
    price:d.pricing_type==='quote'||!d.price?null:Number(d.price),
    availability:d.availability&&d.availability.trim()?d.availability.trim():null,
    website:d.website&&d.website.trim()?d.website.trim():null,
    service_islands:islands,categories:cats,
    other_service:cats.includes('other')&&d.other_service?d.other_service.trim():null,
    status:(providerAccountData.profile&&providerAccountData.profile.status)||'active'
  };
  status.textContent=lang==='pt'?'A guardar…':'Saving…';
  const {data,error}=await db.rpc('provider_session_update_profile',{p_session_token:providerSessionToken,p_payload:payload});
  if(error||!data||!data.ok){status.textContent=(data&&data.message)?data.message:(lang==='pt'?'Não foi possível guardar.':'Could not save.');return}
  status.textContent=lang==='pt'?'Alterações guardadas ✓':'Changes saved ✓';
  await loadProviderAccount();loadProviders();
};
let activeProviderPasswordToken=null;
async function openProviderPasswordSetup(token){
  if(!token)return false;
  activeProviderPasswordToken=null;
  $('#splash').classList.add('hidden');
  $('#mainShell').classList.add('hidden');
  $('#providerRequestView').hidden=true;
  $('#providerAreaView').hidden=false;
  paShow('paLoading');
  history.replaceState({},'',location.pathname+'?prestador=1');

  const p1=$('#providerNewPassword'),p2=$('#providerNewPassword2'),btn=$('#providerSetPasswordBtn'),status=$('#providerPasswordStatus');
  [p1,p2,btn].forEach(el=>{if(el)el.disabled=true});
  if(status)status.textContent=lang==='pt'?'A validar a ligação…':'Validating link…';

  try{
    const {data,error}=await db.rpc('provider_password_token_status',{p_token:token});
    paShow('paPasswordSet');
    if(error||!data||data.ok!==true){
      if(status)status.textContent=lang==='pt'?'Não foi possível validar esta ligação. Volta a abrir a ligação do email ou pede uma nova na entrada de prestadores.':'Could not validate this link. Reopen the link from the email or request a new one from provider sign-in.';
      return true;
    }
    if(data.valid!==true){
      if(status)status.textContent=lang==='pt'?'Esta ligação expirou ou já foi usada. Volta à entrada de prestadores e pede uma nova ligação.':'This link has expired or was already used. Return to provider sign-in and request a new link.';
      return true;
    }

    activeProviderPasswordToken=token;
    [p1,p2,btn].forEach(el=>{if(el)el.disabled=false});
    if(status)status.textContent='';
    if(p1)requestAnimationFrame(()=>p1.focus({preventScroll:true}));
    return true;
  }catch(e){
    console.error('provider password token validation',e);
    paShow('paPasswordSet');
    if(status)status.textContent=lang==='pt'?'Não foi possível validar esta ligação. Verifica a ligação e tenta novamente.':'Could not validate this link. Check the link and try again.';
    return true;
  }
}
$('#providerSetPasswordBtn').onclick=async()=>{
  const p1=$('#providerNewPassword').value,p2=$('#providerNewPassword2').value,status=$('#providerPasswordStatus');
  if(!activeProviderPasswordToken){status.textContent=lang==='pt'?'Ligação inválida ou expirada.':'Invalid or expired link.';return}
  if(p1.length<12){status.textContent=lang==='pt'?'A password deve ter pelo menos 12 caracteres.':'Password must be at least 12 characters.';return}
  if(p1!==p2){status.textContent=lang==='pt'?'As passwords não coincidem.':'Passwords do not match.';return}
  status.textContent=lang==='pt'?'A guardar…':'Saving…';
  const {data,error}=await db.rpc('set_provider_password',{p_token:activeProviderPasswordToken,p_password:p1});
  if(error||!data||!data.ok){
    console.error(error);status.textContent=(data&&data.state==='invalid_token')?(lang==='pt'?'A ligação expirou ou já foi usada. Pede uma nova.':'The link expired or was already used. Request a new one.'):(lang==='pt'?'Não foi possível guardar a password.':'Could not save the password.');return
  }
  providerSessionToken=data.session_token;store.set('tri_provider_session',providerSessionToken);
  activeProviderPasswordToken=null;$('#providerNewPassword').value='';$('#providerNewPassword2').value='';
  status.textContent='';await loadProviderAccount();toast(lang==='pt'?'Password guardada ✓':'Password saved ✓');
}

let activeProviderBookingToken=null,activeProviderRequestKind='direct';
function providerAppHideAll(){
  $('#prAppLoading').hidden=true;
  $('#prAppRequest').hidden=true;
  $('#prAppResult').hidden=true;
}
async function providerAppContinue(){
  history.replaceState({},'',location.pathname+'?prestador=1');
  activeProviderBookingToken=null;activeProviderRequestKind='direct';
  $('#providerRequestView').hidden=true;
  await openProviderArea();
}
function updateProviderQuotePreview(){
 const box=$('#prAppQuotePreview'),input=$('#prAppQuoteAmount');
 if(!box||!input)return;
 const amount=Number(input.value);
 if(!Number.isFinite(amount)||amount<=0){box.textContent='';box.hidden=true;return}
 const fee=Math.round(amount*TRIANGULO_SERVICE_FEE_RATE*100)/100,total=amount+fee;
 box.hidden=false;
 box.textContent=lang==='pt'
  ?'Tu recebes '+formatEuro(amount)+' · cliente vê '+formatEuro(total)
  :'You receive '+formatEuro(amount)+' · customer sees '+formatEuro(total);
}
function providerAppRenderState(state,data={}){
  providerAppHideAll();
  if(state==='sent')state='requested';
  if(state==='requested'){
    $('#prAppRequest').hidden=false;
    const quote=!!data.requires_quote,kicker=$('#prAppKicker'),title=$('#prAppTitle');
    if(kicker){
      kicker.dataset.pt=quote?'Pedido de orçamento':'Novo pedido para ti';
      kicker.dataset.en=quote?'Quote request':'New request for you';
      kicker.textContent=lang==='pt'?kicker.dataset.pt:kicker.dataset.en;
    }
    if(title){
      title.dataset.pt=quote?'Queres enviar um orçamento?':'Podes aceitar este serviço?';
      title.dataset.en=quote?'Would you like to send a quote?':'Can you accept this job?';
      title.textContent=lang==='pt'?title.dataset.pt:title.dataset.en;
    }
    $('#prAppIsland').textContent=data.island||'—';
    $('#prAppLocation').textContent=data.location_text||(lang==='pt'?'Zona não indicada':'Area not provided');
    $('#prAppDate').textContent=data.service_date?formatServiceDate(data.service_date):'—';
    $('#prAppTime').textContent=formatServiceTime(data.service_time);
    $('#prAppNotes').textContent=data.notes||(lang==='pt'?'Sem notas adicionais':'No additional notes');
    $('#prAppExpires').textContent=data.expires_at?formatDeadline(data.expires_at):'—';
    const qb=$('#prAppQuoteBox'),fixed=$('#prAppFixedPrice'),accept=$('#prAppAccept'),paymentNote=$('#prAppPaymentNote');
    qb.hidden=!quote;
    if(fixed){
      const own=Number(data.provider_amount!=null?data.provider_amount:data.price);
      const total=data.total_amount!=null?Number(data.total_amount):(Number.isFinite(own)&&own>0?own+(Math.round(own*TRIANGULO_SERVICE_FEE_RATE*100)/100):NaN);
      if(!quote&&Number.isFinite(own)&&own>0&&Number.isFinite(total)){
        fixed.hidden=false;
        fixed.textContent=lang==='pt'
          ?'Tu recebes '+formatEuro(own)+' · cliente vê '+formatEuro(total)
          :'You receive '+formatEuro(own)+' · customer sees '+formatEuro(total);
      }else{fixed.hidden=true;fixed.textContent=''}
    }
    accept.textContent=quote?(lang==='pt'?'Enviar orçamento':'Send quote'):(lang==='pt'?'✓ Aceitar pedido':'✓ Accept request');
    if(quote){
      paymentNote.textContent=activeProviderRequestKind==='matching'
        ?(lang==='pt'?'O cliente recebe o teu orçamento e decide se quer escolher o teu serviço.':'The customer receives your quote and decides whether to choose your service.')
        :(lang==='pt'?'Ao enviares, o cliente recebe o orçamento com o total final. O serviço só fica confirmado quando o cliente aceitar.':'When you send it, the customer receives the quote with the final total. The service is only confirmed when the customer accepts.');
      updateProviderQuotePreview();
    }else if(paymentNote){
      paymentNote.textContent=activeProviderRequestKind==='matching'
        ?(lang==='pt'?'Ao responderes, o cliente recebe a tua disponibilidade e decide se quer confirmar o teu serviço.':'When you respond, the customer receives your availability and decides whether to confirm your service.')
        :(paymentsLive
          ?(lang==='pt'?'Ao aceitares, o cliente é convidado a pagar no TRIÂNGULO. Os contactos só são desbloqueados depois do pagamento integral.':'When you accept, the customer is asked to pay through TRIÂNGULO. Contact details are only unlocked after full payment.')
          :(lang==='pt'?'Ao aceitares, o serviço fica confirmado e os contactos são disponibilizados para combinarem os detalhes.':'When you accept, the service is confirmed and contact details are released so you can coordinate.'));
    }
    return;
  }

  const result=$('#prAppResult');result.hidden=false;
  if(state==='confirmed'||state==='selected'||state==='accepted'||state==='quoted'){
    const waitingChoice=state==='accepted'||state==='quoted';
    const headline=state==='quoted'
      ?(lang==='pt'?'Orçamento enviado':'Quote sent')
      :state==='accepted'
        ?(lang==='pt'?'Disponibilidade enviada':'Availability sent')
        :state==='selected'
          ?(lang==='pt'?'Serviço confirmado':'Service confirmed')
          :(data.requires_quote?(lang==='pt'?'Orçamento aceite':'Quote accepted'):(lang==='pt'?'Serviço aceite':'Service accepted'));
    const body=state==='quoted'
      ?(lang==='pt'?'O cliente recebeu o orçamento e o total final. Agora decide se quer confirmar.':'The customer received the quote and final total and can now decide whether to confirm.')
      :state==='accepted'
        ?(lang==='pt'?'A tua disponibilidade foi enviada. O cliente decide se quer confirmar.':'Your availability was sent. The customer decides whether to confirm.')
        :(paymentsLive&&data.payment_status!=='paid'
          ?(lang==='pt'?'O serviço foi aceite. Aguarda a confirmação do pagamento.':'The service was accepted. Wait for payment confirmation.')
          :(lang==='pt'?'O serviço ficou confirmado.':'The service is confirmed.'));
    result.innerHTML='<div class="big">✓</div><h2>'+headline+'</h2>'
      +(data.total_amount!=null?'<div class="pr-app-contact"><b>'+(lang==='pt'?'Resumo do orçamento':'Quote summary')+'</b><div>'+(lang==='pt'?'Tu recebes':'You receive')+': '+formatEuro(data.provider_amount)+'</div><div>'+(lang==='pt'?'Cliente vê':'Customer sees')+': '+formatEuro(data.total_amount)+'</div></div>':'')
      +'<p>'+body+'</p>'
      +(((data.client_name||data.client_email||data.client_phone))?'<div class="pr-app-contact"><b>'+(lang==='pt'?'Contacto do cliente':'Customer contact')+'</b><div>'+escapeHtml(data.client_name||'')+'</div><div>'+escapeHtml(data.client_email||'')+'</div><div>'+escapeHtml(data.client_phone||'')+'</div></div>':'')
      +'<button class="pr-app-continue" data-pr-app-continue>'+(lang==='pt'?'Ir para a Área do Prestador':'Go to Provider Area')+'</button>';
  }else if(state==='declined'){
    result.innerHTML='<div class="big">✓</div><h2>'+(lang==='pt'?'Resposta registada':'Response saved')+'</h2><p>'+(lang==='pt'?'O cliente será informado de que não podes aceitar este pedido.':'The customer will be told you cannot accept this request.')+'</p><button class="pr-app-continue" data-pr-app-continue>'+(lang==='pt'?'Ir para a Área do Prestador':'Go to Provider Area')+'</button>';
  }else if(state==='expired'){
    result.innerHTML='<div class="big">⌛</div><h2>'+(lang==='pt'?'Pedido expirado':'Request expired')+'</h2><p>'+(lang==='pt'?'O prazo terminou e o serviço não foi confirmado.':'The response deadline passed and the service was not confirmed.')+'</p><button class="pr-app-continue" data-pr-app-continue>'+(lang==='pt'?'Ir para a Área do Prestador':'Go to Provider Area')+'</button>';
  }else if(state==='link_expired'){
    result.innerHTML='<div class="big">⌛</div><h2>'+(lang==='pt'?'Ligação expirada':'Link expired')+'</h2><p>'+(lang==='pt'?'Esta ligação privada já expirou. Entra na Área do Prestador para consultar o pedido em segurança.':'This private link has expired. Sign in to the Provider Area to view the request securely.')+'</p><button class="pr-app-continue" data-pr-app-continue>'+(lang==='pt'?'Ir para a Área do Prestador':'Go to Provider Area')+'</button>';
  }else{
    result.innerHTML='<div class="big">!</div><h2>'+(lang==='pt'?'Link inválido':'Invalid link')+'</h2><p>'+(lang==='pt'?'Este pedido já não está disponível ou o link não é válido.':'This request is no longer available or the link is invalid.')+'</p><button class="pr-app-continue" data-pr-app-continue>'+(lang==='pt'?'Ir para a Área do Prestador':'Go to Provider Area')+'</button>';
  }
  const c=result.querySelector('[data-pr-app-continue]');if(c)c.onclick=providerAppContinue;
}
async function openProviderBookingInApp(token){
  if(!token)return;activeProviderBookingToken=token;activeProviderRequestKind='direct';
  $('#splash').classList.add('hidden');$('#mainShell').classList.add('hidden');
  $('#providerRequestView').hidden=false;providerAppHideAll();$('#prAppLoading').hidden=false;
  const {data,error}=await db.rpc('booking_response_context',{p_token:token});
  if(error||!data||!data.ok){providerAppRenderState(data&&data.state==='link_expired'?'link_expired':'invalid');return}
  providerAppRenderState(data.state,data);
}
async function openServiceMatchInApp(token){
  if(!token)return;activeProviderBookingToken=token;activeProviderRequestKind='matching';
  $('#splash').classList.add('hidden');$('#mainShell').classList.add('hidden');
  $('#providerRequestView').hidden=false;providerAppHideAll();$('#prAppLoading').hidden=false;
  const {data,error}=await db.rpc('service_request_match_context',{p_token:token});
  if(error||!data||!data.ok){providerAppRenderState('invalid');return}
  const mapped={...data,service_date:data.requested_date||'',service_time:'',notes:data.description||'',requires_quote:data.pricing_type==='quote'};
  providerAppRenderState(data.state,mapped);
}
async function providerAppRespond(action){
  if(!activeProviderBookingToken)return;
  const quoteVisible=!$('#prAppQuoteBox').hidden;
  let amount=null;
  if(action==='accept'&&quoteVisible){
    amount=Number($('#prAppQuoteAmount').value);
    if(!amount||amount<=0){toast(lang==='pt'?'Indica o valor do orçamento.':'Enter the quote amount.');return}
    const total=amount+(Math.round(amount*TRIANGULO_SERVICE_FEE_RATE*100)/100);
    const question=lang==='pt'
      ?'Enviar este orçamento? Tu recebes '+formatEuro(amount)+' e o cliente verá '+formatEuro(total)+'. Depois de enviado não pode ser alterado.'
      :'Send this quote? You receive '+formatEuro(amount)+' and the customer will see '+formatEuro(total)+'. It cannot be changed after sending.';
    if(!window.confirm(question))return;
  }else if(action==='accept'){
    const question=activeProviderRequestKind==='matching'
      ?(lang==='pt'?'Confirmar que tens disponibilidade? O cliente será avisado e poderá escolher o teu serviço.':'Confirm that you are available? The customer will be notified and can choose your service.')
      :(lang==='pt'?'Aceitar este pedido? O serviço ficará confirmado e os contactos poderão ser disponibilizados.':'Accept this request? The service will be confirmed and contact details may be released.');
    if(!window.confirm(question))return;
  }

  $('#prAppAccept').disabled=true;$('#prAppDecline').disabled=true;
  let response;
  if(activeProviderRequestKind==='matching'){
    response=await db.rpc('respond_service_request_match',{p_token:activeProviderBookingToken,p_action:action,p_amount:amount});
  }else if(action==='accept'&&quoteVisible){
    response=await db.rpc('submit_booking_quote',{p_token:activeProviderBookingToken,p_amount:amount});
  }else{
    response=await db.rpc('respond_to_booking',{p_token:activeProviderBookingToken,p_action:action});
  }
  const {data,error}=response;
  $('#prAppAccept').disabled=false;$('#prAppDecline').disabled=false;
  if(error||!data||!data.ok){toast((data&&data.message)||(lang==='pt'?'Não foi possível responder.':'Could not respond.'));return}
  providerAppRenderState(data.state,data);
}
$('#prAppAccept').onclick=()=>providerAppRespond('accept');
$('#prAppDecline').onclick=()=>{if(window.confirm(lang==='pt'?'Tens a certeza de que não podes aceitar este pedido? Esta resposta é definitiva.':'Are you sure you cannot accept this request? This response is final.'))providerAppRespond('decline')};
$('#prAppQuoteAmount').addEventListener('input',updateProviderQuotePreview);
