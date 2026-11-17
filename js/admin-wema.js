/* OptiSave v1.67 - Wema BVN Step 1 + Sandbox Integration Lab */
(()=>{
 const $=id=>document.getElementById(id);if(!$('bankLab')||!window.OptiSaveAdminAPI?.token())return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let cfg=null,ready=null;
 function status(message,kind='info'){
  const el=$('wemaLabStatus');el.hidden=false;el.className='bank-lab-message '+(kind==='error'?'error':kind==='success'?'success':'');el.textContent=message;
  if(kind!=='error')setTimeout(()=>{if(el.textContent===message)el.hidden=true},6000);
 }
 function consoleOut(label,data){$('wemaResponseConsole').textContent=`${label}\n${JSON.stringify(data,null,2)}`;$('wemaResponseConsole').scrollTop=0}
 function parseJson(id,label){const raw=$(id).value.trim();if(!raw)throw Error(`${label} is required.`);let v;try{v=JSON.parse(raw)}catch(_){throw Error(`${label} is not valid JSON.`)}if(!v||Array.isArray(v)||typeof v!=='object')throw Error(`${label} must be a JSON object.`);return v}
 function setState(id,ok,yes='Ready',no='Missing'){const el=$(id);el.textContent=ok?yes:no;el.className=ok?'ok':'missing'}
 function readinessHtml(){
  const c=ready?.configuration||{},t=ready?.tests||{};
  const rows=[['API base URL',c.baseUrl],['Wallet credential',c.walletKey],['Transfer credential',c.accessKey],['API management credential',c.subscriptionKey],['Channel ID',c.channelId],['Connection / bank list',t.connection],['BVN account creation - Step 1',t.bvnAccountCreate],['NIN wallet creation request',t.walletCreate],['Wallet OTP validation',t.walletOtp],['Wallet lookup',t.walletLookup],['Destination enquiry',t.destinationEnquiry],['Debit transfer request',t.debitTransfer],['Wallet callback received',t.walletCallback],['Transaction callback received',t.transactionCallback],['Authorization callback received',t.authorizationCallback]];
  $('wemaReadiness').innerHTML=rows.map(([name,ok])=>`<div class="readiness-row"><i class="fa-solid ${ok?'fa-circle-check':'fa-circle'} ${ok?'passed':''}"></i><span>${esc(name)}</span><b>${ok?'Passed':'Pending'}</b></div>`).join('');
 }
 function handoffSummary(){
  const t=ready?.tests||{},passed=Object.values(t).filter(Boolean).length,total=Object.keys(t).length;
  const done=Object.entries(t).filter(([,v])=>v).map(([k])=>k.replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase())).join(', ')||'No API tests completed yet';
  $('wemaHandoffSummary').value=`OptiSave Digital Solutions Ltd – Wema ALAT Sandbox Integration\n\nWe have implemented the Wema ALAT Open API sandbox integration in our OptiSave admin environment and completed ${passed} of ${total} tracked technical checks.\n\nSuccessful checks: ${done}.\n\nOur test integration is isolated from real customer balances and uses backend-only API credentials, auditable test logs and profiled callback endpoints for wallet/transaction events and debit authorization.\n\nWe are ready to discuss production onboarding and would appreciate Wema Bank's requirements for live credentials, commercial terms, KYC/AML responsibilities, settlement/customer-funds structure, security review, transaction limits and any regulatory conditions applicable to OptiSave.`;
 }
 async function loadConfig(){
  try{
   cfg=await OptiSaveAdminAPI.wemaConfig();ready=cfg.readiness||{};
   $('wemaConfiguredBadge').textContent=cfg.enabled?'LAB ENABLED':'LAB DISABLED';$('wemaConfiguredBadge').className=cfg.enabled?'ok':'warn';
   setState('wemaBaseStatus',cfg.baseUrlConfigured,'Configured','Missing');$('wemaBaseUrl').textContent=cfg.baseUrl||'Set WEMA_API_BASE_URL';
   setState('wemaWalletKeyStatus',cfg.walletKeyConfigured,'Configured','Missing');$('wemaWalletHeader').textContent=cfg.walletKeyConfigured?`Header: ${cfg.walletHeader}`:'Set WEMA_API_KEY';
   setState('wemaAccessKeyStatus',cfg.accessKeyConfigured,'Configured','Missing');$('wemaAccessHeader').textContent=cfg.accessKeyConfigured?`Header: ${cfg.accessHeader}`:'Set WEMA_ACCESS_KEY';
   setState('wemaSubscriptionStatus',cfg.subscriptionKeyConfigured,'Configured','Optional');$('wemaSubscriptionHeader').textContent=cfg.subscriptionKeyConfigured?`Header: ${cfg.subscriptionHeader}`:'Set only if Wema assigns an API Management subscription key';
   setState('wemaChannelStatus',cfg.channelIdConfigured,'Configured','Optional / pending');$('wemaChannelId').textContent=cfg.channelId||'Set WEMA_CHANNEL_ID when Wema assigns it';
   $('wemaBvnEndpoint').textContent=cfg.bvnStep1Endpoint||'https://apiplayground.alat.ng/account-creation/api/CustomerAccount/PostPartnershipAccountCreationWithBvn';
   const cb=cfg.callbacks||{};$('wemaWalletCallback').textContent=cb.wallet||'Set APP_BASE_URL first';$('wemaTransactionCallback').textContent=cb.transaction||'Set APP_BASE_URL first';$('wemaAuthorizeCallback').textContent=cb.authorize||'Set APP_BASE_URL first';
   readinessHtml();handoffSummary();
  }catch(e){status(e.message||'Unable to load Wema lab configuration.','error')}
 }
 async function loadLogs(){
  try{const d=await OptiSaveAdminAPI.wemaLogs(100),rows=d.logs||[];$('wemaSandboxLogs').innerHTML=rows.length?`<table class="admin-table"><thead><tr><th>Event</th><th>Action</th><th>Status</th><th>HTTP</th><th>Time</th><th>When</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.event_type||'request')}</td><td><b>${esc(String(x.action||'').replaceAll('_',' '))}</b>${x.error_text?`<br><small class="bank-log-error">${esc(x.error_text)}</small>`:''}</td><td><span class="status-pill ${x.ok?'success-pill':'warning-pill'}">${x.ok?'PASS':'FAILED'}</span></td><td>${x.http_status??'—'}</td><td>${x.latency_ms!=null?Number(x.latency_ms).toLocaleString()+' ms':'—'}</td><td>${x.created_at?new Date(x.created_at).toLocaleString():'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-admin">No Wema sandbox tests recorded yet.</div>'}catch(e){$('wemaSandboxLogs').innerHTML='<div class="empty-admin">Unable to load Wema sandbox logs.</div>'}}
 async function run(action,payload,label,button){
  const old=button?.innerHTML;if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Testing…'}
  try{const d=await OptiSaveAdminAPI.wemaRun(action,payload||{});consoleOut(label,d);status(`${label} completed successfully in ${Number(d.latencyMs||0).toLocaleString()} ms.`,'success');await Promise.all([loadConfig(),loadLogs()]);return d}
  catch(e){consoleOut(label,{ok:false,error:e.message});status(e.message||`${label} failed.`,'error');throw e}
  finally{if(button){button.disabled=false;button.innerHTML=old}}
 }
 $('refreshWemaLab').onclick=()=>Promise.all([loadConfig(),loadLogs()]);$('refreshWemaLogs').onclick=loadLogs;$('clearWemaConsole').onclick=()=>$('wemaResponseConsole').textContent='Run a sandbox test to see the response here.';
 document.querySelectorAll('.copy-bank-value').forEach(btn=>btn.onclick=async()=>{const text=$(btn.dataset.copy)?.textContent||'';try{await navigator.clipboard.writeText(text);status('Callback URL copied.','success')}catch(_){status('Copy was blocked by the browser. Select the URL and copy it manually.','error')}});
 $('copyWemaSummary').onclick=async()=>{try{await navigator.clipboard.writeText($('wemaHandoffSummary').value);status('Production handoff summary copied.','success')}catch(_){$('wemaHandoffSummary').select();status('Your browser blocked automatic copy. The summary is selected for manual copy.','error')}};
 $('wemaGetBanks').onclick=()=>run('banks',{},'Get Bank List',$('wemaGetBanks')).catch(()=>{});
 $('wemaBvnStep1').onclick=()=>{
  const payload={phoneNumber:$('wemaBvnPhone').value.trim(),email:$('wemaBvnEmail').value.trim(),bvn:$('wemaBvnValue').value.trim()};
  run('bvn_account_create',payload,'BVN Account Creation - Step 1',$('wemaBvnStep1')).then(d=>{
   const x=d?.data||{},tracking=x.trackingId||x.trackingID||x.reference||x.requestId||x.result?.trackingId||x.result?.trackingID||x.data?.trackingId||x.data?.trackingID||'';
   $('wemaBvnTrackingId').value=tracking||'';
   $('wemaBvnValue').value='';
  }).catch(()=>{});
 };
 $('wemaLookupWallet').onclick=()=>run('wallet_lookup',{accountNumber:$('wemaWalletAccount').value.trim()},'Wallet Lookup',$('wemaLookupWallet')).catch(()=>{});
 $('wemaCreateWallet').onclick=()=>{try{run('wallet_create',{payload:parseJson('wemaWalletCreateJson','Wallet creation JSON')},'Wallet Creation',$('wemaCreateWallet')).then(d=>{const x=d?.data||{};const tracking=x.trackingId||x.trackingID||x.result?.trackingId||x.result?.trackingID;if(tracking)$('wemaTrackingId').value=tracking}).catch(()=>{})}catch(e){status(e.message,'error')}};
 $('wemaValidateOtp').onclick=()=>run('wallet_otp',{trackingId:$('wemaTrackingId').value.trim(),phoneNumber:$('wemaOtpPhone').value.trim(),otp:$('wemaOtp').value.trim()},'Wallet OTP Validation',$('wemaValidateOtp')).catch(()=>{});
 $('wemaSourceName').onclick=()=>run('source_name',{accountNumber:$('wemaSourceAccount').value.trim()},'Source Name Enquiry',$('wemaSourceName')).catch(()=>{});
 $('wemaDestinationName').onclick=()=>run('destination_name',{bankCode:$('wemaBankCode').value.trim(),accountNumber:$('wemaDestinationAccount').value.trim()},'Destination Account Enquiry',$('wemaDestinationName')).catch(()=>{});
 $('wemaNipCharges').onclick=()=>run('nip_charges',{},'NIP Charges',$('wemaNipCharges')).catch(()=>{});
 $('wemaDebitTransfer').onclick=()=>{try{run('debit_transfer',{payload:parseJson('wemaTransferJson','Transfer JSON')},'Sandbox Debit Transfer',$('wemaDebitTransfer')).catch(()=>{})}catch(e){status(e.message,'error')}};
 $('wemaWalletHistory').onclick=()=>{try{run('wallet_history',{payload:parseJson('wemaHistoryJson','History request JSON')},'Wallet Transaction History',$('wemaWalletHistory')).catch(()=>{})}catch(e){status(e.message,'error')}};
 Promise.all([loadConfig(),loadLogs()]);
})();
