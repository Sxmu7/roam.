/* ClipIT! Konto – kostenlos registrieren/anmelden. Das Konto merkt sich deine Reisen und Crew-Zugänge,
   damit du auf jedem Handy (oder am PC) weitermachen kannst. Videos bleiben auf dem Gerät bzw. in der Crew-Cloud. */
(function(){
  const $q=s=>document.querySelector(s);
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pop=(a,b)=>window.clipitTrips?.pop(a,b);
  const tok=()=>localStorage.getItem('clipit-auth');
  let me=load('clipit-me',null),syncing=false,lastTrips='';

  async function api(path,opt={}){const r=await fetch('/api/'+path,{...opt,headers:{'Content-Type':'application/json',...(tok()?{Authorization:'Bearer '+tok()}:{}),...opt.headers}});let d={};try{d=await r.json()}catch(e){}
    if(r.status===401&&tok()){logout(true)}if(!r.ok)throw Error(d.error||'Server nicht erreichbar');return d}
  const enabled=()=>!!(window.clipitCloud?.cfg?.accounts??load('clipit-cfg',{}).accounts);

  function applyUser(u,fresh){me=u;save('clipit-me',u);
    if(fresh&&u.device&&localStorage.getItem('clipit-device')!==u.device){localStorage.setItem('clipit-device',u.device);window.clipitCloud?.rehash();localStorage.removeItem('clipit-pushed')}
    try{if(u.name&&fresh){prefs.user=u.name;const i=$q('#username');if(i)i.value=u.name;savePrefs()}}catch(e){}
    paint()}
  function paint(){const b=$q('#acctBtn');if(!b)return;b.classList.toggle('on',!!me);b.innerHTML=me?'<span class="av">'+esc((me.name||'?')[0].toUpperCase())+'</span>':'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';b.setAttribute('aria-label',me?'Konto: '+me.name:'Anmelden')}

  async function sync(){
    if(!me||!tok()||syncing||!navigator.onLine)return;syncing=true;
    try{
      const T=window.clipitTrips;const local=T?.trips()||[];const prev=new Set(load('clipit-acct-synced',[]));
      const {user}=await api('me');
      // Server → Gerät: fehlende Reisen ergänzen (gelöschte nicht zurückholen)
      const removedHere=[...prev].filter(c=>!local.some(t=>t.code===c));
      const add=user.trips.filter(t=>!local.some(l=>l.code===t.code)&&!removedHere.includes(t.code));
      if(add.length){const all=local.concat(add.map(t=>({name:t.name,start:t.start,end:t.end,code:t.code,owner:false,created:Date.now(),...(t.cloud?{cloud:true,id:t.code.split('-').pop()}:{})})));
        save('clipit-trips',all);T?.renderHub?.();try{window.clipitTrips&&document.dispatchEvent(new Event('clipit-trips'))}catch(e){}}
      // Gerät → Server
      const now=T?.trips()||[];
      const body=now.map(t=>({code:t.code,name:t.name,start:t.start,end:t.end})).concat(removedHere.map(code=>({code,removed:true})));
      const r=await api('me',{method:'PUT',body:JSON.stringify({trips:body})});
      save('clipit-acct-synced',r.user.trips.map(t=>t.code));applyUser(r.user,false);lastTrips=JSON.stringify(now);
      if(add.length)pop('Reisen geladen',add.map(t=>t.name).join(', '));
    }catch(e){console.warn('sync',e)}finally{syncing=false}}

  function logout(silent){localStorage.removeItem('clipit-auth');localStorage.removeItem('clipit-me');localStorage.removeItem('clipit-acct-synced');me=null;paint();if(!silent)pop('Abgemeldet','Deine Clips bleiben auf diesem Gerät.')}

  function sheet(mode){let d=$q('#acctSheet');if(!d){d=document.createElement('dialog');d.id='acctSheet';d.className='sheet acct-sheet';document.body.appendChild(d)}
    let tab=mode||'register';
    const close=()=>{d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)};
    const draw=()=>{
      if(me){const n=(window.clipitTrips?.trips()||[]).length;
        d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Dein Konto</h2><button class="text-button" data-close>Fertig</button></div>'+
          '<div class="acct-card"><span class="av big">'+esc((me.name||'?')[0].toUpperCase())+'</span><div><b>'+esc(me.name)+'</b><small>'+esc(me.email)+'</small></div></div>'+
          '<div class="acct-stats"><div><b>'+n+'</b><span>Reisen synchronisiert</span></div><div><b>'+new Date(me.created).toLocaleDateString('de-DE',{month:'short',year:'numeric'})+'</b><span>dabei seit</span></div></div>'+
          '<label>Anzeigename</label><input id="acName" maxlength="40" value="'+esc(me.name)+'">'+
          '<button class="btn wide" id="acSync">Jetzt synchronisieren</button>'+
          '<p class="hl-hint">Auf einem neuen Handy oder am PC einfach anmelden: Reisen und Crew-Zugänge sind sofort da. Clips der Crew holst du dir im Reisen-Tab unter ☁.</p>'+
          '<div class="two"><button class="btn secondary" id="acOut">Abmelden</button><button class="btn secondary danger" id="acDel">Konto löschen</button></div>';
        d.querySelector('#acName').onchange=async e=>{try{const r=await api('me',{method:'PUT',body:JSON.stringify({name:e.target.value})});applyUser(r.user,true);pop('Gespeichert',r.user.name)}catch(err){pop('Fehler',err.message)}};
        d.querySelector('#acSync').onclick=async e=>{e.target.disabled=true;e.target.textContent='Synchronisiere …';await sync();e.target.disabled=false;e.target.textContent='✓ Synchronisiert';setTimeout(draw,900)};
        d.querySelector('#acOut').onclick=()=>{logout();draw()};
        d.querySelector('#acDel').onclick=async()=>{if(!confirm('Konto wirklich löschen? Clips auf dem Handy bleiben erhalten.'))return;try{await api('me',{method:'DELETE'})}catch(e){}logout(true);pop('Konto gelöscht','');draw()};
      }else{
        d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>'+(tab==='register'?'Konto erstellen':'Anmelden')+'</h2><button class="text-button" data-close>Später</button></div>'+
          (!enabled()?'<p class="sheet-sub">Konten werden gerade eingerichtet – gleich wieder vorbeischauen.</p>':
          '<div class="ins-tabs" data-os="'+(tab==='register'?'ios':'android')+'"><button data-t="register" class="'+(tab==='register'?'active':'')+'">Neu hier</button><button data-t="login" class="'+(tab==='login'?'active':'')+'">Anmelden</button><i></i></div>'+
          '<p class="sheet-sub">Kostenlos. Dein Konto speichert Reisen und Crew-Zugänge – so machst du auf jedem Handy oder am PC weiter.</p>'+
          '<form id="acForm" autocomplete="on">'+(tab==='register'?'<label>Name</label><input name="name" id="acN" autocomplete="nickname" maxlength="40" placeholder="Wie dich die Crew sieht">':'')+
          '<label>E-Mail</label><input name="email" id="acE" type="email" autocomplete="email" required placeholder="du@beispiel.de">'+
          '<label>Passwort</label><div class="pw"><input name="password" id="acP" type="password" autocomplete="'+(tab==='register'?'new-password':'current-password')+'" required minlength="8" placeholder="mind. 8 Zeichen"><button type="button" id="acEye" aria-label="Passwort zeigen">👁</button></div>'+
          (tab==='register'?'<div class="pw-meter"><i id="acM"></i></div>':'')+
          '<p class="field-note" id="acMsg"></p><button class="btn wide" type="submit" id="acGo">'+(tab==='register'?'Konto erstellen':'Anmelden')+'</button></form>'+
          '<p class="hl-hint">Mit dem Konto werden nur Name, E-Mail und deine Reisen gespeichert. Passwörter liegen nur verschlüsselt (scrypt) vor.</p>');
        d.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;draw()});
        const f=d.querySelector('#acForm');
        if(f){try{const n=d.querySelector('#acN');if(n&&prefs.user)n.value=prefs.user}catch(e){}
          d.querySelector('#acEye').onclick=()=>{const p=d.querySelector('#acP');p.type=p.type==='password'?'text':'password'};
          const m=d.querySelector('#acM');if(m)d.querySelector('#acP').oninput=e=>{const v=e.target.value;const s=Math.min(4,(v.length>=8)+(v.length>=12)+(/[A-Z]/.test(v)&&/[a-z]/.test(v))+(/\d|[^\w]/.test(v)));m.style.width=s*25+'%';m.dataset.s=s};
          f.onsubmit=async e=>{e.preventDefault();const g=d.querySelector('#acGo'),msg=d.querySelector('#acMsg');g.disabled=true;g.textContent='Einen Moment …';msg.textContent='';
            try{const r=await api('auth',{method:'POST',body:JSON.stringify({action:tab,email:d.querySelector('#acE').value,password:d.querySelector('#acP').value,name:d.querySelector('#acN')?.value,device:localStorage.getItem('clipit-device')||''})});
              localStorage.setItem('clipit-auth',r.token);applyUser(r.user,true);await sync();window.clipitTrips?.confetti?.();pop(tab==='register'?'Willkommen, '+r.user.name+'!':'Hallo '+r.user.name+'!','Konto verbunden');draw();
            }catch(err){msg.textContent=err.message;f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}finally{g.disabled=false;g.textContent=tab==='register'?'Konto erstellen':'Anmelden'}}}
      }
      d.querySelector('[data-close]').onclick=close;
    };
    draw();d.classList.remove('closing');if(!d.open)d.showModal();d.onclick=e=>{if(e.target===d)close()}}

  function ui(){const hr=$q('.header-right');if(!hr||$q('#acctBtn'))return;const b=document.createElement('button');b.id='acctBtn';b.className='icon-button acct-btn';b.onclick=()=>sheet(me?null:'register');hr.insertBefore(b,$q('#bellBtn')||hr.lastElementChild);paint();
    const anchor=$q('#quickSetup')||$q('#restartIntro');if(anchor&&!$q('#acctSetup')){const s=document.createElement('button');s.id='acctSetup';s.className=anchor.className;s.textContent=me?'Konto: '+me.name:'Konto erstellen / anmelden';s.onclick=()=>sheet(me?null:'register');anchor.parentNode.insertBefore(s,anchor)}
    const step=$q('.intro-step[data-step="1"]');if(step&&!$q('#introLogin')){const l=document.createElement('button');l.id='introLogin';l.type='button';l.className='text-button';l.textContent='Schon ein Konto? Anmelden →';l.onclick=()=>sheet('login');step.appendChild(l)}}
  function init(){ui();if(me&&tok())setTimeout(sync,1500);
    setInterval(()=>{const cur=JSON.stringify(window.clipitTrips?.trips()||[]);if(me&&cur!==lastTrips)sync()},8000);
    setInterval(sync,120000)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.clipitAccount={open:sheet,sync,get user(){return me}};
})();
