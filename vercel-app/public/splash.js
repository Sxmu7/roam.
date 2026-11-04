/* ClipIT! Start-Intro: bei jedem Öffnen kurz Vollbild mit animiertem Logo + aktueller Info (Countdown, Crew, Clips). Tippen überspringt. */
(function(){
  const el=document.getElementById('splash');if(!el)return;
  if(document.documentElement.classList.contains('no-splash')){el.remove();return}
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first=!localStorage.getItem('clipit-onboarding-v1');
  let name='';try{name=load('clipit-prefs',{}).user||''}catch(e){}
  const trips=load('clipit-trips',[]),now=Date.now();
  const live=trips.find(t=>{const s=Date.parse(t.start+'T00:00:00'),e=t.end?Date.parse(t.end+'T23:59:59'):s+864e5;return now>=s&&now<=e});
  const next=trips.filter(t=>Date.parse(t.start+'T00:00:00')>now).sort((a,b)=>a.start.localeCompare(b.start))[0];
  const unread=load('clipit-notes',[]).filter(n=>!n.read).length;
  let info;
  if(first)info='<div class="sp-chips"><span><i>●</i>Alle filmen</span><span><i>★</i>Highlights</span><span><i>🎬</i>Ein Film</span></div>';
  else if(live){const day=1+Math.floor((now-Date.parse(live.start+'T00:00:00'))/864e5);info='<div class="sp-info"><span class="sp-live"><i></i>LIVE · TAG '+day+'</span><b>'+esc(live.name)+'</b><small>'+(unread?unread+' neue Mitteilung'+(unread>1?'en':'')+' · ':'')+'Heute schon gefilmt?</small></div>'}
  else if(next){const d=Math.ceil((Date.parse(next.start+'T00:00:00')-now)/864e5);info='<div class="sp-info"><span class="sp-cd">NOCH</span><b class="sp-big">'+d+'<em>'+(d===1?'Tag':'Tage')+'</em></b><small>bis '+esc(next.name)+'</small></div>'}
  else info='<div class="sp-info"><b>'+(name?'Hey '+esc(name)+'!':'Willkommen zurück')+'</b><small>Plane die nächste Reise und lade die Crew ein.</small></div>';
  el.querySelector('.sp-slot').innerHTML=info;
  // ins Top-Layer heben, damit das Intro (Dialog) erst nach dem Start-Intro sichtbar ist
  try{if(el.showPopover){el.setAttribute('popover','manual');el.showPopover()}}catch(e){}
  el.classList.add('go');
  let gone=false;const hide=()=>{if(gone)return;gone=true;el.classList.add('out');setTimeout(()=>{try{el.hidePopover?.()}catch(e){}el.remove()},650)};
  el.addEventListener('click',hide);
  setTimeout(hide,first?3400:2300);
})();
