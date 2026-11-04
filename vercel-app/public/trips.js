/* ClipIT! Trips: kommende Reise mit Countdown, Einladungslink, Join-Code und Mitteilungen.
   Läuft komplett im Browser. Der Code enthält Reisename + Startdatum (z. B. THAILAND-261214),
   damit Freunde auch ohne Server beitreten können. */
(function(){
  const KEY='clipit-trips',NKEY='clipit-notes',SEEN='clipit-milestones';
  const $q=s=>document.querySelector(s);
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const trips=()=>load(KEY,[]);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const BASE=location.origin+location.pathname.replace(/index\.html$/,'');

  // ---- code & link ----
  function slug(name){return name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’'`]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,10)||'TRIP'}
  function makeCode(name,start){const d=start.replace(/-/g,'').slice(2);return slug(name)+'-'+d}
  function parseCode(code){const m=String(code).trim().toUpperCase().replace(/\s+/g,'').match(/^([A-Z0-9]{1,10})-?(\d{6})$/);if(!m)return null;
    const d=m[2];const start='20'+d.slice(0,2)+'-'+d.slice(2,4)+'-'+d.slice(4,6);if(isNaN(Date.parse(start)))return null;
    const name=m[1].charAt(0)+m[1].slice(1).toLowerCase();return {name,start,code:m[1]+'-'+d}}
  function linkFor(t){const p=new URLSearchParams({join:t.code,n:t.name});if(t.end)p.set('e',t.end);return BASE+'?'+p.toString()}

  // ---- notifications ----
  function notes(){return load(NKEY,[])}
  function addNote(title,body,icon='●'){const n=notes();n.unshift({id:Date.now()+Math.random(),title,body,icon,at:Date.now(),read:false});save(NKEY,n.slice(0,40));renderBell();pop(title,body)}
  function pop(title,body){let b=$q('#clipPop');if(!b){b=document.createElement('div');b.id='clipPop';document.body.appendChild(b)}
    b.innerHTML='<span class="cp-dot"></span><span><b>'+esc(title)+'</b><small>'+esc(body)+'</small></span>';b.classList.remove('show');void b.offsetWidth;b.classList.add('show');clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('show'),3800)}
  async function systemNotify(title,body){try{if(Notification.permission!=='granted')return;const reg=await navigator.serviceWorker?.getRegistration();if(reg?.showNotification)reg.showNotification(title,{body,icon:'icon-192.png',badge:'icon-192.png',tag:title});else new Notification(title,{body,icon:'icon-192.png'})}catch(e){}}
  function renderBell(){const n=notes().filter(x=>!x.read).length;const b=$q('#bellBtn');if(b)b.dataset.count=n?String(n):''}
  function openNotes(){let d=$q('#notesSheet');if(!d){d=document.createElement('dialog');d.id='notesSheet';d.className='sheet';document.body.appendChild(d)}
    const list=notes();d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Mitteilungen</h2><button class="text-button" data-close>Fertig</button></div>'+
      (list.length?'<div class="note-list">'+list.map(x=>'<div class="note'+(x.read?'':' unread')+'"><span class="note-ic">'+esc(x.icon)+'</span><span><b>'+esc(x.title)+'</b><small>'+esc(x.body)+'</small></span><time>'+ago(x.at)+'</time></div>').join('')+'</div>'
       :'<div class="note-empty"><span>●</span><b>Alles ruhig.</b><small>Hier siehst du Countdown-Erinnerungen und wer deiner Reise beitritt.</small></div>')+
      (('Notification' in window)&&Notification.permission!=='granted'?'<button class="btn wide" id="notifAllow">Mitteilungen aufs Handy erlauben</button>':'');
    d.querySelector('[data-close]').onclick=()=>closeSheet(d);
    const a=d.querySelector('#notifAllow');if(a)a.onclick=async()=>{try{const r=await Notification.requestPermission();if(r==='granted'){a.remove();systemNotify('ClipIT!','Mitteilungen sind an.')}else pop('Nicht erlaubt','Du kannst es in den Einstellungen ändern.')}catch(e){pop('Nicht verfügbar','iPhone: ClipIT! zuerst zum Home-Bildschirm hinzufügen.')}};
    save(NKEY,list.map(x=>({...x,read:true})));renderBell();openSheet(d)}
  function ago(t){const m=Math.round((Date.now()-t)/60000);if(m<1)return'jetzt';if(m<60)return m+' min';const h=Math.round(m/60);if(h<24)return h+' h';return Math.round(h/24)+' d'}

  // ---- sheets ----
  function openSheet(d){d.classList.remove('closing');d.showModal();d.onclick=e=>{if(e.target===d)closeSheet(d)}}
  function closeSheet(d){d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)}

  // ---- countdown card ----
  function nextTrip(){const now=Date.now();return trips().filter(t=>Date.parse(t.start+'T00:00:00')+86400000*(t.end?1+(Date.parse(t.end)-Date.parse(t.start))/86400000:1)>now).sort((a,b)=>a.start.localeCompare(b.start))[0]}
  function parts(ms){ms=Math.max(0,ms);const d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60,s=Math.floor(ms/1e3)%60;return {d,h,m,s}}
  let renderCard=function(){const home=$q('#homePage');if(!home)return;let c=$q('#tripCountdown');
    if(!c){c=document.createElement('article');c.id='tripCountdown';c.className='countdown-card';const anchor=home.querySelector('.overview-layout');home.insertBefore(c,anchor)}
    const t=nextTrip();
    if(!t){c.className='countdown-card empty-cd';c.innerHTML='<div><span class="overline">NÄCHSTE REISE</span><h2>Wohin geht’s als Nächstes?</h2><p>Plane die Reise, lade die Crew per Link oder Code ein und sieh den Countdown laufen.</p></div><div class="cd-actions"><button class="btn" id="cdNew">＋ Reise planen</button><button class="btn secondary" id="cdJoin">Code eingeben</button></div>';
      $q('#cdNew').onclick=openCreate;$q('#cdJoin').onclick=openJoin;return}
    const start=Date.parse(t.start+'T00:00:00');const live=Date.now()>=start;
    c.className='countdown-card'+(live?' live':'');
    c.innerHTML='<div class="cd-top"><span class="overline">'+(live?'GERADE UNTERWEGS':'NÄCHSTE REISE')+'</span><button class="code-chip" id="cdCode" title="Code kopieren">'+esc(t.code)+'</button></div>'+
      '<h2>'+esc(t.name)+'</h2><p>'+new Date(start).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long',year:'numeric'})+(t.end?' – '+new Date(Date.parse(t.end+'T00:00:00')).toLocaleDateString('de-DE',{day:'numeric',month:'long'}):'')+'</p>'+
      (live?'<div class="cd-live"><i></i>Los geht’s – alle Clips landen jetzt in dieser Reise.</div>':'<div class="cd-digits">'+['d','h','m','s'].map(k=>'<div class="cd-cell"><b data-k="'+k+'">00</b><small>'+{d:'Tage',h:'Std',m:'Min',s:'Sek'}[k]+'</small></div>').join('')+'</div>')+
      '<div class="cd-actions"><button class="btn" id="cdInvite">Crew einladen</button><button class="btn secondary" id="cdUse">Aktivieren</button><button class="icon-button" id="cdMore" aria-label="Weitere Reisen">⋯</button></div>';
    $q('#cdInvite').onclick=()=>openShare(t);$q('#cdCode').onclick=()=>copy(t.code,'Code kopiert');$q('#cdUse').onclick=()=>useTrip(t);$q('#cdMore').onclick=openList;tick()}
  function tick(){const t=nextTrip();if(!t)return;const ms=Date.parse(t.start+'T00:00:00')-Date.now();if(ms<=0){if(!$q('#tripCountdown.live'))renderCard();return}
    const p=parts(ms);document.querySelectorAll('.cd-digits b').forEach(b=>{const v=String(p[b.dataset.k]).padStart(2,'0');if(b.textContent!==v){b.textContent=v;b.classList.remove('flip');void b.offsetWidth;b.classList.add('flip')}})}

  // ---- actions ----
  async function copy(text,msg){try{await navigator.clipboard.writeText(text);pop(msg,text)}catch(e){prompt(msg,text)}}
  function useTrip(t){const inp=$q('#trip');if(inp){inp.value=t.name;try{savePrefs()}catch(e){}}const lab=$q('#tripLabel');if(lab)lab.textContent=t.name;pop('Aktuelle Reise',t.name+' · neue Clips landen hier')}
  function upsert(t){const all=trips().filter(x=>x.code!==t.code);all.push(t);save(KEY,all);renderCard()}
  function openCreate(){let d=$q('#createSheet');if(!d){d=document.createElement('dialog');d.id='createSheet';d.className='sheet';document.body.appendChild(d)}
    const today=new Date(Date.now()+864e5*14).toISOString().slice(0,10);
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Reise planen</h2><button class="text-button" data-close>Abbrechen</button></div>'+
     '<label>Name der Reise</label><input id="ctName" maxlength="40" placeholder="z. B. Thailand ’26">'+
     '<div class="two"><div><label>Start</label><input id="ctStart" type="date" value="'+today+'"></div><div><label>Ende (optional)</label><input id="ctEnd" type="date"></div></div>'+
     '<div class="code-preview"><span>JOIN-CODE</span><b id="ctCode">TRIP-000000</b></div><button class="btn wide" id="ctSave">Reise erstellen</button>';
    const cloud=()=>window.clipitCloud?.on;const upd=()=>{d.querySelector('#ctCode').textContent=cloud()?slug(d.querySelector('#ctName').value||'Trip')+'-••••':makeCode(d.querySelector('#ctName').value||'Trip',d.querySelector('#ctStart').value||today)};
    d.querySelector('#ctName').oninput=upd;d.querySelector('#ctStart').oninput=upd;upd();
    d.querySelector('[data-close]').onclick=()=>closeSheet(d);
    d.querySelector('#ctSave').onclick=async()=>{const name=d.querySelector('#ctName').value.trim();const start=d.querySelector('#ctStart').value;const end=d.querySelector('#ctEnd').value||'';
      if(!name||!start){pop('Fast geschafft','Name und Startdatum fehlen noch.');return}
      let t={name,start,end:end&&end>=start?end:'',code:makeCode(name,start),owner:true,created:Date.now()};
      if(cloud()){const b=d.querySelector('#ctSave');b.disabled=true;b.textContent='Wird angelegt …';try{const c=await clipitCloud.createTrip(t);t={...t,code:c.code,id:c.id,cloud:true}}catch(e){pop('Offline angelegt','Cloud gerade nicht erreichbar – Code funktioniert trotzdem.')}finally{b.disabled=false}}
      upsert(t);useTrip(t);closeSheet(d);
      addNote('Reise erstellt',name+' · noch '+Math.max(0,Math.ceil((Date.parse(start)-Date.now())/864e5))+' Tage','✈');setTimeout(()=>openShare(t),260)};
    openSheet(d);setTimeout(()=>d.querySelector('#ctName').focus(),250)}
  function openShare(t){let d=$q('#shareSheet');if(!d){d=document.createElement('dialog');d.id='shareSheet';d.className='sheet';document.body.appendChild(d)}
    const url=linkFor(t);
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Crew einladen</h2><button class="text-button" data-close>Fertig</button></div>'+
     '<p class="sheet-sub">Schick den Link in eure Gruppe oder sag den Code durch. Wer beitritt, sieht den Countdown und filmt direkt in '+esc(t.name)+'.</p>'+
     '<div class="big-code" id="shCode">'+esc(t.code).split('').map((c,i)=>'<span style="animation-delay:'+(i*35)+'ms">'+c+'</span>').join('')+'</div>'+
     '<div class="share-link"><code>'+esc(url)+'</code></div>'+
     '<div class="two"><button class="btn" id="shShare">Link teilen</button><button class="btn secondary" id="shCopy">Link kopieren</button></div><button class="text-button wide" id="shCodeCopy">Nur Code kopieren</button>';
    d.querySelector('[data-close]').onclick=()=>closeSheet(d);
    d.querySelector('#shShare').onclick=async()=>{const text='Komm mit auf '+t.name+'! Join mit ClipIT!: '+url+' (Code '+t.code+')';try{if(navigator.share)await navigator.share({title:'ClipIT! · '+t.name,text,url});else copy(url,'Link kopiert')}catch(e){}};
    d.querySelector('#shCopy').onclick=()=>copy(url,'Link kopiert');d.querySelector('#shCodeCopy').onclick=()=>copy(t.code,'Code kopiert');openSheet(d)}
  function openJoin(){let d=$q('#joinSheet');if(!d){d=document.createElement('dialog');d.id='joinSheet';d.className='sheet';document.body.appendChild(d)}
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Reise beitreten</h2><button class="text-button" data-close>Abbrechen</button></div><p class="sheet-sub">Gib den Code ein, den du bekommen hast.</p><input id="jnCode" class="code-input" maxlength="20" placeholder="THAILAND26-K7Q2MXAB" autocomplete="off" autocapitalize="characters"><p class="field-note" id="jnMsg"></p><button class="btn wide" id="jnGo">Beitreten</button>';
    d.querySelector('[data-close]').onclick=()=>closeSheet(d);
    d.querySelector('#jnGo').onclick=async()=>{const raw=d.querySelector('#jnCode').value;if(window.clipitCloud?.isCloudCode(raw)){const b=d.querySelector('#jnGo');b.disabled=true;b.textContent='Suche Reise …';try{const t=await clipitCloud.fetchTrip(raw);joined({...t,cloud:true});closeSheet(d)}catch(e){d.querySelector('#jnMsg').textContent=e.message||'Reise nicht gefunden'}finally{b.disabled=false;b.textContent='Beitreten'}return}
      const p=parseCode(raw);if(!p){d.querySelector('#jnMsg').textContent='Der Code sieht nicht richtig aus. Beispiel: THAILAND-261214';d.querySelector('#jnCode').classList.add('shake');setTimeout(()=>d.querySelector('#jnCode').classList.remove('shake'),400);return}
      joined(p);closeSheet(d)};openSheet(d);setTimeout(()=>d.querySelector('#jnCode').focus(),250)}
  function openList(){let d=$q('#listSheet');if(!d){d=document.createElement('dialog');d.id='listSheet';d.className='sheet';document.body.appendChild(d)}
    const all=trips().sort((a,b)=>a.start.localeCompare(b.start));
    d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Deine Reisen</h2><button class="text-button" data-close>Fertig</button></div><div class="trip-list">'+all.map(t=>'<div class="trip-row"><span><b>'+esc(t.name)+'</b><small>'+new Date(Date.parse(t.start+'T00:00:00')).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'})+' · '+esc(t.code)+'</small></span><button class="text-button" data-share="'+esc(t.code)+'">Einladen</button><button class="text-button danger" data-del="'+esc(t.code)+'">Löschen</button></div>').join('')+'</div><div class="two"><button class="btn" id="lsNew">＋ Reise planen</button><button class="btn secondary" id="lsJoin">Code eingeben</button></div>';
    d.querySelector('[data-close]').onclick=()=>closeSheet(d);
    d.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>{closeSheet(d);setTimeout(()=>openShare(trips().find(t=>t.code===b.dataset.share)),240)});
    d.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{save(KEY,trips().filter(t=>t.code!==b.dataset.del));renderCard();closeSheet(d)});
    d.querySelector('#lsNew').onclick=()=>{closeSheet(d);setTimeout(openCreate,240)};d.querySelector('#lsJoin').onclick=()=>{closeSheet(d);setTimeout(openJoin,240)};openSheet(d)}
  function joined(p){const ex=trips().find(t=>t.code===p.code);const t=ex||{name:p.name,start:p.start,end:p.end||'',code:p.code,owner:false,created:Date.now(),...(p.cloud?{cloud:true,id:p.id}:{})};upsert(t);useTrip(t);
    try{page('home')}catch(e){}const days=Math.ceil((Date.parse(t.start)-Date.now())/864e5);addNote('Du bist dabei!',t.name+(days>0?' · noch '+days+' Tage':' · läuft gerade'),'★');confetti()}
  function confetti(){const c=document.createElement('div');c.className='confetti';for(let i=0;i<26;i++){const s=document.createElement('i');s.style.left=(Math.random()*100)+'%';s.style.animationDelay=(Math.random()*.3)+'s';s.style.background=['#FFC93C','#FF3B30','#F5F5F0'][i%3];c.appendChild(s)}document.body.appendChild(c);setTimeout(()=>c.remove(),1800)}

  // ---- milestones (Countdown-Erinnerungen) ----
  function milestones(){const seen=load(SEEN,{});trips().forEach(t=>{const days=Math.ceil((Date.parse(t.start+'T00:00:00')-Date.now())/864e5);
    [[30,'Noch 30 Tage'],[7,'Noch eine Woche'],[3,'Noch 3 Tage'],[1,'Morgen geht’s los'],[0,'Heute geht’s los!']].forEach(([n,label])=>{const k=t.code+':'+n;if(days<=n&&days>=n-(n?2:0)&&!seen[k]&&days>=0){seen[k]=1;addNote(label,t.name+' · Akku laden, ClipIT! bereit?','⏳');systemNotify(label+' · '+t.name,'Leg ClipIT! auf den Action Button und film ab Tag 1.')}})});save(SEEN,seen)}

  // ---- header bell ----
  function addBell(){const hr=$q('.header-right');if(!hr||$q('#bellBtn'))return;const b=document.createElement('button');b.id='bellBtn';b.className='icon-button bell';b.setAttribute('aria-label','Mitteilungen');
    b.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/></svg>';hr.insertBefore(b,hr.lastElementChild);b.onclick=openNotes;renderBell()}

  // ---- incoming link ----
  function handleLink(){const q=new URLSearchParams(location.search);const code=q.get('join');if(!code)return;history.replaceState(null,'',location.pathname);
    if(window.clipitCloud?.isCloudCode(code)){const go=async()=>{try{const t=await clipitCloud.fetchTrip(code);joined({...t,cloud:true})}catch(e){pop('Reise nicht gefunden',e.message||'Frag nach einem neuen Link.')}};const intro=$q('#introDialog');if(intro&&intro.open)intro.addEventListener('close',go,{once:true});else setTimeout(go,300);return}
    const p=parseCode(code);
    if(!p){pop('Link ungültig','Frag nach einem neuen Einladungslink.');return}if(q.get('n'))p.name=q.get('n').slice(0,40);if(q.get('e'))p.end=q.get('e');
    const intro=$q('#introDialog');const go=()=>joined(p);if(intro&&intro.open){intro.addEventListener('close',go,{once:true})}else setTimeout(go,300)}

  window.clipitTrips={openCreate,openJoin,openShare,openNotes,addNote,parseCode,makeCode,pop,trips,useTrip,renderHub:()=>renderHub(),systemNotify};
  addBell();renderCard();milestones();handleLink();
  setInterval(tick,1000);
  // ---- Reisen-Tab (ersetzt die alte Gruppen-App) ----
  function status(t){const st=Date.parse(t.start+'T00:00:00'),en=t.end?Date.parse(t.end+'T23:59:59'):st+864e5-1,now=Date.now();
    if(now<st){const d=Math.ceil((st-now)/864e5);return {k:'soon',txt:d===1?'Morgen':'in '+d+' Tagen',d}}
    if(now<=en){return {k:'live',txt:'Läuft · Tag '+(1+Math.floor((now-st)/864e5))}}return {k:'past',txt:'Vorbei'}}
  function clipCount(name){try{return clips.filter(c=>c.trip===name).length}catch(e){return 0}}
  function hlCount(name){try{return clips.filter(c=>c.trip===name&&c.highlight).length}catch(e){return 0}}
  function renderHub(){const h=$q('#tripHub');if(!h)return;const cur=$q('#trip')?.value;
    const all=trips().sort((a,b)=>{const o={live:0,soon:1,past:2};return o[status(a).k]-o[status(b).k]||a.start.localeCompare(b.start)});
    const fd=s=>new Date(Date.parse(s+'T00:00:00')).toLocaleDateString('de-DE',{day:'numeric',month:'short'});
    h.innerHTML='<div class="hub-actions"><button class="btn" id="hubNew">＋ Reise planen</button><button class="btn secondary" id="hubJoin">Code eingeben</button></div>'+
      (all.length?'<div class="hub-list">'+all.map((t,i)=>{const s=status(t),n=clipCount(t.name),hl=hlCount(t.name),on=t.name===cur;
        return '<article class="hub-card '+s.k+(on?' current':'')+'" style="--i:'+i+'"><div class="hub-top"><span class="hub-state">'+(s.k==='live'?'<i></i>':'')+esc(s.txt)+'</span>'+(on?'<span class="hub-cur">AKTIV</span>':'')+'</div>'+
          '<h2>'+esc(t.name)+'</h2><p>'+fd(t.start)+(t.end?' – '+fd(t.end):'')+' · <button class="code-chip" data-copy="'+esc(t.code)+'">'+esc(t.code)+'</button></p>'+
          '<div class="hub-stats"><span><b>'+n+'</b> Clips</span><span><b>'+hl+'</b> ★ Highlights</span></div>'+(t.cloud?'<div class="hub-cloud" data-cloud="'+esc(t.code)+'"></div>':'<p class="hub-offline">Offline-Reise · ohne gemeinsamen Speicher</p>')+
          '<div class="hub-btns"><button class="btn" data-share="'+esc(t.code)+'">Crew einladen</button>'+(on?'<button class="btn secondary" data-film="1">Filmen</button>':'<button class="btn secondary" data-use="'+esc(t.code)+'">Aktivieren</button>')+
          '<button class="icon-button" data-del="'+esc(t.code)+'" aria-label="Reise löschen">✕</button></div></article>'}).join('')+'</div>'
       :'<div class="hub-empty"><span>✈</span><b>Noch keine Reise.</b><small>Plane einen Trip oder tritt mit dem Code deiner Crew bei. Alle filmen in dieselbe Reise.</small></div>')+
      '<p class="hub-note">'+(window.clipitCloud?.on?'Neue Reisen bekommen einen geheimen Code. Nur wer ihn hat, sieht die Clips der Crew – Beitritt ohne Konto.':'Der Code enthält Reisename und Startdatum – Beitritt klappt ohne Konto. Clips bleiben auf deinem Gerät, bis du sie exportierst.')+'</p>';
    $q('#hubNew').onclick=openCreate;$q('#hubJoin').onclick=openJoin;
    h.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(b.dataset.copy,'Code kopiert'));
    h.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>openShare(trips().find(t=>t.code===b.dataset.share)));
    h.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{useTrip(trips().find(t=>t.code===b.dataset.use));renderHub()});
    h.querySelectorAll('[data-film]').forEach(b=>b.onclick=()=>page('camera'));
    try{window.clipitCloud?.decorate(h)}catch(e){}
    h.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const t=trips().find(x=>x.code===b.dataset.del);if(!confirm('„'+t.name+'“ aus deinen Reisen entfernen? Clips bleiben erhalten.'))return;save(KEY,trips().filter(x=>x.code!==t.code));renderCard()})}
  const _renderCard=renderCard;renderCard=function(){_renderCard();renderHub()};
  const _page=window.page;
  window.page=function(which){
    const tp=$q('#tripsPage');
    if(which!=='trips'){tp?.classList.add('hidden');return _page(which)}
    if((typeof recording==='function'&&recording())||(typeof busy!=='undefined'&&busy))return _page(which);
    _page('home');$q('#homePage')?.classList.add('hidden');tp?.classList.remove('hidden');
    document.body.dataset.page='trips';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='trips'));renderHub()};
  renderHub();
})();
