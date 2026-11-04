/* ClipIT! Cloud – gemeinsamer Reise-Speicher auf Vercel.
   - Reisen mit Cloud-Code (SLUG-XXXXXXXX) teilen Clips über /api
   - Auto-Upload eigener Clips (Warteschlange, übersteht Neustarts)
   - Crew-Clips ansehen und in die eigenen Clips übernehmen (für den gemeinsamen Film)
   - Mitteilungen, wenn andere hochladen (In-App + Web-Push) */
(function(){
  const $q=s=>document.querySelector(s);
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T=()=>window.clipitTrips;
  let device=localStorage.getItem('clipit-device');if(!device){device=crypto.randomUUID();localStorage.setItem('clipit-device',device)}
  let cfg=load('clipit-cfg',{cloud:false}),myHash='',busyUp=false;
  crypto.subtle?.digest('SHA-256',new TextEncoder().encode(device)).then(b=>{myHash=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24)});

  async function api(path,opt={}){const r=await fetch('/api/'+path,{...opt,headers:{'Content-Type':'application/json',...opt.headers}});let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw Error(d.error||'Server nicht erreichbar');return d}
  const isCloudCode=c=>/-[A-HJ-NP-Z2-9]{8}$/.test(String(c||'').trim().toUpperCase());
  const cloudTrips=()=>(T()?.trips()||[]).filter(t=>t.cloud);
  const tripOf=name=>cloudTrips().find(t=>t.name===name);
  const userName=()=>{try{return prefs.user||'Jemand'}catch(e){return 'Jemand'}};
  const auto=code=>load('clipit-autoup',{})[code]!==false;

  async function createTrip(t){const r=await api('trips',{method:'POST',body:JSON.stringify({name:t.name,start:t.start,end:t.end,device})});return r}
  async function fetchTrip(code){return api('trips?code='+encodeURIComponent(code.trim().toUpperCase()))}

  // ---------- Upload-Warteschlange ----------
  const queue=()=>load('clipit-upq',[]);
  function enqueue(id){const q=queue();if(!q.includes(id)){q.push(id);save('clipit-upq',q)}setTimeout(flush,800)}
  const getClip=id=>new Promise((ok,no)=>{try{tx('readonly',(s,r)=>{const g=s.get(id);g.onsuccess=()=>r(g.result)}).then(ok,no)}catch(e){no(e)}});
  async function flush(){
    if(busyUp||!cfg.cloud||!navigator.onLine||!window.ClipBlob||typeof db==='undefined'||!db)return;busyUp=true;
    try{
      const byTrip={};
      for(const id of queue()){
        const c=await getClip(id).catch(()=>null);const t=c&&tripOf(c.trip);
        if(!c||c.deletedAt||!t||c.cloudUrl){save('clipit-upq',queue().filter(x=>x!==id));continue}
        status(t.code,'Lädt hoch …');
        try{
          const ext=(c.name.split('.').pop()||'mp4').replace(/[^a-z0-9]/gi,'');
          const r=await ClipBlob.upload('trips/'+t.id+'/clips/'+c.id+'.'+ext,c.blob,{access:'public',handleUploadUrl:'/api/upload',clientPayload:JSON.stringify({code:t.code}),contentType:c.blob.type||'video/mp4',multipart:c.blob.size>8e6});
          await tx('readwrite',s=>s.put({...c,cloudUrl:r.url,cloudPath:r.pathname}));
          (byTrip[t.code]=byTrip[t.code]||[]).push({id:c.id,url:r.url,pathname:r.pathname,date:c.date,duration:c.duration,size:c.blob.size,type:c.blob.type,name:c.name,highlight:!!c.highlight});
          save('clipit-upq',queue().filter(x=>x!==id));
        }catch(e){console.warn('upload',e);status(t.code,'Upload pausiert – neuer Versuch gleich');break}
      }
      for(const [code,list] of Object.entries(byTrip)){await api('clips',{method:'POST',body:JSON.stringify({code,device,user:userName(),clips:list})}).catch(e=>console.warn(e));status(code,'')}
      if(Object.keys(byTrip).length){try{await refresh()}catch(e){}T()?.renderHub()}
    }finally{busyUp=false}
  }
  function status(code,txt){const el=document.querySelector('.hub-cloud[data-cloud="'+code+'"] .hc-status');if(el)el.textContent=txt}

  // eigene neue Clips automatisch einreihen
  function wrapAdd(){if(typeof add!=='function'||add.__clip)return;const orig=add;add=async function(...a){const c=await orig.apply(this,a);try{const t=c&&tripOf(c.trip);if(t&&!c.cloudUrl&&!c.cloudId&&auto(t.code))enqueue(c.id)}catch(e){}return c};add.__clip=1}

  // ---------- Crew-Feed ----------
  const crew=code=>load('clipit-crew-'+code,[]);
  async function poll(){
    if(!cfg.cloud||!navigator.onLine||document.hidden)return;
    for(const t of cloudTrips()){
      try{const since=load('clipit-since',{})[t.code]||0;const r=await api('clips?code='+encodeURIComponent(t.code)+'&since='+since);
        const s=load('clipit-since',{});s[t.code]=Math.max(since,...r.clips.map(c=>c.at),0);save('clipit-since',s);
        if(!r.clips.length)continue;
        const all=crew(t.code).filter(x=>!r.clips.some(y=>y.id===x.id)).concat(r.clips);save('clipit-crew-'+t.code,all);
        const theirs=r.clips.filter(c=>c.by!==myHash);
        if(since&&theirs.length){const who=[...new Set(theirs.map(c=>c.user))];const hl=theirs.filter(c=>c.highlight).length;
          const body=who.join(', ')+' '+(theirs.length===1?(hl?'hat ein ★ Highlight':'hat einen Clip'):'haben '+theirs.length+' Clips')+' hochgeladen';
          T()?.addNote(t.name,body,'☁');if(document.hidden)T()?.systemNotify(t.name,body)}
      }catch(e){console.warn('poll',e)}
    }
    T()?.renderHub();
  }

  function decorate(h){
    h.querySelectorAll('.hub-cloud').forEach(el=>{const code=el.dataset.cloud;const list=crew(code);const others=list.filter(c=>c.by!==myHash).length;
      const pending=queue().length;
      el.innerHTML='<button class="hc-crew" data-crew="'+esc(code)+'"><span class="hc-ic">☁</span><span><b>'+list.length+' in der Cloud</b><small>'+others+' von der Crew · ansehen &amp; übernehmen</small></span><i>›</i></button>'+
        '<div class="hc-row"><label class="hc-toggle"><input type="checkbox" data-auto="'+esc(code)+'"'+(auto(code)?' checked':'')+'><span></span>Eigene Clips automatisch hochladen</label><span class="hc-status">'+(pending?pending+' warten':'')+'</span></div>';
      el.querySelector('[data-crew]').onclick=()=>openCrew(code);
      el.querySelector('[data-auto]').onchange=e=>{const m=load('clipit-autoup',{});m[code]=e.target.checked;save('clipit-autoup',m);if(e.target.checked)uploadAll(code)};
    })}
  function uploadAll(code){const t=cloudTrips().find(x=>x.code===code);if(!t)return;try{clips.filter(c=>c.trip===t.name&&!c.cloudUrl&&!c.cloudId).forEach(c=>enqueue(c.id))}catch(e){}}

  function openCrew(code){const t=cloudTrips().find(x=>x.code===code);if(!t)return;let d=$q('#crewSheet');if(!d){d=document.createElement('dialog');d.id='crewSheet';d.className='sheet crew-sheet';document.body.appendChild(d)}
    const draw=()=>{const list=crew(code).slice().sort((a,b)=>a.date.localeCompare(b.date));let have=new Set();try{clips.forEach(c=>{if(c.cloudId)have.add(c.cloudId);if(c.cloudUrl)have.add(c.cloudUrl)})}catch(e){}
      const missing=list.filter(c=>!have.has(c.id)&&!have.has(c.url));
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>'+esc(t.name)+'</h2><button class="text-button" data-close>Fertig</button></div>'+
        '<p class="sheet-sub">'+list.length+' Clips von '+new Set(list.map(c=>c.user)).size+' Leuten. Übernommene Clips landen in deinen Dateien und im Film.</p>'+
        (missing.length?'<button class="btn wide" id="crewAll">Alle '+missing.length+' übernehmen</button>':'')+
        '<div class="crew-grid">'+(list.length?list.map((c,i)=>'<figure style="--i:'+i+'"'+(c.highlight?' class="hl"':'')+'><video src="'+esc(c.url)+'#t=0.4" preload="metadata" playsinline muted controls></video><figcaption><b>'+esc(c.user)+'</b><small>'+new Date(c.date).toLocaleString('de-DE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</small>'+
          ((have.has(c.id)||have.has(c.url))?'<span class="crew-ok">✓</span>':'<button class="text-button" data-take="'+esc(c.id)+'">＋</button>')+'</figcaption></figure>').join(''):'<div class="note-empty"><span>☁</span><b>Noch leer.</b><small>Sobald jemand filmt, tauchen die Clips hier auf.</small></div>')+'</div><p class="field-note" id="crewMsg"></p>';
      d.querySelector('[data-close]').onclick=()=>{d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)};
      d.querySelectorAll('[data-take]').forEach(b=>b.onclick=async()=>{b.textContent='…';await take(t,list.find(c=>c.id===b.dataset.take));draw()});
      const all=d.querySelector('#crewAll');if(all)all.onclick=async()=>{all.disabled=true;for(const [i,c] of missing.entries()){all.textContent='Lade '+(i+1)+' / '+missing.length+' …';await take(t,c)}draw()};};
    draw();d.classList.remove('closing');d.showModal();poll().then(()=>{if(d.open)draw()})}
  async function take(t,c){try{const r=await fetch(c.url);if(!r.ok)throw Error('Download fehlgeschlagen');const blob=await r.blob();
      await add(blob,new Date(c.date),c.duration,c.name,{user:c.user,trip:t.name,highlight:!!c.highlight,cloudUrl:c.url,cloudId:c.id})}
    catch(e){const m=$q('#crewMsg');if(m)m.textContent=e.message}}

  // ---------- Web-Push ----------
  async function pushSetup(){
    try{if(!cfg.push||!('PushManager' in window)||Notification.permission!=='granted')return;const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub){const k=cfg.push.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(k+'='.repeat((4-k.length%4)%4));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))})}
      const done=load('clipit-pushed',{});const key=sub.endpoint.slice(-24);
      for(const t of cloudTrips()){if(done[t.code]===key)continue;await api('push',{method:'POST',body:JSON.stringify({code:t.code,device,sub:sub.toJSON()})});done[t.code]=key;save('clipit-pushed',done)}
    }catch(e){console.warn('push',e)}}

  function fromNotification(){const q=new URLSearchParams(location.search);const code=q.get('trip');if(!code)return;history.replaceState(null,'',location.pathname);setTimeout(()=>{try{page('trips')}catch(e){}openCrew(code)},600)}

  async function init(){
    try{const r=await api('config');cfg=r;save('clipit-cfg',r)}catch(e){}
    window.clipitCloud.on=!!cfg.cloud;window.clipitCloud.cfg=cfg;
    wrapAdd();fromNotification();
    const wait=setInterval(()=>{if(typeof db!=='undefined'&&db){clearInterval(wait);flush();poll();pushSetup()}},400);
    setInterval(()=>{flush();poll();pushSetup()},45000);
    addEventListener('online',flush);document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();flush()}});
  }
  window.clipitCloud={on:!!cfg.cloud,cfg,isCloudCode,createTrip,fetchTrip,decorate,openCrew,flush,poll,uploadAll};
  init();
})();
