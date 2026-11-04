/* ClipIT! Rückblick – Story-Ansicht wie bei Instagram: pro Reisetag die besten Momente.
   Tippen rechts/links = weiter/zurück, gedrückt halten = Pause, nach unten wischen = schließen. */
(function(){
  const $q=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const all=()=>{try{return clips.filter(c=>!c.film&&!c.deletedAt)}catch(e){return []}};
  const dayKey=d=>new Date(d).toLocaleDateString('sv-SE');
  let st=null;

  function build(trip){
    const list=all().filter(c=>c.trip===trip).sort((a,b)=>a.date.localeCompare(b.date));
    const byDay=new Map();list.forEach(c=>{const k=dayKey(c.date);if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(c)});
    const days=[...byDay.entries()].map(([k,cs],i)=>{
      const score=c=>(c.highlight?10:0)+(c.favorite?6:0)+(c.highlights?.length||0)*2+Math.min(c.duration||0,20)/10+(window.clipitCloud?.score(c)||0)*3;
      let pick=cs.slice().sort((a,b)=>score(b)-score(a)).slice(0,5).sort((a,b)=>a.date.localeCompare(b.date));
      return {key:k,n:i+1,date:cs[0].date,count:cs.length,people:[...new Set(cs.map(c=>c.user))],items:pick}});
    return days}

  function open(trip){
    try{trip=trip||prefs.trip}catch(e){}
    const days=build(trip);if(!days.length){window.clipitTrips?.pop('Noch kein Rückblick','In dieser Reise gibt es noch keine Clips.');return}
    let el=$q('#story');if(!el){el=document.createElement('div');el.id='story';document.body.appendChild(el)}
    st={trip,days,d:0,i:-1,paused:false,muted:true,t0:0,dur:0,raf:0,urls:[]};
    el.innerHTML='<div class="st-bars"></div><div class="st-top"><span class="st-day"></span><button class="st-mute" aria-label="Ton">🔇</button><button class="st-x" aria-label="Schließen">✕</button></div>'+
      '<div class="st-media"></div><div class="st-cap"></div><div class="st-tap l"></div><div class="st-tap r"></div><div class="st-days"></div>';
    el.classList.add('open');document.body.classList.add('story-open');
    el.querySelector('.st-x').onclick=closeStory;
    el.querySelector('.st-mute').onclick=e=>{e.stopPropagation();st.muted=!st.muted;e.target.textContent=st.muted?'🔇':'🔊';const v=el.querySelector('video');if(v)v.muted=st.muted};
    el.querySelector('.st-days').innerHTML=days.map((d,i)=>'<button data-d="'+i+'">'+d.n+'</button>').join('');
    el.querySelectorAll('[data-d]').forEach(b=>b.onclick=e=>{e.stopPropagation();go(+b.dataset.d,-1)});
    // Gesten
    let down=0,sy=0,held=false;
    el.onpointerdown=e=>{down=Date.now();sy=e.clientY;held=false;setTimeout(()=>{if(down&&Date.now()-down>=240){held=true;pause(true)}},250)};
    el.onpointerup=e=>{const dy=e.clientY-sy;const was=held;down=0;el.style.transform='';if(was){pause(false);return}
      if(dy>90)return closeStory();if(e.target.closest('button'))return;e.clientX<innerWidth*.33?prev():next()};
    el.onpointermove=e=>{if(down&&e.clientY-sy>20)el.style.transform='translateY('+(e.clientY-sy)*.5+'px) scale('+(1-(e.clientY-sy)/2000)+')'};
    el.onpointercancel=()=>{down=0;el.style.transform=''};
    addEventListener('keydown',key);
    go(0,-1)}
  function key(e){if(!st)return;if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft')prev();if(e.key==='Escape')closeStory();if(e.key===' ')pause(!st.paused)}
  function closeStory(){const el=$q('#story');if(!el)return;cancelAnimationFrame(st?.raf);el.classList.remove('open');el.style.transform='';document.body.classList.remove('story-open');
    removeEventListener('keydown',key);setTimeout(()=>{el.querySelector('.st-media').innerHTML='';st?.urls.forEach(URL.revokeObjectURL);st=null},350)}
  function pause(p){if(!st)return;st.paused=p;const v=$q('#story video');if(v){p?v.pause():v.play().catch(()=>{})}$q('#story').classList.toggle('paused',p);if(!p)st.t0=performance.now()-st.el*1000}
  function next(){if(!st)return;const d=st.days[st.d];if(st.i<d.items.length-1)go(st.d,st.i+1);else if(st.d<st.days.length-1)go(st.d+1,-1);else finale()}
  function prev(){if(!st)return;if(st.i>-1)go(st.d,st.i-1);else if(st.d>0)go(st.d-1,st.days[st.d-1].items.length-1)}

  function go(d,i){
    const el=$q('#story');if(!el||!st)return;cancelAnimationFrame(st.raf);st.d=d;st.i=i;st.el=0;st.paused=false;el.classList.remove('paused','finale');
    const day=st.days[d];
    el.querySelector('.st-day').innerHTML='<b>Tag '+day.n+'</b> · '+new Date(day.date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'short'});
    el.querySelectorAll('[data-d]').forEach((b,k)=>b.classList.toggle('active',k===d));
    const segs=day.items.length+1;el.querySelector('.st-bars').innerHTML=Array.from({length:segs},(_,k)=>'<span><i style="width:'+(k<i+1?100:0)+'%"></i></span>').join('');
    const media=el.querySelector('.st-media'),cap=el.querySelector('.st-cap');
    if(i===-1){ // Tageskarte
      media.innerHTML='<div class="st-card"><span>TAG '+day.n+'</span><h2>'+new Date(day.date).toLocaleDateString('de-DE',{weekday:'long'})+'</h2><p>'+new Date(day.date).toLocaleDateString('de-DE',{day:'numeric',month:'long'})+'</p><div class="st-meta"><b>'+day.count+'</b> Clips · '+esc(day.people.join(', '))+'</div></div>';
      cap.innerHTML='';run(2.4);return}
    const c=day.items[i];const url=URL.createObjectURL(c.blob);st.urls.push(url);
    media.innerHTML='<video playsinline autoplay '+(st.muted?'muted':'')+' src="'+url+'"></video>';
    cap.innerHTML='<span class="st-user"><i>'+esc((c.user||'?')[0])+'</i><b>'+esc(c.user||'')+'</b><small>'+new Date(c.date).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'</small></span>'+(c.highlight?'<span class="st-hl">★ Highlight</span>':'')+(c.title?'<p>'+esc(c.title)+'</p>':'');
    const v=media.querySelector('video');v.onloadedmetadata=()=>{const d0=isFinite(v.duration)?v.duration:(c.duration||6);const from=d0>8&&!c.highlight?Math.min(d0-6,d0*.25):0;if(from)v.currentTime=from;run(Math.min(6.5,Math.max(1.5,d0-from)))};
    v.play().catch(()=>{v.muted=true;st.muted=true;el.querySelector('.st-mute').textContent='🔇';v.play().catch(()=>{})})}
  function run(dur){st.dur=dur;st.t0=performance.now();const bar=$q('#story .st-bars span:nth-child('+(st.i+2)+') i');
    const tick=()=>{if(!st)return;if(!st.paused){st.el=(performance.now()-st.t0)/1000;if(bar)bar.style.width=Math.min(100,100*st.el/dur)+'%';if(st.el>=dur)return next()}st.raf=requestAnimationFrame(tick)};tick()}
  function finale(){const el=$q('#story');cancelAnimationFrame(st.raf);el.classList.add('finale');const n=st.days.reduce((a,d)=>a+d.count,0);
    el.querySelector('.st-cap').innerHTML='';el.querySelector('.st-media').innerHTML='<div class="st-card end"><span>DAS WAR</span><h2>'+esc(st.trip)+'</h2><p>'+st.days.length+' Tage · '+n+' Clips</p><button class="btn" id="stFilm">🎬 Daraus einen Film machen</button><button class="text-button" id="stAgain">↺ Nochmal ansehen</button></div>';
    el.querySelector('#stFilm').onclick=e=>{e.stopPropagation();const t=st.trip;closeStory();setTimeout(()=>window.clipitFilm?.open(t),360)};
    el.querySelector('#stAgain').onclick=e=>{e.stopPropagation();go(0,-1)}}
  window.clipitStory={open,build};
})();
