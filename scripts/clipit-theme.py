"""Builds the ClipIT! look for vercel-app/public from the ROAM sources.

Run from the repo root:  python3 scripts/clipit-theme.py
It rewrites the colour palette of public/design.css into the ClipIT! dark,
minimal palette, appends clipit.css overrides and rebrands visible copy.
App logic (app.js, groups-ui.js, onboarding.js) is only touched for
user-facing strings; storage keys stay the same so existing clips survive.
"""
import re, pathlib, colorsys

SRC = pathlib.Path('public')
DST = pathlib.Path('vercel-app/public')
ACC = (255, 201, 60)

def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) in (3, 4):
        h = ''.join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    a = h[6:8] if len(h) == 8 else ''
    return (r, g, b), a

def to_hex(rgb, a=''):
    return '#%02x%02x%02x%s' % (*rgb, a)

def classify(rgb):
    r, g, b = [c / 255 for c in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    blue = 0.55 < h < 0.7 and s > 0.6 and 0.35 < l < 0.75
    return blue, l

def map_color(hexc, prop):
    rgb, a = hex2rgb(hexc)
    blue, l = classify(rgb)
    if blue:
        return to_hex(ACC, a)
    if rgb == (95, 172, 141):          # status green
        return hexc
    text = prop.startswith('color') or prop == 'fill' or prop == 'stroke'
    bg = prop.startswith('background')
    border = prop.startswith('border') or prop.startswith('outline') or 'shadow' in prop
    if a and int(a, 16) < 0x40 and rgb == (255, 255, 255):
        return hexc                     # translucent white on dark camera: keep
    if text:
        if l > 0.93:
            return hexc
        if l > 0.45:
            return to_hex((143, 143, 138), a)
        return to_hex((245, 245, 240), a)
    if bg:
        if l > 0.96:
            return to_hex((21, 21, 21), a)
        if l > 0.85:
            return to_hex((30, 30, 30), a)
        if l > 0.45:
            return to_hex((60, 60, 58), a)
        return to_hex((12, 12, 12), a)
    if border:
        if l > 0.8:
            return to_hex((38, 38, 38), a)
        return to_hex((70, 70, 68), a)
    if l > 0.85:
        return to_hex((38, 38, 38), a)
    if l > 0.45:
        return to_hex((143, 143, 138), a)
    return to_hex((245, 245, 240), a)

def recolor(css):
    css = css.replace(':root{--blue:#3778f6;--ink:#202c40;--muted:#8c98ab;--line:#e6ebf3;--bg:#f5f7fb;--white:#fff}',
                      ':root{--blue:#FFC93C;--ink:#F5F5F0;--muted:#8f8f8a;--line:#232323;--bg:#0A0A0A;--white:#151515}')
    def decl(m):
        prop, val = m.group(1), m.group(2)
        val = re.sub(r'#[0-9a-fA-F]{3,8}\b', lambda c: map_color(c.group(0), prop), val)
        if prop.startswith('background'):
            val = re.sub(r'\bwhite\b', '#151515', val)
        return f'{prop}:{val}'
    return re.sub(r'([a-z-]+):([^;{}]+)', decl, css)

WM = '<span class="wm">Clip<b>IT</b><i class="bang"></i></span>'

INTRO0 = ('<div class="intro-step" data-step="0"><span class="intro-number">01 / 05</span>'
  '<div class="intro-hero"><div class="hero-mark">' + '<span class="wm">Clip<b>IT</b><i class="bang"></i></span>' + '</div><div class="hero-reel"><i></i><i></i><i></i><i></i><i></i></div></div>'
  '<span class="overline">EVERY CLIP. ONE FILM.</span><h2 id="introTitle">Alle filmen.<br>Ein Film.</h2>'
  '<p>Jeder aus der Crew filmt per Knopfdruck. ClipIT! sammelt alle Clips eurer Reise – chronologisch, mit Datum, Ort und Namen.</p>'
  '<div class="intro-points"><span><b>1</b>Filmen</span><span><b>2</b>Sammeln</span><span><b>3</b>Film ansehen</span></div></div>')
INTRO4_HEAD = ('<div class="intro-step hidden" data-step="4"><span class="intro-number">05 / 05</span><span class="intro-symbol">●</span>'
  '<h2>Ein Drücken.<br>Du filmst.</h2><p>Leg ClipIT! auf den Action Button oder als Widget aufs Kontrollzentrum. Die App öffnet sich und nimmt sofort auf.</p>'
  '<div class="intro-quick"><span class="ab"><i></i></span><span><b>Sofort filmen</b><small>Action Button · Kontrollzentrum · Sperrbildschirm</small></span></div>'
  '<div class="intro-info"><b>Als App auf dem Homescreen</b><p>iPhone: Safari → Teilen → Zum Home-Bildschirm.<br>Android: Browser → App installieren.</p><button class="text-button" id="introInstall">Installationsmöglichkeit prüfen ↗</button></div></div>')

def replace_step(h, n, new):
    a = h.index('<div class="intro-step' + ('' if n == 0 else ' hidden') + '" data-step="%d">' % n)
    nxt = h.find('<div class="intro-step hidden" data-step="%d">' % (n + 1), a)
    if nxt < 0:
        nxt = h.index('<div class="intro-bottom">', a)
    return h[:a] + new + h[nxt:]

def rebrand_html(h):
    h = replace_step(h, 0, INTRO0)
    h = replace_step(h, 4, INTRO4_HEAD)
    for a, b in [('<h2>Dein nächstes Kapitel.</h2>', '<h2>Wer filmt?</h2>'), ('<h2>Bereit zum Aufnehmen.</h2>', '<h2>Kamera bereit?</h2>'),
                 ('<h2>Gemeinsam unterwegs.</h2>', '<h2>Mit der Crew.</h2>'), ('placeholder="z. B. Brasilien 2027"', 'placeholder="z. B. Thailand ’26"'),
                 ('<script src="onboarding.js"></script>', '<script src="onboarding.js"></script><script src="quick.js"></script><script src="vendor-blob.js"></script><script src="cloud.js"></script><script src="trips.js"></script><script src="hl.js"></script><script src="drive.js"></script><script src="install.js"></script><script src="film.js"></script><script src="story.js"></script><script src="map.js"></script><script src="motion.js"></script>')]:
        h = h.replace(a, b)
    R = [
        ('<a class="brand" href="./"><span class="brand-icon"><svg><use href="#i-camera"/></svg></span>roam</a>', '<a class="brand" href="./" aria-label="ClipIT!">' + WM + '</a>'),
        ('<span class="intro-brand">roam<span>•</span></span>', '<span class="intro-brand">' + WM + '</span>'),
        ('<title>ROAM — Dein Reisetagebuch</title>', '<title>ClipIT! — Every clip. One film.</title>'),
        ('<meta name="theme-color" content="#f5f7fb">', '<meta name="theme-color" content="#0A0A0A">'),
        ('content="Reisen aufnehmen, Clips ordnen und Originaldateien exportieren."', 'content="ClipIT! – gemeinsam filmen, alle Clips an einem Ort, am Ende ein Film."'),
        ('<link rel="stylesheet" href="design.css">', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"><link rel="stylesheet" href="design.css">'),
        ('ROAM · PWA 5.1', 'ClipIT! · by SXMU'),
        ('DEINE REISE. DEINE ORIGINALDATEIEN.', 'EVERY CLIP. ONE FILM.'),
        ('ROAM-ZIP', 'ClipIT!-ZIP'),
        ('REISETAGEBUCH', 'CLIPIT!'),
        ('▷ Reisevorschau abspielen <span>Clips hintereinander ansehen</span>', '▷ Als Film abspielen <span>Alle Clips chronologisch</span>'),
        ('>▷ Abspielen<', '>▷ Film<'),
        ('Exportiere deine Clips regelmäßig. Cloud-Backup ist noch nicht enthalten.', 'Reisen mit Cloud-Code teilen Clips mit der Crew. Sicherung auch in Google Drive.'),
        ('<b>Lokal · ohne Upload</b>', '<b>Gerät + Crew-Cloud</b>'),
        ('Noch kein automatischer Video-Render, Cloud-Backup oder natives Widget.', 'Noch kein automatischer Video-Render.'),
        ('Keine automatische Sicherung.', 'Sicherung über die Crew-Cloud oder Google Drive.'),
    ]
    for a, b in R:
        h = h.replace(a, b)
    h = one_app(h)
    return h

TRIPS_TAB = ('<button id="tripsTab" data-tab="trips"><svg viewBox="0 0 24 24"><path d="M3 17l7-4V6a2 2 0 0 1 4 0v7l7 4v2l-7-2v3l2 1.5V23l-4-1-4 1v-1.5L10 20v-3l-7 2z"/></svg>'
             '<span>Reisen</span></button>')
TRIPS_PAGE = ('<section id="tripsPage" class="page hidden"><div class="page-heading"><div><span class="overline">CLIPIT! REISEN</span>'
              '<h1>Reisen</h1><p class="sub">Planen. Crew einladen. Zusammen filmen.</p></div></div><div id="tripHub"></div></section>')
INTRO3 = ('<div class="intro-step hidden" data-step="3"><span class="intro-number">04 / 05</span><span class="intro-symbol">✈</span>'
          '<h2>Mit der Crew.</h2><p>Unter „Reisen“ planst du den Trip und teilst Link oder Code. Wer beitritt, filmt direkt in dieselbe Reise.</p>'
          '<div class="intro-howto"><div><b>1</b><span>Reise planen – der Countdown läuft</span></div><div><b>2</b><span>Link oder Code an die Crew schicken</span></div>'
          '<div><b>3</b><span>Filmen, Highlights markieren, am Ende ein Film</span></div></div></div>')

def one_app(h):
    # Alte Gruppen-App raus – alles läuft über ClipIT!-Reisen
    h = re.sub(r'<button id="groupsTab".*?</button>', TRIPS_TAB, h, flags=re.S)
    h = re.sub(r'<section id="groupsPage".*?</section>', TRIPS_PAGE, h, flags=re.S)
    h = re.sub(r'<dialog id="groupUploadDialog">.*?</dialog>', '', h, flags=re.S)
    h = re.sub(r'<div class="intro-step hidden" data-step="3">.*?(?=<div class="intro-step hidden" data-step="4">)', INTRO3, h, flags=re.S)
    h = h.replace('<script src="groups-ui.js"></script>', '<script src="geo.js"></script>')
    h = h.replace('<script src="app.js"></script>', '<script src="migrate.js"></script><script src="app.js"></script>')
    h = h.replace(' Nur ausdrücklich in Gruppen geteilte Clips liegen zusätzlich online.', '')
    h = h.replace('Kein Standortverlauf und kein automatisches Teilen mit Gruppen.', 'Kein Standortverlauf, nichts wird automatisch geteilt.')
    return h

def rebrand_js(js):
    for a, b in [('ROAM-ZIP', 'ClipIT!-ZIP'), ('ROAM-App.', 'ClipIT!-App.'), ('ROAM-Export mit', 'ClipIT!-Export mit'),
                 ('ROAM-Originale-ZIP-Export', 'ClipIT!-Originale-ZIP-Export'), ('ROAM Export\\n', 'ClipIT! Export\\n')]:
        js = js.replace(a, b)
    js = re.sub(r"'roam-(?!v1')", "'clipit-", js)
    for a, b in RENAME:
        js = js.replace(a, b)
    for a, b in (HL_HOOKS if 'function add(blob' in js else []):
        if b not in js and js.count(a) == 1:
            js = js.replace(a, b)
    return js

RENAME = [
    ("let request=indexedDB.open('roam-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'id'});request.onsuccess=()=>{db=request.result;refresh()};request.onerror=()=>toast('Lokaler Speicher nicht verfügbar. Bitte normalen Browsermodus verwenden.');savePrefs();",
     "window.clipitDB().then(d=>{db=d;refresh()},()=>toast('Lokaler Speicher nicht verfügbar. Bitte normalen Browsermodus verwenden.'));savePrefs();"),
    ("'ROAM_'+stamp", "'ClipIT_'+stamp"), ("name:'ROAM.fcpxml'", "name:'ClipIT.fcpxml'"), ('<event name="ROAM">', '<event name="ClipIT!">'),
    ('readRoamZip', 'readClipZip'), ('keine ROAM-Metadaten', 'keine ClipIT!-Metadaten'),
]

HL_HOOKS = [
    ("media=node('div','clip-media');if(c.highlight||c.highlights?.length)media.dataset.hl=c.highlight?'★ HIGHLIGHT':'★ '+c.highlights.length;",
     "media=node('div','clip-media');if(c.film)media.dataset.hl='🎬 FILM';else if(c.highlight||c.highlights?.length)media.dataset.hl=c.highlight?'★ HIGHLIGHT':'★ '+c.highlights.length;"),
    ("let blob=new Blob(chunks,{type:active.mimeType});",
     "let blob=new Blob(chunks,{type:active.mimeType}),__d=(Date.now()-start)/1000,__hl=window.clipitHL?await window.clipitHL.finish(blob,__d):null;"),
    ("await add(blob,start,(Date.now()-start)/1000,null,{...meta,location:await locationPromise});",
     "let __loc=await locationPromise;if(__hl?.parts?.length){for(let p of __hl.parts)await add(p.blob,new Date(start.getTime()+p.from*1000),p.dur,null,{...meta,location:__loc,highlight:true,hlAt:p.at,hlAuto:!!p.auto});if(__hl.keepFull)await add(blob,start,__d,null,{...meta,location:__loc,highlights:__hl.marks})}else await add(blob,start,__d,null,{...meta,location:__loc,...(__hl?{highlights:__hl.marks}:{})});"),
    ("&&(!favoritesOnly||c.favorite)&&[", "&&(!favoritesOnly||c.favorite)&&(!window.__hlOnly||c.highlight||c.highlights?.length)&&["),
    ("media=node('div','clip-media');", "media=node('div','clip-media');if(c.highlight||c.highlights?.length)media.dataset.hl=c.highlight?'★ HIGHLIGHT':'★ '+c.highlights.length;"),
]

SW_PUSH = r"""
/* clipit-push: Mitteilung, wenn die Crew hochlädt */
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={title:'ClipIT!',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'ClipIT!',{body:d.body||'',tag:d.tag,icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'/'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.data&&e.notification.data.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus'in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}))});
"""

def main():
    css = recolor((SRC / 'design.css').read_text())
    css += '\n' + (pathlib.Path('scripts/clipit.css')).read_text()
    css += '\n' + (pathlib.Path('scripts/clipit-modern.css')).read_text()
    (DST / 'design.css').write_text(css)
    (DST / 'index.html').write_text(rebrand_html((SRC / 'index.html').read_text()))
    for f in ['app.js', 'onboarding.js', 'geo.js', 'quick.js']:
        (DST / f).write_text(rebrand_js((DST / f).read_text()).replace('||groupUploadBusy', ''))
    g = DST / 'groups-ui.js'
    if g.exists():  # Standort-Teil behalten, Gruppen-App entfernen
        src = g.read_text()
        (DST / 'geo.js').write_text('/* Standort bei Aufnahme (aus der früheren groups-ui.js) */\n' + src[:src.index('let activeGroup=null')])
        g.unlink()
    sw = (DST / 'sw.js').read_text()
    sw = re.sub(r"const CACHE='[^']+'", "const CACHE='clipit-shell-v8'", sw)
    if "'./quick.js'" not in sw:
        sw = sw.replace("'./onboarding.js',", "'./onboarding.js','./quick.js',")
    if "'./trips.js'" not in sw:
        sw = sw.replace("'./quick.js',", "'./quick.js','./trips.js',")
    sw = sw.replace("'./groups-ui.js',", "")
    if "'./geo.js'" not in sw:
        sw = sw.replace("'./app.js',", "'./app.js','./geo.js',")
    if "'./hl.js'" not in sw:
        sw = sw.replace("'./trips.js',", "'./trips.js','./hl.js',")
    for f in ['migrate.js', 'vendor-blob.js', 'cloud.js', 'drive.js', 'install.js', 'motion.js', 'film.js', 'story.js', 'map.js']:
        if "'./%s'" % f not in sw:
            sw = sw.replace("'./hl.js',", "'./hl.js','./%s'," % f)
    if 'clipit-push' not in sw:
        sw += SW_PUSH
    (DST / 'sw.js').write_text(sw)
    import json
    m = json.loads((DST / 'manifest.webmanifest').read_text())
    m.update({'name': 'ClipIT!', 'short_name': 'ClipIT!', 'background_color': '#0A0A0A', 'theme_color': '#0A0A0A',
              'description': 'Gemeinsam filmen. Am Ende ein Film.',
              'shortcuts': [{'name': 'Sofort filmen', 'short_name': 'Filmen', 'url': './?rec=1', 'icons': [{'src': 'icon-192.png', 'sizes': '192x192'}]},
                            {'name': 'Meine Clips', 'short_name': 'Clips', 'url': './?files=1'}]})
    (DST / 'manifest.webmanifest').write_text(json.dumps(m, ensure_ascii=False))

if __name__ == '__main__':
    main()
