/* ClipIT! → Google Drive: Clips in "ClipIT!/<Reise>" im eigenen Drive sichern.
   Nutzt Google Identity Services (Scope drive.file: ClipIT! sieht nur die eigenen hochgeladenen Dateien). */
(function(){
  const $q=s=>document.querySelector(s);
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pop=(a,b)=>window.clipitTrips?.pop(a,b);
  let clientId=null,token=null,expires=0,tokenClient=null,running=false;
  try{const t=JSON.parse(sessionStorage.getItem('clipit-gtoken')||'null');if(t&&t.exp>Date.now()){token=t.t;expires=t.exp}}catch(e){}
  const linked=()=>!!localStorage.getItem('clipit-drive');
  const autoOn=()=>localStorage.getItem('clipit-drive-auto')!=='0';
  const valid=()=>token&&Date.now()<expires-60000;

  async function config(){if(clientId!==null)return clientId;try{const r=await fetch('/api/config');clientId=(await r.json()).googleClientId||''}catch(e){clientId=load('clipit-cfg',{}).googleClientId||''}return clientId}
  function gis(){return new Promise((ok,no)=>{if(window.google?.accounts?.oauth2)return ok();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=ok;s.onerror=()=>no(Error('Google nicht erreichbar'));document.head.appendChild(s)})}
  async function connect(silent){
    const id=await config();if(!id)throw Error('Google Drive ist noch nicht freigeschaltet.');
    await gis();
    return new Promise((ok,no)=>{
      tokenClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:'https://www.googleapis.com/auth/drive.file',
        callback:r=>{if(r.error)return no(Error(r.error));token=r.access_token;expires=Date.now()+(r.expires_in||3600)*1000;
          sessionStorage.setItem('clipit-gtoken',JSON.stringify({t:token,exp:expires}));localStorage.setItem('clipit-drive','1');ok()},
        error_callback:e=>no(Error(e.type==='popup_closed'?'Abgebrochen':'Anmeldung fehlgeschlagen'))});
      tokenClient.requestAccessToken({prompt:silent?'':'consent'});
    });
  }
  async function g(path,opt={}){const r=await fetch('https://www.googleapis.com/'+path,{...opt,headers:{Authorization:'Bearer '+token,...opt.headers}});if(r.status===401){token=null;throw Error('Drive-Anmeldung abgelaufen')}if(!r.ok)throw Error('Drive-Fehler '+r.status);return r}
  async function folder(name,parent){
    const cache=load('clipit-drive-folders',{}),key=(parent||'root')+'/'+name;if(cache[key])return cache[key];
    const q="name='"+name.replace(/'/g,"\\'")+"' and mimeType='application/vnd.google-apps.folder' and trashed=false"+(parent?" and '"+parent+"' in parents":'');
    let f=(await (await g('drive/v3/files?fields=files(id)&q='+encodeURIComponent(q))).json()).files?.[0];
    if(!f)f=await (await g('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})})})).json();
    cache[key]=f.id;save('clipit-drive-folders',cache);return f.id}
  async function uploadClip(c){
    const root=await folder('ClipIT!'),dir=await folder(c.trip||'Clips',root);
    const meta={name:c.name,parents:[dir],description:'ClipIT! · '+(c.user||'')+' · '+new Date(c.date).toLocaleString('de-DE')+(c.highlight?' · ★ Highlight':'')};
    const init=await g('upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':c.blob.type||'video/mp4'},body:JSON.stringify(meta)});
    const loc=init.headers.get('Location');const r=await fetch(loc,{method:'PUT',headers:{'Content-Type':c.blob.type||'video/mp4'},body:c.blob});if(!r.ok)throw Error('Upload fehlgeschlagen');
    const {id}=await r.json();await tx('readwrite',s=>s.put({...c,driveId:id}));return id}
  const open=()=>{try{return clips.filter(c=>!c.driveId)}catch(e){return []}};
  async function backup(list,onp){if(running)return;running=true;let n=0;
    try{for(const c of list){onp?.(n,list.length);await uploadClip(c);n++}onp?.(n,list.length);try{await refresh()}catch(e){}}finally{running=false}return n}

  // automatische Sicherung neuer Clips, wenn Drive verbunden und Token gültig
  function wrapAdd(){if(typeof add!=='function'||add.__drive)return;const orig=add;add=async function(...a){const c=await orig.apply(this,a);
    if(c&&linked()&&autoOn()){if(valid())setTimeout(()=>backup([c]).catch(e=>console.warn(e)),1500);else{const q=load('clipit-drive-q',[]);q.push(c.id);save('clipit-drive-q',q);badge()}}return c};add.__drive=1;add.__clip=orig.__clip}
  function badge(){const b=$q('#driveSetup');if(b)b.dataset.count=linked()&&open().length?String(open().length):''}

  function sheet(){let d=$q('#driveSheet');if(!d){d=document.createElement('dialog');d.id='driveSheet';d.className='sheet';document.body.appendChild(d)}
    const draw=async()=>{const id=await config();const n=open().length;
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Google Drive</h2><button class="text-button" data-close>Fertig</button></div>'+
        '<div class="drive-hero"><span class="drive-logo"><i></i><i></i><i></i></span><div><b>'+(linked()?'Verbunden':'Clips im eigenen Drive sichern')+'</b><small>Ordner „ClipIT! / Reisename“ · Originaldateien in voller Qualität</small></div></div>'+
        (!id?'<p class="sheet-sub">Drive ist für diese App noch nicht freigeschaltet. Sobald der Inhaber die Google-Anmeldung eingerichtet hat, erscheint hier „Verbinden“.</p>':
        (linked()?'<label class="hc-toggle drive-auto"><input type="checkbox" id="drAuto"'+(autoOn()?' checked':'')+'><span></span>Neue Clips automatisch sichern</label>'+
          '<div class="drive-count"><b>'+n+'</b><span>'+(n===1?'Clip noch nicht gesichert':'Clips noch nicht gesichert')+'</span></div>'+
          '<div class="hl-prog hidden" id="drProg"><div><i id="drBar"></i></div><span id="drTxt"></span></div>'+
          '<button class="btn wide" id="drNow"'+(n?'':' disabled')+'>'+(n?'Jetzt sichern':'Alles gesichert ✓')+'</button><button class="text-button wide" id="drOff">Verbindung trennen</button>'
          :'<p class="sheet-sub">Du meldest dich bei Google an. ClipIT! bekommt nur Zugriff auf die Dateien, die es selbst anlegt – nicht auf den Rest deines Drives.</p><button class="btn wide" id="drGo">Mit Google verbinden</button>'))+'<p class="field-note" id="drMsg"></p>';
      d.querySelector('[data-close]').onclick=()=>{d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)};
      const msg=t=>{d.querySelector('#drMsg').textContent=t};
      d.querySelector('#drGo')?.addEventListener('click',async()=>{try{await connect(false);pop('Drive verbunden','Clips landen in ClipIT! / Reise');draw()}catch(e){msg(e.message)}});
      d.querySelector('#drAuto')?.addEventListener('change',e=>localStorage.setItem('clipit-drive-auto',e.target.checked?'1':'0'));
      d.querySelector('#drOff')?.addEventListener('click',()=>{try{google?.accounts?.oauth2?.revoke(token)}catch(e){}token=null;localStorage.removeItem('clipit-drive');sessionStorage.removeItem('clipit-gtoken');draw();badge()});
      d.querySelector('#drNow')?.addEventListener('click',async e=>{const b=e.target;b.disabled=true;try{if(!valid())await connect(true);d.querySelector('#drProg').classList.remove('hidden');
        const k=await backup(open(),(i,t)=>{d.querySelector('#drBar').style.width=(t?100*i/t:100)+'%';d.querySelector('#drTxt').textContent=i<t?'Sichere '+(i+1)+' von '+t+' …':'Fertig'});
        save('clipit-drive-q',[]);pop('In Drive gesichert',k+' Clip'+(k===1?'':'s'));setTimeout(draw,600);badge()}catch(err){msg(err.message);b.disabled=false}});
    };
    draw();d.classList.remove('closing');d.showModal()}

  function ui(){const anchor=$q('#quickSetup')||$q('#restartIntro');if(!anchor||$q('#driveSetup'))return;
    const b=document.createElement('button');b.id='driveSetup';b.type='button';b.className=anchor.className||'btn secondary wide';b.textContent='Google Drive Sicherung';b.onclick=sheet;anchor.after(b);badge()}
  function init(){ui();wrapAdd();setTimeout(badge,1500)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.clipitDrive={open:sheet,backup,connect};
})();
