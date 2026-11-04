// ClipIT! Cloud – gemeinsamer Speicher über Vercel Blob (+ Web Push)
import {put, list, del, head} from '@vercel/blob';
import webpush from 'web-push';
import {createHash, randomInt} from 'node:crypto';

export const cloudReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newId = () => Array.from({length: 8}, () => ALPHA[randomInt(ALPHA.length)]).join('');
export const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
export const fail = (msg, status = 400) => json({error: msg}, status);
const clean = (s, n = 60) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
export const hash = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

/** Code = SLUG-ID (ID = 8 Zeichen). Nur wer den ganzen Code kennt, kommt an die Reise. */
export function idFromCode(code) {
  const m = String(code || '').trim().toUpperCase().match(/(?:^|-)([A-HJ-NP-Z2-9]{8})$/);
  return m ? m[1] : null;
}
export function slug(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) || 'TRIP';
}
const base = id => `trips/${id}/`;

async function readJson(pathname) {
  try { const h = await head(pathname); const r = await fetch(h.url + '?v=' + Date.now(), {cache: 'no-store'}); return r.ok ? await r.json() : null; }
  catch { return null; }
}
const writeJson = (pathname, data) => put(pathname, JSON.stringify(data), {access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60});

export async function createTrip({name, start, end, device}) {
  const id = newId(), trip = {id, code: slug(name) + '-' + id, name: clean(name, 40) || 'Reise', start: clean(start, 10), end: clean(end, 10), created: Date.now(), owner: hash(device)};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) throw new Error('Startdatum fehlt');
  await writeJson(base(id) + 'trip.json', trip);
  return publicTrip(trip);
}
export const publicTrip = t => ({id: t.id, code: t.code, name: t.name, start: t.start, end: t.end, created: t.created});
export async function getTrip(code) { const id = idFromCode(code); if (!id) return null; const t = await readJson(base(id) + 'trip.json'); return t && t.id === id ? t : null; }

export async function listClips(trip, since = 0) {
  const out = []; let cursor;
  do { const r = await list({prefix: base(trip.id) + 'meta/', cursor, limit: 1000}); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  const fresh = out.filter(b => Number(b.pathname.split('/').pop().split('-')[0]) > since);
  const metas = await Promise.all(fresh.map(b => fetch(b.url).then(r => r.ok ? r.json() : null).catch(() => null)));
  return metas.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

export async function addClips(trip, device, user, clips) {
  const dev = hash(device), now = Date.now(), saved = [];
  for (const [i, c] of clips.slice(0, 50).entries()) {
    if (typeof c.url !== 'string' || !c.url.includes('.blob.vercel-storage.com/') || !c.pathname?.startsWith(base(trip.id) + 'clips/')) continue;
    const id = clean(c.id, 40).replace(/[^a-zA-Z0-9-]/g, '') || newId();
    const meta = {id, url: c.url, pathname: c.pathname, by: dev, user: clean(user, 40) || 'Jemand', date: clean(c.date, 30), duration: Number(c.duration) || 0,
      size: Number(c.size) || 0, type: clean(c.type, 40), name: clean(c.name, 120), highlight: !!c.highlight, at: now + i};
    await writeJson(base(trip.id) + `meta/${meta.at}-${id}.json`, meta); saved.push(meta);
  }
  if (saved.length) await notify(trip, dev, {title: trip.name, body: `${saved[0].user} hat ${saved.length === 1 ? (saved[0].highlight ? 'ein ★ Highlight' : 'einen Clip') : saved.length + ' Clips'} hochgeladen`, tag: 'clips-' + trip.id, url: '/?trip=' + encodeURIComponent(trip.code)});
  return saved;
}

export async function removeClip(trip, device, clipId) {
  const dev = hash(device); const r = await list({prefix: base(trip.id) + 'meta/', limit: 1000});
  const b = r.blobs.find(x => x.pathname.endsWith('-' + clipId + '.json')); if (!b) return false;
  const meta = await fetch(b.url).then(r => r.json()); if (meta.by !== dev) throw new Error('Nur eigene Clips löschbar');
  await del([b.url, meta.url]); return true;
}

export async function subscribe(trip, device, sub) {
  if (!sub?.endpoint?.startsWith('https://')) throw new Error('Ungültiges Abo');
  await writeJson(base(trip.id) + `subs/${hash(sub.endpoint)}.json`, {sub, by: hash(device), at: Date.now()});
}
async function notify(trip, dev, payload) {
  if (!pushReady()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:clipit@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const r = await list({prefix: base(trip.id) + 'subs/', limit: 1000});
  await Promise.all(r.blobs.map(async b => {
    try { const s = await fetch(b.url).then(r => r.json()); if (s.by === dev) return;
      await webpush.sendNotification(s.sub, JSON.stringify(payload), {TTL: 3600 * 24}); }
    catch (e) { if (e?.statusCode === 404 || e?.statusCode === 410) await del(b.url).catch(() => {}); }
  }));
}
