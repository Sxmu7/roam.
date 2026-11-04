/* ClipIT! – übernimmt Daten aus der früheren App-Version (ROAM) einmalig.
   localStorage roam-* → clipit-*, IndexedDB roam-v1 → clipit-v1. Die alten Daten bleiben als Sicherung liegen. */
(function(){
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('roam-')){const n='clipit-'+k.slice(5);if(localStorage.getItem(n)===null)localStorage.setItem(n,localStorage.getItem(k))}}}catch(e){}
  const open=(name,create)=>new Promise((ok,no)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{if(create)r.result.createObjectStore('clips',{keyPath:'id'});else r.transaction.abort()};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const all=d=>new Promise((ok,no)=>{const q=d.transaction('clips','readonly').objectStore('clips').getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
  window.clipitDB=async function(){
    const db=await open('clipit-v1',true);
    if(localStorage.getItem('clipit-idb-migrated'))return db;
    try{const old=await open('roam-v1',false);const rows=old.objectStoreNames.contains('clips')?await all(old):[];old.close();
      if(rows.length){await new Promise((ok,no)=>{const t=db.transaction('clips','readwrite'),s=t.objectStore('clips');rows.forEach(r=>{const g=s.get(r.id);g.onsuccess=()=>{if(!g.result)s.put(r)}});t.oncomplete=ok;t.onerror=()=>no(t.error)})}
    }catch(e){/* keine alte Datenbank */}
    localStorage.setItem('clipit-idb-migrated','1');return db};
})();
