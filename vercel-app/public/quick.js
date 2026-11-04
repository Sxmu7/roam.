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

  async function quickRecord(){
    history.replaceState(null,'',location.pathname);
    document.body.classList.add('quick-mode');
    const intro=document.getElementById('introDialog');
    if(intro&&intro.open){try{localStorage.setItem('clipit-onboarding-v1','done')}catch(e){}intro.close()}
    try{page('camera')}catch(e){}
    const ready=await waitFor(()=>typeof db!=='undefined'&&db);
    if(!ready){banner('Speicher lädt noch','Tippe auf den Auslöser, um zu filmen.');return}
    document.getElementById('record').click();
    const ok=await waitFor(()=>document.getElementById('record').classList.contains('recording'),8000);
    if(ok)banner('Du filmst','Nochmal auf den Auslöser tippen zum Speichern.');
    else banner('Kamera-Freigabe nötig','Erlaube Kamera & Mikrofon, dann auf den Auslöser tippen.');
  }

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
      <p class="field-note">Wichtig auf dem iPhone: Füge ClipIT! zuerst über Safari zum Home-Bildschirm hinzu und nutze ClipIT! dann immer über diese App. Öffnet sich der Link stattdessen als Safari-Tab, speichert Safari die Clips getrennt von der Home-Bildschirm-App. Exportiere sie dann als ClipIT!-ZIP und importiere sie in der App.</p>
      <button class="btn secondary wide" id="qdTest">Jetzt testen</button>`;
      document.body.appendChild(d);
      d.querySelector('[data-close]').onclick=()=>d.close();
      d.querySelector('#qdUrl').textContent=QUICK_URL;
      d.querySelector('#qdCopy').onclick=async()=>{try{await navigator.clipboard.writeText(QUICK_URL);banner('Link kopiert','Jetzt in Kurzbefehle einfügen.')}catch(e){prompt('Link kopieren:',QUICK_URL)}};
      d.querySelector('#qdTest').onclick=()=>{d.close();quickRecord()};
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
})();
