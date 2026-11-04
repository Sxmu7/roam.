/* ClipIT! Quick-Record: ./?rec=1 öffnet die Kamera und startet sofort die Aufnahme.
   Gedacht für den iPhone Action Button, das Kontrollzentrum, Sperrbildschirm-Widgets
   (Kurzbefehl „URL öffnen“) und Android-App-Shortcuts. */
(function(){
  const params=new URLSearchParams(location.search);
  const quick=params.get('rec')==='1'||location.hash==='#rec';
  const QUICK_URL=location.origin+location.pathname.replace(/index\.html$/,'')+'?rec=1';
  const isStandalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

  function banner(text,sub){let b=document.getElementById('quickBanner');if(!b){b=document.createElement('div');b.id='quickBanner';document.body.appendChild(b)}
    b.innerHTML='<i></i><span><b>'+text+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span>';b.classList.add('show');clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('show'),3200)}

  async function waitFor(fn,ms=6000){const t0=Date.now();while(Date.now()-t0<ms){try{if(fn())return true}catch(e){}await new Promise(r=>setTimeout(r,80))}return false}

  // Fallback: großer Tipp-Bereich, falls iOS den Kamerastart ohne Fingertipp blockiert
  function tapToRecord(){let o=document.getElementById('tapRec');if(!o){o=document.createElement('button');o.id='tapRec';o.type='button';
      o.innerHTML='<span class="tr-ring"><i></i></span><b>Tippen zum Filmen</b><small>iOS braucht einmal deinen Fingertipp für die Kamera</small>';document.body.appendChild(o)}
    o.classList.add('show');o.onclick=async()=>{o.classList.remove('show');try{if(!stream)await camera()}catch(e){}const r=document.getElementById('record');if(!r.classList.contains('recording'))r.click();
      const ok=await waitFor(()=>r.classList.contains('recording'),5000);if(ok)banner('Du filmst','Nochmal auf den Auslöser tippen zum Speichern.');else banner('Kamera nicht frei','Einstellungen → Safari → Kamera & Mikrofon: Erlauben.')}}
  async function quickRecord(){
    history.replaceState(null,'',location.pathname);
    document.body.classList.add('quick-mode');
    try{localStorage.setItem('clipit-onboarding-v1','done')}catch(e){}
    const intro=document.getElementById('introDialog');if(intro&&intro.open)intro.close();
    document.getElementById('splash')?.remove();
    try{page('camera')}catch(e){}
    const ready=await waitFor(()=>typeof db!=='undefined'&&db);
    if(!ready){tapToRecord();return}
    document.getElementById('record').click();
    const ok=await waitFor(()=>document.getElementById('record').classList.contains('recording'),3500);
    if(ok){banner('Du filmst','Nochmal auf den Auslöser tippen zum Speichern.');if(!isStandalone)safariHint()}
    else tapToRecord();
  }
  // Kurzbefehle öffnen Links in Safari – Safari hat einen eigenen Speicher. Mit Konto + Cloud-Reise landen die Clips trotzdem in der App.
  function safariHint(){if(localStorage.getItem('clipit-safari-hint'))return;localStorage.setItem('clipit-safari-hint','1');
    setTimeout(()=>{const signed=!!localStorage.getItem('clipit-auth');window.clipitTrips?.addNote('Gefilmt in Safari',signed?'Die Clips laden automatisch in die Crew-Cloud und erscheinen in deiner ClipIT!-App.':'Melde dich hier und in der App mit demselben Konto an – dann erscheinen Safari-Clips automatisch in der App.','☁')},4000)}

  // ---- Einrichtungs-Dialog für Action Button & Widgets ----
  function setupDialog(){
    let d=document.getElementById('quickDialog');
    if(!d){d=document.createElement('dialog');d.id='quickDialog';d.className='quick-dialog';
      d.innerHTML=`<div class="qd-top"><span class="overline">SOFORT FILMEN</span><button class="text-button" data-close>Schließen</button></div>
      <h2>Ein Drücken.<br><span>Du filmst.</span></h2>
      <p>Lege ClipIT! auf den Action Button, ins Kontrollzentrum oder als Widget auf den Sperrbildschirm. Die App öffnet sich und startet sofort die Aufnahme. Der Clip landet direkt in deiner Reise.</p>
      <div class="qd-link"><code id="qdUrl"></code><button class="btn" id="qdCopy">Link kopieren</button></div>
      <ol class="qd-steps">
        <li><b>1</b><span>Öffne die App <strong>Kurzbefehle</strong> → <strong>＋</strong> → Aktion <strong>„URL öffnen“</strong> und füge den kopierten Link ein. Name: <strong>ClipIT! filmen</strong>.</span></li>
        <li><b>2</b><span><strong>Action Button:</strong> Einstellungen → Action Button → <strong>Kurzbefehl</strong> → „ClipIT! filmen“.</span></li>
        <li><b>3</b><span><strong>Widget:</strong> Sperrbildschirm oder Kontrollzentrum bearbeiten → <strong>Kurzbefehle</strong> hinzufügen → „ClipIT! filmen“.</span></li>
        <li><b>4</b><span>Einmal testen und Kamera & Mikrofon dauerhaft erlauben, damit es beim nächsten Mal ohne Rückfrage startet.</span></li>
      </ol>
      <div class="qd-note"><b>Gut zu wissen (iPhone):</b> Kurzbefehle öffnen Links immer in <strong>Safari</strong>, nicht in der Home-Bildschirm-App – das erlaubt Apple nicht anders. Damit die Clips trotzdem in deiner App landen: in Safari <strong>und</strong> in der App mit demselben <strong>Konto</strong> anmelden und eine Cloud-Reise nutzen. Dann wandern Safari-Clips automatisch rüber.</div>
      <div class="qd-note alt"><b>Schnellste Alternative:</b> Action Button auf <strong>Kamera → Video</strong> stellen, filmen wie gewohnt und die Clips später in ClipIT! unter <strong>Import</strong> auswählen – Datum und Uhrzeit bleiben erhalten.</div>
      <button class="btn secondary wide" id="qdLogin">Konto in diesem Browser anmelden</button>
      <button class="btn secondary wide" id="qdTest">Jetzt testen</button>`;
      document.body.appendChild(d);
      d.querySelector('[data-close]').onclick=()=>d.close();
      d.querySelector('#qdUrl').textContent=QUICK_URL;
      d.querySelector('#qdCopy').onclick=async()=>{try{await navigator.clipboard.writeText(QUICK_URL);banner('Link kopiert','Jetzt in Kurzbefehle einfügen.')}catch(e){prompt('Link kopieren:',QUICK_URL)}};
      d.querySelector('#qdTest').onclick=()=>{d.close();quickRecord()};
      d.querySelector('#qdLogin').onclick=()=>{d.close();window.clipitAccount?.open(localStorage.getItem('clipit-auth')?null:'login')};
    }
    d.showModal();
  }
  window.clipitQuickSetup=setupDialog;

  function addEntryPoints(){
    const restart=document.getElementById('restartIntro');
    if(restart&&!document.getElementById('quickSetup')){const b=document.createElement('button');b.className='btn wide';b.id='quickSetup';b.textContent='Action Button & Widget einrichten';restart.parentNode.insertBefore(b,restart);b.onclick=setupDialog}
    const camhead=document.querySelector('.camhead');
    if(camhead&&!document.getElementById('quickChip')){const c=document.createElement('button');c.id='quickChip';c.className='quick-chip';c.innerHTML='<i></i>Sofort filmen';c.onclick=setupDialog;camhead.insertBefore(c,camhead.lastElementChild)}
    const inst=document.getElementById('introInstall');
    if(inst&&!document.getElementById('introQuick')){const q=document.createElement('button');q.id='introQuick';q.className='text-button';q.textContent='Action Button einrichten ↗';inst.after(q);q.onclick=setupDialog}
  }

  addEntryPoints();
  if(quick)setTimeout(quickRecord,150);
  window.clipitQuickRecord=quickRecord;
})();
