/* ClipIT! Karte – Reiseroute aus den Aufnahmestandorten: Pins, gelbe Route, Clip-Vorschau, "Route abspielen". */
(function(){
  const $q=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const loc=c=>{const l=c.location;const la=+l?.latitude,lo=+l?.longitude;return isFinite(la)&&isFinite(lo)&&(la||lo)?[la,lo]:null};
  let map=null,urls=[],tour=null;

  function leaflet(){return new Promise((ok,no)=>{if(window.L)return ok();
    const css=document.createElement('link');css.rel='stylesheet';css.href='vendor/leaflet.css';document.head.appendChild(css);
    const s=document.createElement('script');s.src='vendor/leaflet.js';s.onload=ok;s.onerror=()=>no(Error('Karte konnte nicht geladen werden (offline?)'));document.head.appendChild(s)})}

  async function open(trip){
    try{trip=trip||prefs.trip}catch(e){}
    let list=[];try{list=clips.filter(c=>c.trip===trip&&!c.film&&!c.deletedAt)}catch(e){}
    const pts=list.filter(loc).sort((a,b)=>a.date.localeCompare(b.date));
    let el=$q('#mapView');if(!el){el=document.createElement('div');el.id='mapView';document.body.appendChild(el)}
    el.innerHTML='<div class="mv-top"><div><span class="overline">ROUTE</span><h2>'+esc(trip)+'</h2><small>'+pts.length+' von '+list.length+' Clips mit Standort</small></div><button class="mv-x" aria-label="Schließen">✕</button></div>'+
      '<div id="mvMap"></div><div class="mv-card hidden"></div>'+(pts.length>1?'<button class="btn mv-play" id="mvPlay">▶ Route abspielen</button>':'');
    el.classList.add('open');document.body.classList.add('story-open');
    el.querySelector('.mv-x').onclick=close;
    if(!pts.length){el.querySelector('#mvMap').innerHTML='<div class="mv-empty"><span>⌖</span><b>Noch keine Standorte.</b><small>Aktiviere in den Einstellungen „Standort automatisch am Clip speichern“ – ab dann entsteht hier eure Route.</small></div>';return}
    try{await leaflet()}catch(e){el.querySelector('#mvMap').innerHTML='<div class="mv-empty"><span>⌖</span><b>'+esc(e.message)+'</b></div>';return}
    map=L.map('mvMap',{zoomControl:false,attributionControl:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'© OpenStreetMap · © CARTO'}).addTo(map);
    const ll=pts.map(loc);
    const line=L.polyline(ll,{color:'#FFC93C',weight:4,opacity:.9,lineCap:'round'}).addTo(map);
    L.polyline(ll,{color:'#FFC93C',weight:14,opacity:.12}).addTo(map);
    const markers=pts.map((c,i)=>{const m=L.marker(loc(c),{icon:L.divIcon({className:'',html:'<span class="mv-pin'+(c.highlight?' hl':'')+'" style="--i:'+i+'">'+(c.highlight?'★':i+1)+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);m.on('click',()=>show(c,i,pts.length));return m});
    map.fitBounds(line.getBounds(),{paddingTopLeft:[40,150],paddingBottomRight:[40,230],maxZoom:14});
    setTimeout(()=>{const p=line._path;if(p&&p.getTotalLength){const L0=p.getTotalLength();p.style.strokeDasharray=L0;p.style.strokeDashoffset=L0;p.getBoundingClientRect();p.style.transition='stroke-dashoffset 2.4s cubic-bezier(.4,0,.2,1)';p.style.strokeDashoffset=0}},450);
    setTimeout(()=>map.invalidateSize(),350);
    el.querySelector('#mvPlay')?.addEventListener('click',()=>play(pts));
  }
  function show(c,i,n){const card=$q('#mapView .mv-card');urls.forEach(URL.revokeObjectURL);urls=[];const u=URL.createObjectURL(c.blob);urls.push(u);
    card.innerHTML='<video src="'+u+'" autoplay muted playsinline loop></video><div><b>'+(c.highlight?'★ ':'')+esc(c.title||c.user||'Clip')+'</b><small>'+esc(c.user||'')+' · '+new Date(c.date).toLocaleString('de-DE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</small><span class="mv-n">'+(i+1)+' / '+n+'</span></div>';
    card.classList.remove('hidden');card.classList.remove('in');void card.offsetWidth;card.classList.add('in');
    document.querySelectorAll('.mv-pin').forEach((p,k)=>p.classList.toggle('active',k===i))}
  async function play(pts){if(tour){tour.stop=true;tour=null;$q('#mvPlay').textContent='▶ Route abspielen';return}
    tour={stop:false};const me=tour;$q('#mvPlay').textContent='■ Stopp';
    for(let i=0;i<pts.length&&!me.stop;i++){map.flyTo(loc(pts[i]),Math.max(map.getZoom(),13),{duration:1.4});show(pts[i],i,pts.length);await new Promise(r=>setTimeout(r,2600))}
    if(!me.stop){map.fitBounds(L.latLngBounds(pts.map(loc)),{paddingTopLeft:[40,150],paddingBottomRight:[40,230],maxZoom:14});$q('#mvPlay').textContent='▶ Route abspielen'}tour=null}
  function close(){if(tour)tour.stop=true;const el=$q('#mapView');el.classList.remove('open');document.body.classList.remove('story-open');
    setTimeout(()=>{try{map?.remove()}catch(e){}map=null;el.innerHTML='';urls.forEach(URL.revokeObjectURL);urls=[]},350)}
  window.clipitMap={open};
})();
