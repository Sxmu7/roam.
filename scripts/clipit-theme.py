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
                 ('<script src="onboarding.js"></script>', '<script src="onboarding.js"></script><script src="quick.js"></script>')]:
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
    ]
    for a, b in R:
        h = h.replace(a, b)
    return h

def rebrand_js(js):
    for a, b in [('ROAM-ZIP', 'ClipIT!-ZIP'), ('ROAM-App.', 'ClipIT!-App.'), ('ROAM-Export mit', 'ClipIT!-Export mit'),
                 ('ROAM-Originale-ZIP-Export', 'ClipIT!-Originale-ZIP-Export'), ('ROAM Export\\n', 'ClipIT! Export\\n')]:
        js = js.replace(a, b)
    return js

def main():
    css = recolor((SRC / 'design.css').read_text())
    css += '\n' + (pathlib.Path('scripts/clipit.css')).read_text()
    css += '\n' + (pathlib.Path('scripts/clipit-modern.css')).read_text()
    (DST / 'design.css').write_text(css)
    (DST / 'index.html').write_text(rebrand_html((SRC / 'index.html').read_text()))
    for f in ['app.js', 'groups-ui.js', 'onboarding.js']:
        (DST / f).write_text(rebrand_js((DST / f).read_text()))
    sw = (DST / 'sw.js').read_text()
    sw = re.sub(r"const CACHE='[^']+'", "const CACHE='clipit-shell-v2'", sw)
    if "'./quick.js'" not in sw:
        sw = sw.replace("'./onboarding.js',", "'./onboarding.js','./quick.js',")
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
