/* ClipIT! Highlights – mark moments while filming (tap ★, double-tap the
   picture, or automatically on loud moments), then choose on save:
   whole clip, only the highlights (1–10 s each), or both.
   Hooks: app.js calls window.clipitHL.finish(blob, duration) in onstop. */
(function(){
  const $q=s=>document.querySelector(s);
  const AUTO_KEY='clipit-autohl', LEN_KEY='clipit-hllen', MODE_KEY='clipit-hlmode';
  let marks=[], t0=0, rec=false, audio=null, raf=0;
  const autoOn=()=>localStorage.getItem(AUTO_KEY)!=='0';
  const now=()=>(performance.now()-t0)/1000;
  const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

  // ---------- camera UI ----------
  function ui(){
    const cam=$q('#cameraPage .camera');if(!cam||$q('#hlBtn'))return;
    const b=document.createElement('button');b.id='hlBtn';b.type='button';b.className='hl-btn';b.setAttribute('aria-label','Highlight markieren');
    b.innerHTML='<span class="hl-star">★</span><span class="hl-n" id="hlCount"></span>';
    b.onclick=e=>{e.stopPropagation();mark(false)};cam.appendChild(b);
    const a=document.createElement('button');a.id='hlAuto';a.type='button';a.className='hl-auto';
    const paint=()=>{a.classList.toggle('on',autoOn());a.innerHTML='<i></i>Auto-Highlights '+(autoOn()?'an':'aus')};paint();
    a.onclick=e=>{e.stopPropagation();localStorage.setItem(AUTO_KEY,autoOn()?'0':'1');paint();if(rec){autoOn()?startAuto():stopAuto()}};
    const head=$q('#cameraPage .camfoot');head?.insertBefore(a,head.firstChild);
    const f=document.createElement('div');f.id='hlFlash';f.className='hl-flash';cam.appendChild(f);
    const tl=document.createElement('div');tl.id='hlTicks';tl.className='hl-ticks';cam.appendChild(tl);
    let last=0;$q('#live')?.addEventListener('pointerup',()=>{const t=Date.now();if(t-last<320&&rec){mark(false);last=0}else last=t});
  }
  function mark(auto){
    if(!rec)return;const t=now();
    if(marks.some(m=>Math.abs(m.t-t)<(auto?4:1.2)))return;
    marks.push({t,auto});
    navigator.vibrate?.(auto?15:[20,40,20]);
    const f=$q('#hlFlash');if(f){f.textContent=auto?'★ Auto-Highlight':'★ Highlight';f.classList.remove('go');void f.offsetWidth;f.classList.add('go')}
    const b=$q('#hlBtn');if(b){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')}
    $q('#hlCount').textContent=marks.length;
    const tk=document.createElement('i');tk.textContent='★';tk.className=auto?'auto':'';$q('#hlTicks')?.appendChild(tk);
  }

  // ---------- automatic: loud moments (cheering, laughing, splash) ----------
  function startAuto(){
    try{
      if(audio||typeof stream==='undefined'||!stream?.getAudioTracks().length)return;
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const src=ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);
      const buf=new Float32Array(an.fftSize);let avg=0,n=0,hot=0;
      audio={ctx,an};
      const loop=()=>{an.getFloatTimeDomainData(buf);let s=0;for(const v of buf)s+=v*v;const rms=Math.sqrt(s/buf.length);
        n++;avg=n<40?(avg*(n-1)+rms)/n:avg*0.985+rms*0.015;
        if(n>45&&rms>0.06&&rms>avg*3.2){hot++;if(hot>6){mark(true);hot=-40}}else if(hot>0)hot=0;else if(hot<0)hot++;
        raf=requestAnimationFrame(loop)};loop();
    }catch(e){audio=null}
  }
  function stopAuto(){cancelAnimationFrame(raf);try{audio?.ctx.close()}catch(e){}audio=null}

  function begin(){rec=true;marks=[];t0=performance.now();$q('#hlCount').textContent='';const tk=$q('#hlTicks');if(tk)tk.innerHTML='';document.body.classList.add('hl-rec');if(autoOn())startAuto()}
  function end(){rec=false;stopAuto();document.body.classList.remove('hl-rec')}

  // ---------- trimming (plays the clip into a canvas recorder) ----------
  async function cut(blob,from,dur,onp){
    const url=URL.createObjectURL(blob);const v=document.createElement('video');v.src=url;v.playsInline=true;v.preload='auto';
    v.style.cssText='position:fixed;left:-9999px;width:2px;height:2px';document.body.appendChild(v);
    try{
      await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error('Video nicht lesbar'))});
      if(!isFinite(v.duration)){v.currentTime=1e7;await new Promise(r=>v.ondurationchange=r);}
      v.currentTime=from;await new Promise(r=>{v.onseeked=r;setTimeout(r,1500)});
      const c=document.createElement('canvas');c.width=v.videoWidth||1280;c.height=v.videoHeight||720;const g=c.getContext('2d');
      const out=c.captureStream(30);let actx=null;
      try{actx=new (window.AudioContext||window.webkitAudioContext)();const s=actx.createMediaElementSource(v),d=actx.createMediaStreamDestination();s.connect(d);d.stream.getAudioTracks().forEach(t=>out.addTrack(t))}catch(e){v.muted=true}
      const type=['video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const r=new MediaRecorder(out,type?{mimeType:type,videoBitsPerSecond:8e6}:{}),ch=[];r.ondataavailable=e=>e.data.size&&ch.push(e.data);
      let on=true;const draw=()=>{if(!on)return;g.drawImage(v,0,0,c.width,c.height);onp?.(Math.min(1,(v.currentTime-from)/dur));v.requestVideoFrameCallback?v.requestVideoFrameCallback(draw):requestAnimationFrame(draw)};
      try{await v.play()}catch(e){v.muted=true;await v.play()}
      draw();r.start(250);
      await new Promise(res=>{const chk=()=>{if(v.currentTime>=from+dur||v.ended)res();else setTimeout(chk,40)};chk()});
      on=false;v.pause();await new Promise(res=>{r.onstop=res;r.stop()});
      try{actx?.close()}catch(e){}
      return new Blob(ch,{type:r.mimeType||type||'video/webm'});
    }finally{v.remove();URL.revokeObjectURL(url)}
  }

  // ---------- save sheet ----------
  function sheet(total){
    return new Promise(done=>{
      let d=$q('#hlSheet');if(!d){d=document.createElement('dialog');d.id='hlSheet';d.className='sheet hl-sheet';document.body.appendChild(d)}
      let mode=localStorage.getItem(MODE_KEY)||'both',len=+(localStorage.getItem(LEN_KEY)||5);
      const n=marks.length;
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>'+n+' Highlight'+(n>1?'s':'')+' ★</h2><span class="hl-total">'+fmt(total)+'</span></div>'+
        '<p class="sheet-sub">Was soll gespeichert werden?</p>'+
        '<div class="hl-track"><div class="hl-bar"></div>'+marks.map(m=>'<span class="hl-pin'+(m.auto?' auto':'')+'" style="left:'+(100*m.t/total).toFixed(2)+'%"><b></b></span>').join('')+'</div>'+
        '<div class="hl-modes" role="radiogroup">'+
          [['full','Ganzer Clip',fmt(total)],['hl','Nur Highlights',''],['both','Beides','empfohlen']].map(([k,t,s])=>'<button type="button" data-m="'+k+'" role="radio"><b>'+t+'</b><small>'+s+'</small></button>').join('')+'</div>'+
        '<div class="hl-len"><div class="hl-len-head"><span>Länge pro Highlight</span><b id="hlLenV"></b></div>'+
          '<input type="range" id="hlLen" min="1" max="10" step="1" value="'+len+'"><div class="hl-scale"><span>1 s</span><span>5 s</span><span>10 s</span></div>'+
          '<p class="hl-hint">Die Sekunden vor deinem Tippen zählen mit – der Moment ist meist schon passiert.</p></div>'+
        '<div class="hl-prog hidden" id="hlProg"><div><i id="hlProgBar"></i></div><span id="hlProgT">Schneide Highlight 1 …</span></div>'+
        '<button class="btn wide" id="hlSave">Speichern</button>';
      const sync=()=>{d.querySelectorAll('[data-m]').forEach(b=>{const on=b.dataset.m===mode;b.classList.toggle('active',on);b.setAttribute('aria-checked',on)});
        d.querySelector('.hl-len').classList.toggle('off',mode==='full');
        d.querySelector('#hlLenV').textContent=len+' s';
        d.querySelector('[data-m="hl"] small').textContent=n+' × '+len+' s';
        d.querySelectorAll('.hl-pin b').forEach(p=>p.style.width=Math.max(6,100*len/total*4)+'px');
        d.querySelector('#hlSave').textContent=mode==='full'?'Ganzen Clip speichern':mode==='hl'?n+' Highlight'+(n>1?'s':'')+' speichern':'Clip + '+n+' Highlight'+(n>1?'s':'')+' speichern'};
      d.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;sync()});
      d.querySelector('#hlLen').oninput=e=>{len=+e.target.value;navigator.vibrate?.(5);sync()};
      sync();
      d.oncancel=e=>{e.preventDefault()};
      d.querySelector('#hlSave').onclick=()=>{localStorage.setItem(MODE_KEY,mode);localStorage.setItem(LEN_KEY,len);done({mode,len,d})};
      d.classList.remove('closing');d.showModal();
    });
  }
  function close(d){d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)}

  async function finish(blob,total){
    const m=marks.slice();end();
    if(!m.length||!blob?.size)return null;
    const meta=m.map(x=>+x.t.toFixed(2));
    try{
      const {mode,len,d}=await sheet(total);
      if(mode==='full'){close(d);return {parts:[],keepFull:true,marks:meta}}
      const btn=d.querySelector('#hlSave');btn.disabled=true;btn.textContent='Wird geschnitten …';
      d.querySelector('#hlProg').classList.remove('hidden');
      const parts=[];
      for(let i=0;i<m.length;i++){
        const L=Math.min(len,total);const from=Math.max(0,Math.min(total-L,m[i].t-L*0.7));
        d.querySelector('#hlProgT').textContent='Schneide Highlight '+(i+1)+' von '+m.length+' …';
        try{const b=await cut(blob,from,L,p=>{d.querySelector('#hlProgBar').style.width=(100*(i+p)/m.length)+'%'});if(b.size)parts.push({blob:b,from,dur:L,at:meta[i],auto:m[i].auto})}catch(e){console.warn('highlight cut failed',e)}
      }
      close(d);
      if(!parts.length)return {parts:[],keepFull:true,marks:meta};
      return {parts,keepFull:mode==='both',marks:meta};
    }catch(e){console.warn(e);try{close($q('#hlSheet'))}catch(_){}return {parts:[],keepFull:true,marks:meta}}
  }

  // ---------- archive: highlight filter ----------
  window.__hlOnly=false;
  function filterUi(){
    const fav=$q('#favoritesOnly');if(!fav||$q('#hlOnly'))return;
    const b=document.createElement('button');b.id='hlOnly';b.type='button';b.className=fav.className.replace('active','');b.textContent='★ Highlights';
    fav.after(b);
    b.onclick=()=>{window.__hlOnly=true;fav.classList.remove('active');$q('#allClips')?.classList.remove('active');b.classList.add('active');try{selected.clear();render()}catch(e){}; $q('#favoritesOnly').classList.remove('active');$q('#allClips').classList.remove('active')};
    const off=()=>{window.__hlOnly=false;b.classList.remove('active')};
    $q('#allClips')?.addEventListener('click',off,true);fav.addEventListener('click',off,true);
  }

  function watch(){
    const r=$q('#record');if(!r)return;
    new MutationObserver(()=>{const on=r.classList.contains('recording');if(on&&!rec)begin()}).observe(r,{attributes:true,attributeFilter:['class']});
  }
  function init(){ui();filterUi();watch()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.clipitHL={finish,mark:()=>mark(false),cut,get marks(){return marks.slice()}};
})();
