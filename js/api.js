(function(){
  const TOKEN_KEY="optisave_auth_token";
  const USER_KEY="optisave_auth_user";
  function token(){ return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; }
  function saveSession(data, remember){
    clearSession();
    const store=remember?localStorage:sessionStorage;
    if(data && data.token) store.setItem(TOKEN_KEY,data.token);
    if(data && data.user) store.setItem(USER_KEY,JSON.stringify(data.user));
  }
  function clearSession(){
    [localStorage,sessionStorage].forEach(s=>{s.removeItem(TOKEN_KEY);s.removeItem(USER_KEY);});
  }
  function currentUser(){
    for(const s of [localStorage,sessionStorage]){try{const v=s.getItem(USER_KEY);if(v)return JSON.parse(v)}catch(_){}}
    return null;
  }
  async function request(path,options={}){
    const headers={Accept:"application/json",...(options.headers||{})};
    if(options.body && !(options.body instanceof FormData)) headers["Content-Type"]="application/json";
    const t=token(); if(t) headers.Authorization=`Bearer ${t}`;
    const res=await fetch(path,{...options,headers});
    let data={}; try{data=await res.json()}catch(_){data={error:`Request failed (${res.status})`}}
    if(res.status===401 && !path.endsWith('/login')) clearSession();
    if(!res.ok){const e=new Error(data.error||`Request failed (${res.status})`);e.status=res.status;e.data=data;throw e}
    return data;
  }
  function newRequestKey(){
    try{if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==="function")return globalThis.crypto.randomUUID()}catch(_){}
    return `req-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
  async function financialRequest(scope,path,options={}){
    const storageKey=`optisave_idem_${scope}`;
    let idem=sessionStorage.getItem(storageKey);
    if(!idem){idem=newRequestKey();sessionStorage.setItem(storageKey,idem)}
    try{
      const out=await request(path,{...options,headers:{...(options.headers||{}),"Idempotency-Key":idem}});
      sessionStorage.removeItem(storageKey);return out;
    }catch(e){
      // A definite 4xx response means the server did not leave an unknown financial state.
      // Network/5xx failures retain the same key so retrying cannot duplicate the action.
      if(e&&e.status&&(e.status<500||e.data?.safeToRetry))sessionStorage.removeItem(storageKey);
      throw e;
    }
  }
  window.OptiSaveAPI={token,saveSession,clearSession,currentUser,request,
    register:body=>request('/api/auth/register',{method:'POST',body:JSON.stringify(body)}),
    login:body=>request('/api/auth/login',{method:'POST',body:JSON.stringify(body)}),
    verifyLogin:body=>request('/api/auth/login/verify',{method:'POST',body:JSON.stringify(body)}),
    verifyEmail:body=>request('/api/auth/verify-email',{method:'POST',body:JSON.stringify(body)}),
    resendOtp:body=>request('/api/auth/otp/resend',{method:'POST',body:JSON.stringify(body)}),
    requestPasswordReset:body=>request('/api/auth/password/request',{method:'POST',body:JSON.stringify(body)}),
    resetPassword:body=>request('/api/auth/password/reset',{method:'POST',body:JSON.stringify(body)}),
    changePassword:body=>request('/api/auth/security/password',{method:'POST',body:JSON.stringify(body)}),
    requestPinReset:()=>request('/api/auth/security/pin/request',{method:'POST'}),
    confirmPinReset:body=>request('/api/auth/security/pin/confirm',{method:'POST',body:JSON.stringify(body)}),
    securityActivity:()=>request('/api/security/activity'),
    sessions:()=>request('/api/security/sessions'),
    revokeSession:id=>request('/api/security/sessions/'+encodeURIComponent(id),{method:'DELETE'}),
    revokeOtherSessions:()=>request('/api/security/sessions/revoke-others',{method:'POST'}),
    me:()=>request('/api/auth/me'),
    wallet:()=>request('/api/wallet'),
    paymentMode:()=>request('/api/payments/mode'),
    createPlan:data=>financialRequest("create-plan",'/api/plans',{method:'POST',body:JSON.stringify(data)}),
    planActions:id=>request('/api/plans/'+encodeURIComponent(id)+'/actions'),
    dailyEvents:id=>request('/api/plans/'+encodeURIComponent(id)+'/daily-events'),
    emergencyWithdraw:id=>financialRequest("emergency-"+id,'/api/plans/'+encodeURIComponent(id)+'/emergency-withdraw',{method:'POST'}),
    dailyEarlyAccess:id=>financialRequest("daily-early-"+id,'/api/plans/'+encodeURIComponent(id)+'/daily-early-access',{method:'POST'}),
    convertAllocation:(id,data)=>financialRequest("convert-allocation-"+id,'/api/plans/'+encodeURIComponent(id)+'/convert-allocation',{method:'POST',body:JSON.stringify(data)}),
    banks:()=>request('/api/banks'),
    resolveBank:(bankCode,accountNumber)=>request('/api/banks/resolve?bank_code='+encodeURIComponent(bankCode)+'&account_number='+encodeURIComponent(accountNumber)),
    bankAccount:()=>request('/api/bank-account'),
    profile:()=>request('/api/profile'),
    saveProfile:data=>request('/api/profile',{method:'PUT',body:JSON.stringify(data)}),
    submitKyc:data=>request('/api/kyc',{method:'POST',body:JSON.stringify(data)}),
    startIdentityVerification:data=>request('/api/kyc/provider-verify',{method:'POST',body:JSON.stringify(data)}),
    saveBankAccount:data=>request('/api/bank-account',{method:'POST',body:JSON.stringify(data)}),
    prepareBankRecipient:data=>request('/api/bank-account/prepare-recipient',{method:'POST',body:JSON.stringify(data)}),
    transactions:()=>request('/api/transactions'),
    notifications:()=>request('/api/notifications'),
    markNotificationRead:id=>request('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'PATCH'}),
    markAllNotificationsRead:()=>request('/api/notifications/read-all',{method:'POST'}),
    settings:()=>request('/api/settings'),
    saveNotificationPreferences:data=>request('/api/settings/notifications',{method:'PUT',body:JSON.stringify(data)}),
    state:()=>request('/api/state'),
    financialAudit:()=>request('/api/financial-audit'),
    initializeDeposit:amount=>financialRequest("deposit-init",'/api/payments/deposits/initialize',{method:'POST',body:JSON.stringify({amount})}),
    verifyDeposit:reference=>request('/api/payments/deposits/verify',{method:'POST',body:JSON.stringify({reference})}),
    createWithdrawal:(amount,note)=>financialRequest("withdrawal",'/api/payments/withdrawals',{method:'POST',body:JSON.stringify({amount,note})}),
    devDeposit:amount=>financialRequest("dev-deposit",'/api/wallet/dev-deposit',{method:'POST',body:JSON.stringify({amount})}),
    devWithdraw:(amount,note)=>financialRequest("dev-withdraw",'/api/wallet/dev-withdraw',{method:'POST',body:JSON.stringify({amount,note})}),
    logout(){clearSession();location.replace('index.html')}
  };
})();
