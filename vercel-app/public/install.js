/* ClipIT! – animierte Anleitung "Zum Home-Bildschirm" (iPhone & Android) + dezenter Hinweis-Banner. */
(function(){
  const $q=s=>document.querySelector(s);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ua=navigator.userAgent;
  const isIOS=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/.test(ua);
  const iosNotSafari=isIOS&&/CriOS|FxiOS|EdgiOS|GSA\//.test(ua);
  const prompt=()=>{try{return installPrompt}catch(e){return null}};

  const SHARE='<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg>';
  const ADDSQ='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  const DOTS='<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';
  const ICON='<span class="ph-icon"><i></i><b></b></span>';
  const apps=['#3b82f6','#22c55e','#f97316','#a855f7','#ef4444','#14b8a6','#eab308','#64748b','#ec4899','#0ea5e9','#84cc16'];

  function phone(os){
    const home='<div class="ph-home">'+apps.map((c,i)=>'<span class="ph-app" style="background:'+c+';--i:'+i+'"></span>').join('')+'<span class="ph-new">'+ICON+'<small>ClipIT!</small></span></div>';
    if(os==='ios')return '<div class="phone ios"><div class="ph-notch"></div><div class="ph-screen">'+
      '<div class="ph-page"><div class="ph-wm">Clip<b>IT</b><i></i></div><div class="ph-card"></div><div class="ph-card s"></div><div class="ph-rec"></div></div>'+
      '<div class="ph-bar"><span class="ph-url">clipit.app</span><span class="ph-share">'+SHARE+'</span></div>'+
      '<div class="ph-sheet"><div class="ph-row">Kopieren</div><div class="ph-row">Zur Leseliste</div><div class="ph-row hot">Zum Home-Bildschirm '+ADDSQ+'</div><div class="ph-row">Lesezeichen</div></div>'+
      '<div class="ph-dialog"><div class="ph-dtop"><span>Abbrechen</span><b>Hinzufügen</b></div><div class="ph-dbody">'+ICON+'<span>ClipIT!</span></div></div>'+
      home+'<span class="ph-finger"></span></div></div>';
    return '<div class="phone android"><div class="ph-cam"></div><div class="ph-screen">'+
      '<div class="ph-abar"><span class="ph-url">clipit.app</span><span class="ph-dots">'+DOTS+'</span></div>'+
      '<div class="ph-page"><div class="ph-wm">Clip<b>IT</b><i></i></div><div class="ph-card"></div><div class="ph-card s"></div><div class="ph-rec"></div></div>'+
      '<div class="ph-menu"><div class="ph-row">Neuer Tab</div><div class="ph-row">Verlauf</div><div class="ph-row hot">App installieren</div><div class="ph-row">Teilen …</div></div>'+
      '<div class="ph-dialog"><div class="ph-dbody">'+ICON+'<span>ClipIT! installieren?</span></div><div class="ph-dtop"><span>Abbrechen</span><b>Installieren</b></div></div>'+
      home+'<span class="ph-finger"></span></div></div>';
  }
  const STEPS={
    ios:[['Teilen tippen','Unten in Safari das Teilen-Symbol '+SHARE],['„Zum Home-Bildschirm“','Im Menü etwas nach unten scrollen'],['„Hinzufügen“','Oben rechts bestätigen'],['Fertig','ClipIT! startet jetzt wie eine echte App']],
    android:[['Menü öffnen','Oben rechts in Chrome '+DOTS],['„App installieren“','oder „Zum Startbildschirm hinzufügen“'],['„Installieren“','Kurz bestätigen'],['Fertig','ClipIT! liegt auf deinem Startbildschirm']]
  };

  function open(force){
    let d=$q('#installSheet');if(!d){d=document.createElement('dialog');d.id='installSheet';d.className='sheet install-sheet';document.body.appendChild(d)}
    let os=force||(isAndroid?'android':'ios');
    const draw=()=>{
      const canPrompt=os==='android'&&prompt();
      d.innerHTML='<div class="sheet-grip"></div><div class="sheet-head"><h2>Auf den Home-Bildschirm</h2><button class="text-button" data-close>Fertig</button></div>'+
        (standalone()?'<div class="ins-done"><span>✓</span><b>Läuft schon als App.</b><small>Du hast ClipIT! bereits auf dem Home-Bildschirm.</small></div>':
        '<p class="sheet-sub">So startet ClipIT! im Vollbild, filmt schneller und schickt dir Mitteilungen.</p>'+
        '<div class="ins-tabs" role="tablist"><button data-os="ios" class="'+(os==='ios'?'active':'')+'">iPhone</button><button data-os="android" class="'+(os==='android'?'active':'')+'">Android</button><i></i></div>'+
        (os==='ios'&&iosNotSafari?'<div class="ins-warn">Öffne diese Seite zuerst in <b>Safari</b> – nur dort gibt es „Zum Home-Bildschirm“.</div>':'')+
        '<div class="ins-stage">'+phone(os)+'<ol class="ins-steps">'+STEPS[os].map((s,i)=>'<li style="--n:'+i+'"><b>'+(i+1)+'</b><span><strong>'+s[0]+'</strong><small>'+s[1]+'</small></span></li>').join('')+'</ol></div>'+
        (canPrompt?'<button class="btn wide" id="insNow">Jetzt installieren</button>':'')+
        '<button class="btn secondary wide" id="insQuick">Danach: Sofort filmen per Action Button →</button>');
      d.querySelector('[data-close]').onclick=()=>close(d);
      d.querySelectorAll('[data-os]').forEach(b=>b.onclick=()=>{os=b.dataset.os;draw()});
      const tabs=d.querySelector('.ins-tabs');if(tabs)tabs.dataset.os=os;
      d.querySelector('#insNow')?.addEventListener('click',async()=>{try{const p=prompt();await p.prompt();installPrompt=null}catch(e){}close(d)});
      d.querySelector('#insQuick')?.addEventListener('click',()=>{close(d);setTimeout(()=>window.clipitQuickSetup?.(),260)});
    };
    draw();localStorage.setItem('clipit-install-seen','1');$q('#installBanner')?.remove();
    d.classList.remove('closing');d.showModal();d.onclick=e=>{if(e.target===d)close(d)};
  }
  function close(d){d.classList.add('closing');setTimeout(()=>{d.close();d.classList.remove('closing')},220)}

  function banner(){
    if(standalone()||localStorage.getItem('clipit-install-seen')||$q('#installBanner'))return;
    const intro=$q('#introDialog');if(intro?.open){intro.addEventListener('close',()=>setTimeout(banner,1400),{once:true});return}
    const b=document.createElement('div');b.id='installBanner';
    b.innerHTML=ICON+'<span><b>ClipIT! als App</b><small>Vollbild, schneller filmen, Mitteilungen</small></span><button class="btn" id="ibGo">Zeigen</button><button class="ib-x" aria-label="Schließen">✕</button>';
    document.body.appendChild(b);requestAnimationFrame(()=>b.classList.add('show'));
    b.querySelector('#ibGo').onclick=()=>open();
    b.querySelector('.ib-x').onclick=()=>{localStorage.setItem('clipit-install-seen','1');b.classList.remove('show');setTimeout(()=>b.remove(),400)};
  }

  function hook(){
    for(const id of ['#install','#introInstall']){const el=$q(id);if(el){el.onclick=e=>{e.preventDefault();open()}}}
    const t=$q('#introInstall');if(t)t.textContent='Zeig mir wie – animiert ▶';
    const info=t?.closest('.intro-info');if(info&&!info.querySelector('.mini-phone')){info.classList.add('ins-intro');const m=document.createElement('div');m.className='mini-phone';m.innerHTML=ICON;info.prepend(m);
      const p=info.querySelector('p');if(p)p.innerHTML=isAndroid?'Chrome-Menü <b>⋮</b> → <b>App installieren</b>':'Safari → <b>Teilen</b> → <b>Zum Home-Bildschirm</b>'}
  }
  function init(){hook();setTimeout(banner,2500)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.clipitInstall={open};
})();
