/* ClipIT! Cloud – gemeinsamer Reise-Speicher (Gratis-Rahmen: Vercel Blob 1 GB + Upstash Redis).
   - Reisen mit Cloud-Code (SLUG-XXXXXXXX) teilen Clips über /api
   - Auto-Upload eigener Clips als platzsparende Crew-Kopie (Warteschlange, übersteht Neustarts)
   - Crew-Clips ansehen, reagieren (🔥😂😍👑), Clip des Tages, in eigene Clips übernehmen
   - Mitteilungen, wenn andere hochladen + abendliche Erinnerung */
(function(){
  const $q=s=>document.querySelector(s);
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T=()=>window.clipitTrips;
  const EMO=['🔥','😂','😍','👑'];
  const dev=()=>{let d=localStorage.getItem('clipit-device');if(!d){d=crypto.randomUUID();localStorage.setItem('clipit-device',d)}return d};
  let cfg=load('clipit-cfg',{cloud:false}),myHash='',busyUp=false;
  async function rehash(){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(dev()));myHash=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24)}catch(e){}}
  rehash();

  async function api(path,opt={}){const r=await fetch('/api/'+path,{...opt,headers:{'Content-Type':'application/json',...opt.headers}});let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw Error(d.error||'Server nicht erreichbar');return d}
  const isCloudCode=c=>/-[A-HJ-NP-Z2-9]{8}$/.test(String(c||'').trim().toUpperCase());
  const cloudTrips=()=>(T()?.trips()||[]).filter(t=>t.cloud);
  const tripOf=name=>cloudTrips().find(t=>t.name===name);
  const userName=()=>{try{return prefs.user||'Jemand'}catch(e){return 'Jemand'}};
  const auto=code=>load('clipit-autoup',{})[code]!==false;
  const saver=()=>localStorage.getItem('clipit-share-quality')!=='original';
  const mb=b=>(b/1048576).toFixed(b>1e9?1:0);

  async function createTrip(t){return api('trips',{method:'POST',body:JSON.stringify({name:t.name,start:t.start,end:t.end,device:dev()})})}
  async function fetchTrip(code){return api('trips?code='+encodeURIComponent(code.trim().toUpperCase()))}

  // ---------- platzsparende Crew-Kopie (≈ 960 px, 1,6 Mbit/s) ----------
  async function shareCopy(blob,onp){
    if(!saver()||blob.size<3.5e6)return blob;
    const url=URL.createObjectURL(blob),v=document.createElement('video');v.src=url;v.playsInline=true;v.preload='auto';
    v.style.cssText='position:fixed;left:-9999px;width:2px;height:2px';document.body.appendChild(v);
    try{
      await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error('Video nicht lesbar'))});
      if(!isFinite(v.duration)){v.currentTime=1e7;await new Promise(r=>{v.ondurationchange=r;setTimeout(r,1500)});v.currentTime=0;await new Promise(r=>{v.onseeked=r;setTimeout(r,800)})}
      const s=Math.min(1,960/Math.max(v.videoWidth,v.videoHeight));const c=document.createElement('canvas');c.width=Math.round(v.videoWidth*s/2)*2;c.height=Math.round(v.videoHeight*s/2)*2;const g=c.getContext('2d');
      const out=c.captureStream(30);let actx=null;
      try{actx=new (window.AudioContext||window.webkitAudioContext)();const src=actx.createMediaElementSource(v),d=actx.createMediaStreamDestination();src.connect(d);d.stream.getAudioTracks().forEach(t=>out.addTrack(t))}catch(e){v.muted=true}
      const type=['video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const rec=new MediaRecorder(out,{...(type?{mimeType:type}:{}),videoBitsPerSecond:1.6e6,audioBitsPerSecond:96e3}),ch=[];rec.ondataavailable=e=>e.data.size&&ch.push(e.data);
      let on=true;const draw=()=>{if(!on)return;g.drawImage(v,0,0,c.width,c.height);onp?.(v.currentTime/(v.duration||1));v.requestVideoFrameCallback?v.requestVideoFrameCallback(draw):requestAnimationFrame(draw)};
      try{await v.play()}catch(e){v.muted=true;await v.play()}
      draw();rec.start(500);await new Promise(r=>{v.onended=r;setTimeout(r,(v.duration+2)*1000)});on=false;
      await new Promise(r=>{rec.onstop=r;rec.stop()});try{actx?.close()}catch(e){}
      const small=new Blob(ch,{type:rec.mimeType||type});return small.size&&small.size<blob.size?small:blob;
    }catch(e){console.warn('shareCopy',e);return blob}finally{v.remove();URL.revokeObjectURL(url)}
  }

  // ---------- Upload-Warteschlange ----------
  const queue=()=>load('clipit-upq',[]);
  function enqueue(id){const q=queue();if(!q.includes(id)){q.push(id);save('clipit-upq',q)}setTimeout(flush,800)}
  const getClip=id=>new Promise((ok,no)=>{try{tx('readonly',(s,r)=>{const g=s.get(id);g.onsuccess=()=>r(g.result)}).then(ok,no)}catch(e){no(e)}});
  async function putBlob(t,id,blob,kind='clips'){
    const ext=blob.type.includes('mp4')?'mp4':'webm';
    return ClipBlob.upload('trips/'+t.id+'/'+kind+'/'+id+'.'+ext,blob,{access:'public',handleUploadUrl:'/api/upload',clientPayload:JSON.stringify({code:t.code,size:blob.size}),contentType:blob.type||'video/mp4',multipart:blob.size>90e6})}
  async function flush(){
    if(busyUp||!cfg.cloud||!navigator.onLine||!window.ClipBlob||typeof db==='undefined'||!db)return;busyUp=true;
    try{
      const byTrip={};
      for(const id of queue()){
        const c=await getClip(id).catch(()=>null);const t=c&&tripOf(c.trip);
        if(!c||c.deletedAt||!t||c.cloudUrl||c.film){save('clipit-upq',queue().filter(x=>x!==id));continue}
        status(t.code,'Bereite vor …');
        try{
          const small=await shareCopy(c.blob,p=>status(t.code,'Verkleinere '+Math.round(p*100)+' %'));
          status(t.code,'Lädt hoch …');
          const r=await putBlob(t,c.id,small);
          await tx('readwrite',s=>s.put({...c,cloudUrl:r.url,cloudPath:r.pathname}));
          (byTrip[t.code]=byTrip[t.code]||[]).push({id:c.id,url:r.url,pathname:r.pathname,date:c.date,duration:c.duration,size:small.size,type:small.type,name:c.name,highlight:!!c.highlight});
          save('clipit-upq',queue().filter(x=>x!==id));
        }catch(e){console.warn('upload',e);const full=/voll/.test(e.message);status(t.code,full?'Cloud voll – Clips bleiben auf dem Handy':'Upload pausiert – neuer Versuch gleich');if(full)save('clipit-upq',[]);break}
      }
      for(const [code,list] of Object.entries(byTrip)){await api('clips',{method:'POST',body:JSON.stringify({code,device:dev(),user:userName(),clips:list})}).catch(e=>console.warn(e));status(code,'')}
      if(Object.keys(byTrip).length){try{await refresh()}catch(e){}refreshCfg();T()?.renderHub()}
    }finally{busyUp=false}
  }
  function status(code,txt){const el=document.querySelector('.hub-cloud[data-cloud="'+code+'"] .hc-status');if(el)el.textContent=txt}

  function wrapAdd(){if(typeof add!=='function'||add.__clip)return;const orig=add;add=async function(...a){const c=await orig.apply(this,a);try{const t=c&&tripOf(c.trip);if(t&&!c.film&&!c.cloudUrl&&!c.cloudId&&auto(t.code))enqueue(c.id)}catch(e){}return c};add.__clip=1}

  // ---------- Crew-Feed + Reaktionen ----------
  const crew=code=>load('clipit-crew-'+code,[]);
  const reacts=code=>load('clipit-react-'+code,{});
  async function poll(){
    if(!cfg.cloud||!navigator.onLine||document.hidden)return;
    for(const t of cloudTrips()){
      try{const since=load('clipit-since',{})[t.code]||0;const r=await api('clips?code='+encodeURIComponent(t.code)+'&since='+since);
        const s=load('clipit-since',{});s[t.code]=Math.max(since,...r.clips.map(c=>c.at),0);save('clipit-since',s);
        const rx=await api('react?code='+encodeURIComponent(t.code)+'&device='+encodeURIComponent(dev())).catch(()=>null);if(rx)save('clipit-react-'+t.code,rx.reactions);
        if(r.clips.length){
          const gone=new Set(r.clips.filter(c=>c.deleted).map(c=>c.id));const fresh=r.clips.filter(c=>!c.deleted);
          const all=crew(t.code).filter(x=>!gone.has(x.id)&&!fresh.some(y=>y.id===x.id)).concat(fresh);save('clipit-crew-'+t.code,all);
          const theirs=fresh.filter(c=>c.by!==myHash);
          if(since&&theirs.length){const film=theirs.find(c=>c.film);const who=[...new Set(theirs.map(c=>c.user))];const hl=theirs.filter(c=>c.highlight).length;
            const body=film?'🎬 '+film.user+' hat den Film fertig – ansehen!':who.join(', ')+' '+(theirs.length===1?(hl?'hat ein ★ Highlight':'hat einen Clip'):'haben '+theirs.length+' Clips')+' hochgeladen';
            T()?.addNote(t.name,body,film?'🎬':'☁');if(document.hidden)T()?.systemNotify(t.name,body)}
        }
        await importOwn(t);
        reminder(t);
      }catch(e){console.warn('poll',e)}
    }
    T()?.renderHub();
  }
  // abendliche Erinnerung in der App (zusätzlich zum Cron-Push)
  function reminder(t){const now=new Date(),today=now.toLocaleDateString('sv-SE');if(today<t.start||today>(t.end||t.start)||now.getHours()<19||Date.now()-(t.created||0)<3*3600e3)return;
    const seen=load('clipit-reminded',{});if(seen[t.code]===today)return;
    const iso=now.toISOString().slice(0,10);let mine=0;try{mine=clips.filter(c=>c.trip===t.name&&!c.film&&!c.cloudId&&c.date.slice(0,10)===iso).length}catch(e){}
    const todays=crew(t.code).filter(c=>!c.film&&String(c.date).slice(0,10)===iso&&c.by!==myHash);
    const top=Object.entries(todays.reduce((a,c)=>(a[c.user]=(a[c.user]||0)+1,a),{})).sort((a,b)=>b[1]-a[1])[0];
    seen[t.code]=today;save('clipit-reminded',seen);
    if(!mine)T()?.addNote(t.name,top?'Heute noch kein Clip von dir 👀 '+top[0]+' hat schon '+top[1]+'.':'Heute noch kein Clip – filmt den Abend! 🎬','⏰');
    else T()?.addNote(t.name+' · Tag im Kasten','Du hast heute '+mine+' Clip'+(mine>1?'s':'')+', die Crew '+todays.length+'. ✨','✨')}

  async function setReact(code,clip,emoji){const cur=reacts(code)[clip]?.mine;const e=cur===emoji?'':emoji;
    const r=await api('react',{method:'POST',body:JSON.stringify({code,device:dev(),user:userName(),clip,emoji:e})});save('clipit-react-'+code,r.reactions);navigator.vibrate?.(8);return r.reactions}
  /** Clip des Tages: pro Tag der Clip mit den meisten Reaktionen (mind. 2) */
  function cotd(code){const rx=reacts(code),best={};crew(code).forEach(c=>{const n=rx[c.id]?.n||0;if(n<2||c.film)return;const d=String(c.date).slice(0,10);if(!best[d]||n>best[d].n)best[d]={id:c.id,n}});return new Set(Object.values(best).map(b=>b.id))}
  /** Score eines Clips (für Film & Rückblick): Reaktionen der Crew, Clip des Tages zählt extra */
  function score(c){for(const t of cloudTrips()){if(t.name!==c.trip)continue;const k=c.cloudId||c.id;const n=reacts(t.code)[k]?.n||0;return n+(cotd(t.code).has(k)?5:0)}return 0}

  function decorate(h){
    h.querySelectorAll('.hub-cloud').forEach(el=>{const code=el.dataset.cloud;const list=crew(code).filter(c=>!c.film);const others=list.filter(c=>c.by!==myHash).length;
      const films=crew(code).filter(c=>c.film).length,pending=queue().length,u=cfg.usage;
      el.innerHTML='<button class="hc-crew" data-crew="'+esc(code)+'"><span class="hc-ic">☁</span><span><b>'+list.length+' in der Cloud'+(films?' · 🎬 '+films:'')+'</b><small>'+others+' von der Crew · ansehen, reagieren, übernehmen</small></span><i>›</i></button>'+
        '<div class="hc-row"><label class="hc-toggle"><input type="checkbox" data-auto="'+esc(code)+'"'+(auto(code)?' checked':'')+'><span></span>Eigene Clips automatisch teilen</label><span class="hc-status">'+(pending?pending+' warten':'')+'</span></div>'+
        (u?'<div class="hc-meter" title="Gratis-Speicher der Crew-Cloud"><i style="width:'+Math.min(100,100*u.bytes/u.limit).toFixed(1)+'%"></i><span>'+mb(u.bytes)+' MB von '+mb(u.limit)+' MB</span></div>':'');
      el.querySelector('[data-crew]').onclick=()=>openCrew(code);
      el.querySelector('[data-auto]').onchange=e=>{const m=load('clipit-autoup',{});m[code]=e.target.checked;save('clipit-autoup',m);if(e.target.checked)uploadAll(code)};
    })}
  function uploadAll(code){const t=cloudTrips().find(x=>x.code===code);if(!t)return;try{clips.filter(c=>c.trip===t.name&&!c.film&&!c.cloudUrl&&!c.cloudId).forEach(c=>enqueue(c.id))}catch(e){}}

  function openCrew(code){const t=cloudTrips().find(x=>x.code===code);if(!t)return;let d=$q('#crewSheet');if(!d){d=document.createElement('dialog');d.id='crewSheet';d.className='sheet crew-sheet';document.body.appendChild(d)}
    const draw=()=>{const all=crew(code).slice().sort((a,b)=>a.date.localeCompare(b.date));const films=all.filter(c=>c.film),list=all.filter(c=>!c.film);
      const rx=reacts(code),best=cotd(code);let have=new Set();try{clips.forEach(c=>{if(c.cloudId)have.add(c.cloudId);if(c.cloudUrl)have.add(c.cloudUrl);have.add(c.id)})}catch(e){}
      const missing=list.filter(c=>!have.has(c.id)&&!have.has(c.url));
      const bar=c=>{const r=rx[c.id]||{by:{}};return '<div class="rx">'+EMO.map(e=>'<button data-rx="'+e+'" data-clip="'+esc(c.id)+'" class="'+(r.mine===e?'on':'')+'">'+e+(r.by[e]?'<b>'+r.by[e]+'</b>':'')+'</button>').join('')+'</div>'};
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>'+esc(t.name)+'</h2><button class="text-button" data-close>Fertig</button></div>'+
        '<p class="sheet-sub">'+list.length+' Clips von '+new Set(list.map(c=>c.user)).size+' Leuten. Reagiert – der Clip mit den meisten Reaktionen wird 👑 Clip des Tages und kommt groß in den Film.</p>'+
        (films.length?'<div class="crew-films">'+films.map(f=>'<figure class="film"><video src="'+esc(f.url)+'" preload="metadata" playsinline controls></video><figcaption><b>🎬 Film von '+esc(f.user)+'</b><small>'+new Date(f.date).toLocaleDateString('de-DE',{day:'numeric',month:'short'})+' · '+Math.round(f.duration||0)+' s</small><a class="text-button" href="'+esc(f.url)+'" download>↓</a></figcaption></figure>').join('')+'</div>':'')+
        (missing.length?'<button class="btn wide" id="crewAll">Alle '+missing.length+' übernehmen</button>':'')+
        '<div class="crew-grid">'+(list.length?list.map((c,i)=>'<figure style="--i:'+i+'" class="'+(c.highlight?'hl ':'')+(best.has(c.id)?'cotd':'')+'">'+(best.has(c.id)?'<span class="cotd-badge">👑 Clip des Tages</span>':'')+'<video src="'+esc(c.url)+'#t=0.4" preload="metadata" playsinline muted controls></video>'+bar(c)+'<figcaption><b>'+esc(c.user)+'</b><small>'+new Date(c.date).toLocaleString('de-DE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</small>'+
          ((have.has(c.id)||have.has(c.url))?'<span class="crew-ok">✓</span>':'<button class="text-button" data-take="'+esc(c.id)+'">＋</button>')+'</figcaption></figure>').join(''):'<div class="note-empty"><span>☁</span><b>Noch leer.</b><small>Sobald jemand filmt, tauchen die Clips hier auf.</small></div>')+'</div><p class="field-note" id="crewMsg"></p>';
      d.querySelector('[data-close]').onclick=()=>{d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)};
      d.querySelectorAll('[data-rx]').forEach(b=>b.onclick=async()=>{b.classList.add('pop');try{await setReact(code,b.dataset.clip,b.dataset.rx);draw()}catch(e){$q('#crewMsg').textContent=e.message}});
      d.querySelectorAll('[data-take]').forEach(b=>b.onclick=async()=>{b.textContent='…';await take(t,list.find(c=>c.id===b.dataset.take));draw()});
      const allB=d.querySelector('#crewAll');if(allB)allB.onclick=async()=>{allB.disabled=true;for(const [i,c] of missing.entries()){allB.textContent='Lade '+(i+1)+' / '+missing.length+' …';await take(t,c)}draw()};};
    draw();d.classList.remove('closing');d.showModal();poll().then(()=>{if(d.open)draw()})}
  async function take(t,c){try{const r=await fetch(c.url);if(!r.ok)throw Error('Download fehlgeschlagen');const blob=await r.blob();
      await add(blob,new Date(c.date),c.duration,c.name,{user:c.user,trip:t.name,highlight:!!c.highlight,cloudUrl:c.url,cloudId:c.id})}
    catch(e){const m=$q('#crewMsg');if(m)m.textContent=e.message}}

  /** Eigene Clips von anderen Geräten desselben Kontos (z. B. Safari über den Action Button) automatisch übernehmen */
  async function importOwn(t){if(!localStorage.getItem('clipit-auth')||!myHash)return;let have=new Set();try{clips.concat(trashed||[]).forEach(c=>{have.add(c.id);if(c.cloudId)have.add(c.cloudId)})}catch(e){return}
    const mine=crew(t.code).filter(c=>c.by===myHash&&!c.film&&!have.has(c.id));let n=0;
    for(const c of mine.slice(0,10)){try{const r=await fetch(c.url);if(!r.ok)continue;await add(await r.blob(),new Date(c.date),c.duration,c.name,{user:c.user,trip:t.name,highlight:!!c.highlight,cloudUrl:c.url,cloudId:c.id});n++}catch(e){}}
    if(n)T()?.addNote(t.name,n+' Clip'+(n>1?'s':'')+' von deinem anderen Gerät übernommen','↓')}
  /** Crew-Clips einer Reise, die noch nicht lokal liegen (für den Crew-Film) */
  function crewMissing(tripName){const t=tripOf(tripName);if(!t)return [];let have=new Set();try{clips.forEach(c=>{if(c.cloudId)have.add(c.cloudId);have.add(c.id)})}catch(e){}
    return crew(t.code).filter(c=>!c.film&&!have.has(c.id)&&c.by!==myHash)}
  async function fetchCrew(list,onp){const out=[];for(const [i,c] of list.entries()){onp?.(i,list.length);try{const r=await fetch(c.url);if(r.ok)out.push({id:c.id,cloudId:c.id,blob:await r.blob(),date:c.date,duration:c.duration,user:c.user,highlight:c.highlight,crew:true})}catch(e){}}return out}
  async function shareFilm(tripName,blob,duration,name){const t=tripOf(tripName);if(!t)throw Error('Keine Cloud-Reise');
    const id='film-'+Date.now().toString(36);const r=await putBlob(t,id,blob,'films');
    await api('clips',{method:'POST',body:JSON.stringify({code:t.code,device:dev(),user:userName(),clips:[{id,url:r.url,pathname:r.pathname,date:new Date().toISOString(),duration,size:blob.size,type:blob.type,name,film:true}]})});
    refreshCfg();return r.url}

  // ---------- Web-Push ----------
  async function pushSetup(){
    try{if(!cfg.push||!('PushManager' in window)||Notification.permission!=='granted')return;const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub){const k=cfg.push.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(k+'='.repeat((4-k.length%4)%4));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))})}
      const done=load('clipit-pushed',{});const key=sub.endpoint.slice(-24)+myHash.slice(0,6);
      for(const t of cloudTrips()){if(done[t.code]===key)continue;await api('push',{method:'POST',body:JSON.stringify({code:t.code,device:dev(),sub:sub.toJSON()})});done[t.code]=key;save('clipit-pushed',done)}
    }catch(e){console.warn('push',e)}}

  function fromNotification(){const q=new URLSearchParams(location.search);const code=q.get('trip');if(!code)return;history.replaceState(null,'',location.pathname);setTimeout(()=>{try{page('trips')}catch(e){}openCrew(code)},600)}
  async function refreshCfg(){try{const r=await api('config');cfg=r;save('clipit-cfg',r);window.clipitCloud.on=!!cfg.cloud;window.clipitCloud.cfg=cfg}catch(e){}}

  async function init(){
    await refreshCfg();
    wrapAdd();fromNotification();
    const wait=setInterval(()=>{if(typeof db!=='undefined'&&db){clearInterval(wait);flush();poll();pushSetup()}},400);
    setInterval(()=>{flush();poll();pushSetup()},60000);
    addEventListener('online',flush);document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();flush()}});
  }
  window.clipitCloud={on:!!cfg.cloud,cfg,isCloudCode,createTrip,fetchTrip,decorate,openCrew,flush,poll,uploadAll,score,cotd,crewMissing,fetchCrew,shareFilm,tripOf,device:dev,rehash,refreshCfg,crew};
  init();
})();
