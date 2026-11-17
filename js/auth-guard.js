/* OptiSave fast auth guard.
   Protected API routes remain the security boundary. The UI no longer hides the
   entire document while /api/auth/me crosses the network on every page change. */
(function(){
  if(!window.OptiSaveAPI)return;
  if(!OptiSaveAPI.token()){ location.replace('login.html'); return; }

  const cached=OptiSaveAPI.currentUser();
  if(cached){
    localStorage.setItem('username',(cached.fullName||cached.email||'User').split(' ')[0]);
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('optisave:auth-ready',{detail:cached})));
  }

  // Validate the token in the background. Invalid/expired sessions are still
  // redirected, but valid users are not forced to stare at a blank page first.
  OptiSaveAPI.me().then(({user})=>{
    const store=localStorage.getItem('optisave_auth_token')?localStorage:sessionStorage;
    store.setItem('optisave_auth_user',JSON.stringify(user));
    localStorage.setItem('username',(user.fullName||user.email||'User').split(' ')[0]);
    document.dispatchEvent(new CustomEvent('optisave:auth-ready',{detail:user}));
  }).catch(()=>{ OptiSaveAPI.clearSession(); location.replace('login.html'); });
})();
