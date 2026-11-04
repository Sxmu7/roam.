/* ClipIT! Motion – Seitenwechsel, gleitende Navi-Pille, Ripple, Header beim Scrollen, Zähler. */
(function(){
  const $q=s=>document.querySelector(s);
  const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('motion');

  // ---- Navi-Pille, die zum aktiven Tab gleitet ----
  function pill(){const nav=$q('nav');if(!nav)return;let p=nav.querySelector('.nav-pill');if(!p){p=document.createElement('span');p.className='nav-pill';nav.prepend(p)}
    const a=nav.querySelector('[data-tab].active');if(!a||!a.offsetWidth){p.style.opacity=0;return}
    const r=a.getBoundingClientRect(),n=nav.getBoundingClientRect();
    p.style.cssText='opacity:1;width:'+r.width+'px;height:'+r.height+'px;transform:translate('+(r.left-n.left)+'px,'+(r.top-n.top)+'px)'}
  addEventListener('resize',pill);

  // ---- Seitenwechsel ----
  function wrapPage(){if(typeof window.page!=='function'||window.page.__motion)return;const orig=window.page;
    window.page=function(which){const run=()=>orig.apply(this,arguments);
      const before=document.body.dataset.page;
      if(!calm&&document.startViewTransition&&before!==which){document.documentElement.dataset.dir=order(which)>order(before)?'fwd':'back';document.startViewTransition(()=>{run();pill()})}
      else{run();const sec=$q('#'+which+'Page');if(sec){sec.classList.remove('page-in');void sec.offsetWidth;sec.classList.add('page-in')}}
      requestAnimationFrame(pill);navigator.vibrate?.(4)};
    window.page.__motion=1}
  const order=p=>['home','camera','files','trips'].indexOf(p);

  // ---- Ripple auf Buttons ----
  document.addEventListener('pointerdown',e=>{if(calm)return;const b=e.target.closest('.btn,.hc-crew,.hl-modes button,[data-tab],.code-chip');if(!b||b.disabled)return;
    const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2.2,w=document.createElement('span');w.className='ripple';
    w.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';
    if(getComputedStyle(b).position==='static')b.style.position='relative';b.style.overflow='hidden';b.appendChild(w);setTimeout(()=>w.remove(),650)},{passive:true});

  // ---- Header wird beim Scrollen gläsern ----
  let last=0;addEventListener('scroll',()=>{const y=scrollY;document.body.classList.toggle('scrolled',y>8);document.body.classList.toggle('nav-hide',y>last+6&&y>120);if(y<last-6)document.body.classList.remove('nav-hide');last=y},{passive:true});

  // ---- Zahlen zählen hoch ----
  function countUp(el){const to=parseFloat(el.textContent);if(!isFinite(to)||to<2||el.dataset.counted===el.textContent)return;const txt=el.textContent;let t0=null;
    const step=t=>{t0??=t;const k=Math.min(1,(t-t0)/700),v=Math.round(to*(1-Math.pow(1-k,3)));el.textContent=String(v);if(k<1)requestAnimationFrame(step);else{el.textContent=txt;el.dataset.counted=txt}};requestAnimationFrame(step)}
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){countUp(e.target);io.unobserve(e.target)}})):null;
  function counters(){if(calm||!io)return;document.querySelectorAll('.hub-stats b,.drive-count b,#tripCount,#storageMb').forEach(el=>io.observe(el))}

  // ---- Karten gestaffelt einblenden, wenn die Liste neu gerendert wird ----
  function stagger(root){root&&new MutationObserver(()=>{[...root.children].forEach((c,i)=>{if(!c.style.getPropertyValue('--i'))c.style.setProperty('--i',Math.min(i,12))})}).observe(root,{childList:true})}

  function init(){wrapPage();pill();setTimeout(pill,400);counters();stagger($q('#clips'));stagger($q('#journeys'));
    const nav=$q('nav');if(nav)new MutationObserver(pill).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
    const hub=$q('#tripHub');if(hub)new MutationObserver(counters).observe(hub,{childList:true})}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
