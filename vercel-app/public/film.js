/* ClipIT! Film – schneidet aus allen Clips einer Reise eine echte Videodatei:
   Titelkarte, Tageskarten, Blenden, Namens-Chips, Highlights zuerst, Musik (eigener Beat oder eigene Datei), Abspann.
   Läuft komplett im Browser (Canvas + WebAudio + MediaRecorder), in Echtzeit. */
(function(){
  const $q=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const W=720,H=1280,Y='#FFC93C',R='#FF3B30',INK='#F5F5F0';
  const allClips=()=>{try{return clips.filter(c=>!c.film&&!c.deletedAt)}catch(e){return []}};
  const tripsList=()=>[...new Set(allClips().map(c=>c.trip))];
  const dayKey=d=>new Date(d).toLocaleDateString('sv-SE');
  const fmtDay=d=>new Date(d).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
  let cancel=false;

  // ---------- Auswahl der Szenen ----------
  function plan(trip,{mode,order},extra=[]){
    let list=allClips().filter(c=>c.trip===trip).concat(extra).sort((a,b)=>a.date.localeCompare(b.date));
    const sc=c=>{try{return window.clipitCloud?.score({...c,trip})||0}catch(e){return 0}};
    const short=mode==='short';
    let segs=list.map(c=>{const d=c.duration||4;const s0=sc(c),hl=!!(c.highlight||c.favorite||s0>=2);
      const len=short?Math.min(d,hl?6:3.2):d;const from=short&&!c.highlight&&d>len+1?Math.min(1,d-len):0;return {c,from,len,hl,top:s0>=5}});
    if(short){let total=segs.reduce((s,x)=>s+x.len,0);while(total>80&&segs.some(s=>!s.hl)){const rest=segs.filter(s=>!s.hl);const drop=rest[Math.floor(rest.length/2)];segs=segs.filter(s=>s!==drop);total-=drop.len}}
    if(order==='hl'){const hls=segs.filter(s=>s.c.highlight||s.top).sort((a,b)=>(b.top?1:0)-(a.top?1:0)).slice(0,6);const opener=hls.map(s=>({...s,len:Math.min(s.len,2.4),opener:true}));segs=opener.concat(segs)}
    return segs}

  // ---------- Musik: eigener House-Beat (122 BPM, Am–F–C–G) ----------
  function beat(actx,out,start,dur){
    const spb=60/122,noise=actx.createBuffer(1,actx.sampleRate*.3,actx.sampleRate);const nd=noise.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    const chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],hz=m=>440*Math.pow(2,(m-69)/12);
    const master=actx.createGain();master.gain.value=.9;master.connect(out);
    const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2400;lp.connect(master);
    for(let b=0;start+b*spb<start+dur;b++){const t=start+b*spb;
      const o=actx.createOscillator(),g=actx.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g).connect(master);o.start(t);o.stop(t+.35);
      const h=actx.createBufferSource(),hg=actx.createGain(),hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=7000;h.buffer=noise;hg.gain.setValueAtTime(.18,t+spb/2);hg.gain.exponentialRampToValueAtTime(.001,t+spb/2+.06);h.connect(hp).connect(hg).connect(master);h.start(t+spb/2);h.stop(t+spb/2+.08);
      if(b%2===1){const c=actx.createBufferSource(),cg=actx.createGain(),bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1500;c.buffer=noise;cg.gain.setValueAtTime(.32,t);cg.gain.exponentialRampToValueAtTime(.001,t+.18);c.connect(bp).connect(cg).connect(master);c.start(t);c.stop(t+.2)}
      if(b%4===0){const ch=chords[Math.floor(b/8)%4];ch.forEach(m=>{[0,1.5,2.5].forEach(off=>{const tt=t+off*spb;const s=actx.createOscillator(),sg=actx.createGain();s.type='sawtooth';s.frequency.value=hz(m);sg.gain.setValueAtTime(.0001,tt);sg.gain.exponentialRampToValueAtTime(.05,tt+.01);sg.gain.exponentialRampToValueAtTime(.0001,tt+.28);s.connect(sg).connect(lp);s.start(tt);s.stop(tt+.3)})});
        const bs=actx.createOscillator(),bg=actx.createGain();bs.type='triangle';bs.frequency.value=hz(ch[0]-24);bg.gain.setValueAtTime(.0001,t+spb*.5);bg.gain.exponentialRampToValueAtTime(.25,t+spb*.52);bg.gain.exponentialRampToValueAtTime(.0001,t+spb*3.8);bs.connect(bg).connect(master);bs.start(t+spb*.5);bs.stop(t+spb*4)}
    }
    master.gain.setValueAtTime(.9,start+Math.max(0,dur-2.5));master.gain.linearRampToValueAtTime(0,start+dur);
  }

  // ---------- Zeichnen ----------
  function cover(g,v,zoom){const vw=v.videoWidth||W,vh=v.videoHeight||H,s=Math.max(W/vw,H/vh)*zoom;const w=vw*s,h=vh*s;g.drawImage(v,(W-w)/2,(H-h)/2,w,h)}
  function wordmark(g,x,y,size,a=1){g.save();g.globalAlpha=a;g.font='800 '+size+'px Inter,system-ui,sans-serif';g.textBaseline='alphabetic';
    const w1=g.measureText('Clip').width,w2=g.measureText('IT').width;g.fillStyle=INK;g.fillText('Clip',x,y);g.fillStyle=Y;g.fillText('IT',x+w1,y);
    g.fillStyle=R;g.fillRect(x+w1+w2+size*.08,y-size*.68,size*.14,size*.5);g.beginPath();g.arc(x+w1+w2+size*.15,y-size*.06,size*.075,0,7);g.fill();g.restore();return w1+w2+size*.25}
  function centered(g,text,y,font,color,a=1,spacing=0){g.save();g.globalAlpha=a;g.font=font;g.fillStyle=color;g.textAlign='center';if(spacing&&'letterSpacing'in g)g.letterSpacing=spacing+'px';g.fillText(text,W/2,y);g.restore()}
  function titleCard(g,t,info){const k=ease(t/1.2);g.fillStyle='#0A0A0A';g.fillRect(0,0,W,H);
    const r=g.createRadialGradient(W/2,H*.42,10,W/2,H*.42,W*.9);r.addColorStop(0,'#FFC93C22');r.addColorStop(1,'#0A0A0A00');g.fillStyle=r;g.fillRect(0,0,W,H);
    g.save();g.translate(0,(1-k)*40);const ww=wordmark(g,-999,0,96);wordmark(g,(W-ww)/2,H*.43,96,k);g.restore();
    centered(g,info.name,H*.52,'800 58px Inter,system-ui',INK,ease((t-.5)/.8));
    centered(g,info.dates,H*.57,'600 26px Inter,system-ui','#a3a39d',ease((t-.8)/.8),2);
    g.fillStyle=Y;g.fillRect(W/2-ease((t-1)/1)*120,H*.61,ease((t-1)/1)*240,4)}
  function dayCard(g,t,label,n){const k=ease(t/.6);g.fillStyle='#0A0A0A';g.fillRect(0,0,W,H);
    centered(g,'TAG '+n,H*.46,'800 30px Inter,system-ui',Y,k,8);
    g.save();g.beginPath();g.rect(0,H*.47,W,90);g.clip();centered(g,label,H*.47+70-(1-k)*80,'800 54px Inter,system-ui',INK,1);g.restore()}
  function endCard(g,t,info){g.fillStyle='#0A0A0A';g.fillRect(0,0,W,H);const k=ease(t/1);
    const ww=wordmark(g,-999,0,110);wordmark(g,(W-ww)/2,H*.42,110,k);
    centered(g,'Every clip. One film.',H*.48,'600 30px Inter,system-ui','#cfcfc8',ease((t-.6)/.8));
    centered(g,'GEFILMT VON',H*.58,'700 20px Inter,system-ui','#8f8f8a',ease((t-1)/.8),5);
    centered(g,info.crew,H*.62,'800 34px Inter,system-ui',INK,ease((t-1.2)/.8));
    centered(g,'by SXMU',H*.92,'700 22px Inter,system-ui','#6f6f6a',ease((t-1.6)/.8),3)}
  function chip(g,seg,t){const a=ease(t/.4)*(1-ease((t-2.4)/.4));if(a<=0)return;g.save();g.globalAlpha=a;
    const txt=(seg.c.user||'')+' · '+new Date(seg.c.date).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});g.font='700 26px Inter,system-ui';const w=g.measureText(txt).width+44;
    const x=36,y=H-150+(1-ease(t/.4))*20;g.fillStyle='#0A0A0Acc';g.beginPath();g.roundRect(x,y,w,52,26);g.fill();g.fillStyle=R;g.beginPath();g.arc(x+22,y+26,6,0,7);g.fill();g.fillStyle=INK;g.fillText(txt,x+36,y+35);
    if(seg.top){g.fillStyle=Y;g.beginPath();g.roundRect(x,y-62,250,46,23);g.fill();g.fillStyle='#0A0A0A';g.font='800 20px Inter,system-ui';g.fillText('👑 CLIP DES TAGES',x+20,y-31)}else if(seg.c.highlight){g.fillStyle=Y;g.beginPath();g.roundRect(x,y-62,170,46,23);g.fill();g.fillStyle='#0A0A0A';g.font='800 20px Inter,system-ui';g.fillText('★ HIGHLIGHT',x+20,y-31)}g.restore()}
  function grain(g){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,0,W,90);const v=g.createLinearGradient(0,H*.7,0,H);v.addColorStop(0,'#0000');v.addColorStop(1,'#000a');g.fillStyle=v;g.fillRect(0,H*.7,W,H*.3)}

  // ---------- Rendern ----------
  async function render(trip,opt,onp,preview,extra=[]){
    cancel=false;const segs=plan(trip,opt,extra);if(!segs.length)throw Error('Keine Clips in dieser Reise.');
    const days=[...new Set(segs.filter(s=>!s.opener).map(s=>dayKey(s.c.date)))];
    const tl=[];tl.push({k:'title',len:3.2});let lastDay=null,dn=0;
    for(const s of segs){if(!s.opener){const d=dayKey(s.c.date);if(d!==lastDay&&days.length>1){dn=days.indexOf(d)+1;tl.push({k:'day',len:1.6,label:fmtDay(s.c.date),n:dn})}lastDay=d}tl.push({k:'clip',len:s.len,s})}
    tl.push({k:'end',len:4.2});
    const total=tl.reduce((a,x)=>a+x.len,0);
    const t0=allClips().filter(c=>c.trip===trip).concat(extra).map(c=>c.date).sort();
    const info={name:trip,dates:t0.length?new Date(t0[0]).toLocaleDateString('de-DE',{day:'numeric',month:'short'})+' – '+new Date(t0[t0.length-1]).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'}):'',crew:[...new Set(segs.map(s=>s.c.user).filter(Boolean))].slice(0,5).join(' · ')};
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
    const actx=new (window.AudioContext||window.webkitAudioContext)();await actx.resume();const dest=actx.createMediaStreamDestination();
    const musicBus=actx.createGain(),clipBus=actx.createGain();musicBus.gain.value=opt.music==='none'?0:(opt.mode==='short'?.7:.35);clipBus.gain.value=opt.music==='none'?1:(opt.mode==='short'?.45:.9);musicBus.connect(dest);clipBus.connect(dest);
    const start=actx.currentTime+.15;
    if(opt.music==='beat')beat(actx,musicBus,start,total);
    else if(opt.music==='file'&&opt.file){const buf=await actx.decodeAudioData(await opt.file.arrayBuffer());const src=actx.createBufferSource();src.buffer=buf;src.loop=true;const fg=actx.createGain();fg.gain.setValueAtTime(1,start+total-3);fg.gain.linearRampToValueAtTime(0,start+total);src.connect(fg).connect(musicBus);src.start(start)}
    const stream=cv.captureStream(30);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const type=['video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
    const rec=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:7e6}:{});const chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
    let lock=null;try{lock=await navigator.wakeLock?.request('screen')}catch(e){}
    const pg=preview?.getContext('2d');const show=()=>{if(pg)pg.drawImage(cv,0,0,preview.width,preview.height)};
    rec.start(500);let done=0;
    const frame=fn=>new Promise(res=>{const tick=()=>{if(cancel)return res('x');const r=fn();show();if(r)res();else requestAnimationFrame(tick)};tick()});
    for(const item of tl){if(cancel)break;
      const begin=performance.now();const el=()=>(performance.now()-begin)/1000;const prog=()=>onp?.((done+Math.min(el(),item.len))/total,item);
      if(item.k==='title')await frame(()=>{titleCard(g,el(),info);prog();return el()>=item.len});
      else if(item.k==='day')await frame(()=>{dayCard(g,el(),item.label,item.n);prog();return el()>=item.len});
      else if(item.k==='end')await frame(()=>{endCard(g,el(),info);prog();return el()>=item.len});
      else{const s=item.s;const url=URL.createObjectURL(s.c.blob);const v=document.createElement('video');v.src=url;v.playsInline=true;v.preload='auto';
        try{await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error('Clip nicht lesbar'));setTimeout(ok,4000)});
          if(!isFinite(v.duration)){v.currentTime=1e7;await new Promise(r=>{v.ondurationchange=r;setTimeout(r,1500)})}
          v.currentTime=s.from;await new Promise(r=>{v.onseeked=r;setTimeout(r,1500)});
          let node=null;try{node=actx.createMediaElementSource(v);const fg=actx.createGain();node.connect(fg).connect(clipBus);fg.gain.setValueAtTime(0,actx.currentTime);fg.gain.linearRampToValueAtTime(1,actx.currentTime+.25);fg.gain.setValueAtTime(1,actx.currentTime+Math.max(.3,s.len-.3));fg.gain.linearRampToValueAtTime(0,actx.currentTime+s.len)}catch(e){v.muted=true}
          try{await v.play()}catch(e){v.muted=true;await v.play().catch(()=>{})}
          const playBegin=performance.now();
          await frame(()=>{const t=(performance.now()-playBegin)/1000;const z=1.02+.05*(t/s.len);g.fillStyle='#000';g.fillRect(0,0,W,H);cover(g,v,z);grain(g);
            if(!s.opener)chip(g,s,t);else{g.fillStyle=Y;g.fillRect(0,0,W*(t/s.len),8)}
            const fade=Math.max(0,1-t/.22,(t-(s.len-.22))/.22);if(fade>0){g.fillStyle='rgba(0,0,0,'+Math.min(1,fade)+')';g.fillRect(0,0,W,H)}
            onp?.((done+Math.min(t,s.len))/total,item);return t>=s.len||v.ended});
          v.pause();try{node?.disconnect()}catch(e){}
        }catch(e){console.warn('film clip',e)}finally{URL.revokeObjectURL(url);v.removeAttribute('src')}}
      done+=item.len}
    await new Promise(r=>{rec.onstop=r;rec.stop()});try{lock?.release()}catch(e){}try{actx.close()}catch(e){}
    if(cancel)throw Error('Abgebrochen');
    return {blob:new Blob(chunks,{type:rec.mimeType||type||'video/webm'}),duration:total,count:segs.length}}

  // ---------- UI ----------
  function close(d){d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)}
  function open(trip){
    let d=$q('#filmSheet');if(!d){d=document.createElement('dialog');d.id='filmSheet';d.className='sheet film-sheet';document.body.appendChild(d)}
    const ts=tripsList();trip=trip&&ts.includes(trip)?trip:(()=>{try{return ts.includes(prefs.trip)?prefs.trip:ts[0]}catch(e){return ts[0]}})();
    const st={crew:localStorage.getItem('clipit-film-crew')!=='0',mode:localStorage.getItem('clipit-film-mode')||'short',order:localStorage.getItem('clipit-film-order')||'hl',music:localStorage.getItem('clipit-film-music')||'beat',file:null};
    const draw=()=>{const cm=trip?(window.clipitCloud?.crewMissing(trip)||[]):[];const n=trip?allClips().filter(c=>c.trip===trip).length:0;const segs=trip?plan(trip,st,st.crew?cm.map(c=>({...c,blob:null})):[]):[];const len=segs.reduce((a,s)=>a+s.len,0)+7.4;
      const opt=(k,v,t,sub)=>'<button type="button" data-k="'+k+'" data-v="'+v+'" class="'+(st[k]===v?'active':'')+'"><b>'+t+'</b><small>'+sub+'</small></button>';
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Film erstellen</h2><button class="text-button" data-close>Schließen</button></div>'+
        (!ts.length?'<div class="note-empty"><span>🎬</span><b>Noch keine Clips.</b><small>Filme ein paar Momente – dann schneidet ClipIT! daraus euren Film.</small></div>':
        '<div class="film-hero"><div class="film-reel"><i></i><i></i><i></i></div><div><select id="fmTrip">'+ts.map(t=>'<option'+(t===trip?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select><small>'+n+' Clips · ca. '+Math.round(len)+' s Film</small></div></div>'+
        (cm.length?'<label class="hc-toggle fm-crew"><input type="checkbox" id="fmCrew"'+(st.crew?' checked':'')+'><span></span>Crew-Film: '+cm.length+' Clips der Crew einbauen</label>':'')+'<label>Länge</label><div class="hl-modes two-col">'+opt('mode','short','Kurz & knackig','beste Momente, ≤ 90 s')+opt('mode','full','Alles','jeder Clip komplett')+'</div>'+
        '<label>Reihenfolge</label><div class="hl-modes two-col">'+opt('order','hl','Highlights zuerst','★-Montage als Opener')+opt('order','chrono','Chronologisch','wie es passiert ist')+'</div>'+
        '<label>Musik</label><div class="hl-modes">'+opt('music','beat','ClipIT! Beat','Sommer-House')+opt('music','file','Eigener Song','vom Handy')+opt('music','none','Nur O-Ton','ohne Musik')+'</div>'+
        (st.music==='file'?'<input type="file" id="fmFile" accept="audio/*" class="fm-file">'+(st.file?'<p class="field-note">♪ '+esc(st.file.name)+'</p>':''):'')+
        '<p class="hl-hint">Dauert so lange wie der Film. Bildschirm bleibt dabei an – App nicht verlassen.</p><button class="btn wide" id="fmGo">🎬 Film schneiden</button>');
      d.querySelector('[data-close]').onclick=()=>{cancel=true;close(d)};
      d.querySelector('#fmTrip')?.addEventListener('change',e=>{trip=e.target.value;draw()});
      d.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{st[b.dataset.k]=b.dataset.v;localStorage.setItem('clipit-film-'+b.dataset.k,b.dataset.v);draw()});
      d.querySelector('#fmCrew')?.addEventListener('change',e=>{st.crew=e.target.checked;localStorage.setItem('clipit-film-crew',st.crew?'1':'0');draw()});
      d.querySelector('#fmFile')?.addEventListener('change',e=>{st.file=e.target.files[0]||null;draw()});
      d.querySelector('#fmGo')?.addEventListener('click',()=>run(d,trip,st));
    };
    draw();d.classList.remove('closing');d.showModal()}

  async function run(d,trip,st){
    if(st.music==='file'&&!st.file){window.clipitTrips?.pop('Song fehlt','Wähle zuerst eine Audiodatei.');return}
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Wird geschnitten …</h2><button class="text-button" id="fmStop">Abbrechen</button></div>'+
      '<div class="film-live"><canvas id="fmPrev" width="270" height="480"></canvas><div class="film-rec"><i></i>REC</div></div>'+
      '<div class="hl-prog"><div><i id="fmBar"></i></div><span id="fmTxt">Titelkarte …</span></div>';
    d.querySelector('#fmStop').onclick=()=>{cancel=true};
    try{
      let extra=[];const cm=st.crew?(window.clipitCloud?.crewMissing(trip)||[]):[];
      if(cm.length){extra=await window.clipitCloud.fetchCrew(cm,(i,n)=>{d.querySelector('#fmTxt').textContent='Lade Crew-Clips '+(i+1)+' / '+n+' …';d.querySelector('#fmBar').style.width=(100*i/n*.15)+'%'})}
      const r=await render(trip,st,(p,item)=>{d.querySelector('#fmBar').style.width=(p*100)+'%';d.querySelector('#fmTxt').textContent=Math.round(p*100)+'% · '+(item.k==='clip'?(item.s.c.user||'Clip')+(item.s.c.highlight?' ★':''):item.k==='day'?'Tag '+item.n:item.k==='title'?'Titelkarte':'Abspann')},d.querySelector('#fmPrev'),extra);
      const name='ClipIT_Film_'+trip.replace(/[^\wäöüÄÖÜß-]+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.'+(r.blob.type.includes('mp4')?'mp4':'webm');
      let saved=null;try{saved=await add(r.blob,new Date(),r.duration,name,{trip,film:true,title:'🎬 Film · '+trip})}catch(e){}
      done(d,r,name,!!saved,trip);
    }catch(e){d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>'+(e.message==='Abgebrochen'?'Abgebrochen':'Hat nicht geklappt')+'</h2><button class="text-button" data-close>Schließen</button></div><p class="sheet-sub">'+esc(e.message)+'</p><button class="btn wide" id="fmAgain">Nochmal</button>';
      d.querySelector('[data-close]').onclick=()=>close(d);d.querySelector('#fmAgain').onclick=()=>open(trip)}}
  function done(d,r,name,saved,trip){const cloud=!!window.clipitCloud?.tripOf(trip);const url=URL.createObjectURL(r.blob);
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Euer Film ist fertig 🎬</h2><button class="text-button" data-close>Fertig</button></div>'+
      '<video class="film-out" src="'+url+'" controls playsinline autoplay></video><p class="sheet-sub">'+r.count+' Szenen · '+Math.round(r.duration)+' s'+(saved?' · in Dateien gespeichert':'')+'</p>'+
      '<div class="two"><button class="btn" id="fmShare">Teilen</button><button class="btn secondary" id="fmDl">Herunterladen</button></div>'+(cloud?'<button class="btn secondary wide" id="fmCloud">☁ An die Crew schicken</button>':'');
    window.clipitTrips?.confetti?.();
    d.querySelector('[data-close]').onclick=()=>{close(d);setTimeout(()=>URL.revokeObjectURL(url),400)};
    d.querySelector('#fmCloud')?.addEventListener('click',async e=>{const b=e.target;b.disabled=true;b.textContent='Lädt hoch …';try{await window.clipitCloud.shareFilm(trip,r.blob,r.duration,name);b.textContent='✓ Die Crew wurde benachrichtigt'}catch(err){b.disabled=false;b.textContent=err.message}});
    d.querySelector('#fmDl').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=name;a.click()};
    d.querySelector('#fmShare').onclick=async()=>{const f=new File([r.blob],name,{type:r.blob.type});try{if(navigator.canShare?.({files:[f]}))await navigator.share({files:[f],title:'ClipIT! Film'});else d.querySelector('#fmDl').click()}catch(e){}}}

  function entry(){const ps=$q('#playSelection');if(ps&&!$q('#makeFilm')){const b=document.createElement('button');b.id='makeFilm';b.className='make-film';b.innerHTML='🎬 Film erstellen <span>Echte Videodatei · Musik · Titel</span>';b.onclick=()=>open();ps.after(b)}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',entry):entry();
  window.clipitFilm={open,plan,render};
})();
