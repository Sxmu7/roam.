// ClipIT! Backend – alles im Gratis-Rahmen:
//  * Upstash Redis (Vercel Marketplace, Free) für Konten, Reisen, Clip-Feed, Reaktionen, Push-Abos
//  * Vercel Blob (Hobby, 1 GB) nur für die (verkleinerten) Crew-Kopien der Videos
import {del} from '@vercel/blob';
import webpush from 'web-push';
import {createHash, createHmac, randomInt, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

const R_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const blobReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const dbReady = () => !!(R_URL() && R_TOK());
export const cloudReady = () => blobReady() && dbReady();
export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const LIMIT_BYTES = Number(process.env.CLIPIT_STORAGE_LIMIT || 950 * 1024 * 1024);

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newId = (n = 8) => Array.from({length: n}, () => ALPHA[randomInt(ALPHA.length)]).join('');
export const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
export const fail = (msg, status = 400) => json({error: msg}, status);
export const clean = (s, n = 60) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
export const hash = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 24);
export const EMOJI = ['🔥', '😂', '😍', '👑'];

// ---------- Redis (REST, ohne Extra-Paket) ----------
export async function redis(...cmd) {
  const r = await fetch(R_URL(), {method: 'POST', headers: {Authorization: 'Bearer ' + R_TOK()}, body: JSON.stringify(cmd), cache: 'no-store'});
  const d = await r.json(); if (d.error) throw new Error('DB: ' + d.error); return d.result;
}
export async function pipe(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(R_URL() + '/pipeline', {method: 'POST', headers: {Authorization: 'Bearer ' + R_TOK()}, body: JSON.stringify(cmds), cache: 'no-store'});
  const d = await r.json(); return d.map(x => { if (x.error) throw new Error('DB: ' + x.error); return x.result; });
}
const J = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// ---------- Reisen ----------
export function idFromCode(code) { const m = String(code || '').trim().toUpperCase().match(/(?:^|-)([A-HJ-NP-Z2-9]{8})$/); return m ? m[1] : null; }
export function slug(name) { return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) || 'TRIP'; }
export const publicTrip = t => ({id: t.id, code: t.code, name: t.name, start: t.start, end: t.end, created: t.created});
export async function createTrip({name, start, end, device}) {
  const id = newId(), trip = {id, code: slug(name) + '-' + id, name: clean(name, 40) || 'Reise', start: clean(start, 10), end: clean(end, 10), created: Date.now(), owner: hash(device)};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.start)) throw new Error('Startdatum fehlt');
  await pipe([['SET', 'trip:' + id, JSON.stringify(trip)], ['SADD', 'trips', id]]);
  return publicTrip(trip);
}
export async function getTrip(code) { const id = idFromCode(code); if (!id) return null; const t = J(await redis('GET', 'trip:' + id)); return t && t.id === id ? t : null; }

// ---------- Clips ----------
export async function listClips(trip, since = 0) {
  const ids = await redis('ZRANGEBYSCORE', `trip:${trip.id}:order`, '(' + Number(since || 0), '+inf');
  if (!ids?.length) return [];
  const rows = await redis('HMGET', `trip:${trip.id}:clips`, ...ids);
  return rows.map(J).filter(Boolean);
}
export async function addClips(trip, device, user, clips) {
  const dev = hash(device), now = Date.now(), saved = [], cmds = [];
  let bytes = 0;
  for (const [i, c] of clips.slice(0, 50).entries()) {
    if (typeof c.url !== 'string' || !/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(c.url) || !String(c.pathname).startsWith(`trips/${trip.id}/`)) continue;
    const id = clean(c.id, 40).replace(/[^a-zA-Z0-9-]/g, '') || newId();
    const meta = {id, url: c.url, pathname: c.pathname, by: dev, user: clean(user, 40) || 'Jemand', date: clean(c.date, 30), duration: Number(c.duration) || 0,
      size: Number(c.size) || 0, type: clean(c.type, 40), name: clean(c.name, 120), highlight: !!c.highlight, film: !!c.film, at: now + i};
    cmds.push(['HSET', `trip:${trip.id}:clips`, id, JSON.stringify(meta)], ['ZADD', `trip:${trip.id}:order`, meta.at, id]);
    bytes += meta.size; saved.push(meta);
  }
  if (!saved.length) return [];
  cmds.push(['INCRBY', 'stats:bytes', bytes]);
  await pipe(cmds);
  const s = saved[0], film = saved.find(x => x.film);
  await notify(trip, dev, {title: trip.name, body: film ? `🎬 ${s.user} hat den Film fertig – ansehen!` : `${s.user} hat ${saved.length === 1 ? (s.highlight ? 'ein ★ Highlight' : 'einen Clip') : saved.length + ' Clips'} hochgeladen`,
    tag: 'clips-' + trip.id, url: '/?trip=' + encodeURIComponent(trip.code)});
  return saved;
}
export async function removeClip(trip, device, clipId) {
  const meta = J(await redis('HGET', `trip:${trip.id}:clips`, clipId)); if (!meta || meta.deleted) return false;
  if (meta.by !== hash(device) && trip.owner !== hash(device)) throw new Error('Nur eigene Clips löschbar');
  await del(meta.url).catch(() => {});
  const at = Date.now(); // Tombstone, damit alle Geräte das Löschen mitbekommen
  await pipe([['HSET', `trip:${trip.id}:clips`, clipId, JSON.stringify({id: clipId, deleted: true, at})], ['ZADD', `trip:${trip.id}:order`, at, clipId], ['DECRBY', 'stats:bytes', meta.size || 0]]);
  return true;
}
export async function usage() { return {bytes: Number(await redis('GET', 'stats:bytes')) || 0, limit: LIMIT_BYTES}; }

// ---------- Reaktionen ----------
export async function react(trip, device, user, clipId, emoji) {
  const f = clean(clipId, 40) + '|' + hash(device);
  if (!emoji) return redis('HDEL', `trip:${trip.id}:react`, f);
  if (!EMOJI.includes(emoji)) throw new Error('Unbekannte Reaktion');
  return redis('HSET', `trip:${trip.id}:react`, f, JSON.stringify({e: emoji, u: clean(user, 40)}));
}
export async function reactions(trip, device) {
  const flat = await redis('HGETALL', `trip:${trip.id}:react`) || [], me = hash(device), out = {};
  for (let i = 0; i < flat.length; i += 2) {
    const [clip, who] = flat[i].split('|'), v = J(flat[i + 1]); if (!v) continue;
    const o = out[clip] ||= {n: 0, by: {}}; o.n++; o.by[v.e] = (o.by[v.e] || 0) + 1; if (who === me) o.mine = v.e;
  }
  return out;
}

// ---------- Push ----------
export async function subscribe(trip, device, sub) {
  if (!sub?.endpoint?.startsWith('https://')) throw new Error('Ungültiges Abo');
  await redis('HSET', `trip:${trip.id}:subs`, hash(sub.endpoint), JSON.stringify({sub, by: hash(device), at: Date.now()}));
}
export async function notify(trip, dev, payload, perSub) {
  if (!pushReady()) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://clipit.vercel.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const flat = await redis('HGETALL', `trip:${trip.id}:subs`) || []; let sent = 0;
  for (let i = 0; i < flat.length; i += 2) {
    const s = J(flat[i + 1]); if (!s || (dev && s.by === dev)) continue;
    const p = perSub ? perSub(s) : payload; if (!p) continue;
    try { await webpush.sendNotification(s.sub, JSON.stringify(p), {TTL: 86400}); sent++; }
    catch (e) { if (e?.statusCode === 404 || e?.statusCode === 410) await redis('HDEL', `trip:${trip.id}:subs`, flat[i]); }
  }
  return sent;
}

// ---------- Konten ----------
const SECRET = () => createHash('sha256').update('clipit-auth:' + (process.env.CLIPIT_AUTH_SECRET || R_TOK() || '')).digest();
const b64 = s => Buffer.from(s).toString('base64url');
export function signToken(uid) { const p = b64(JSON.stringify({uid, exp: Date.now() + 1000 * 3600 * 24 * 120})); return p + '.' + createHmac('sha256', SECRET()).update(p).digest('base64url'); }
export function readToken(req) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); const [p, sig] = t.split('.'); if (!p || !sig) return null;
  const want = createHmac('sha256', SECRET()).update(p).digest('base64url');
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const d = J(Buffer.from(p, 'base64url').toString()); return d && d.exp > Date.now() ? d.uid : null;
}
const pw = (password, salt) => scryptSync(String(password), salt, 64).toString('hex');
const pub = u => ({id: u.id, email: u.email, name: u.name, device: u.device, trips: u.trips || [], created: u.created});
export async function register({email, password, name, device}) {
  email = clean(email, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-Mail-Adresse prüfen');
  if (String(password || '').length < 8) throw new Error('Passwort: mindestens 8 Zeichen');
  const salt = randomBytes(16).toString('hex'), id = 'u' + newId(10);
  const u = {id, email, name: clean(name, 40) || email.split('@')[0], salt, pw: pw(password, salt), device: clean(device, 60) || id, trips: [], created: Date.now()};
  const ok = await redis('SET', 'email:' + hash(email), id, 'NX'); if (!ok) throw new Error('Für diese E-Mail gibt es schon ein Konto – bitte anmelden');
  await redis('SET', 'user:' + id, JSON.stringify(u));
  return {token: signToken(id), user: pub(u)};
}
export async function login({email, password}) {
  email = clean(email, 120).toLowerCase();
  const key = 'fail:' + hash(email), fails = Number(await redis('GET', key)) || 0;
  if (fails >= 8) throw new Error('Zu viele Versuche – in 15 Minuten nochmal');
  const id = await redis('GET', 'email:' + hash(email)); const u = id && J(await redis('GET', 'user:' + id));
  const okPw = u && timingSafeEqual(Buffer.from(pw(password, u.salt), 'hex'), Buffer.from(u.pw, 'hex'));
  if (!okPw) { await pipe([['INCR', key], ['EXPIRE', key, 900]]); throw new Error('E-Mail oder Passwort falsch'); }
  await redis('DEL', key);
  return {token: signToken(u.id), user: pub(u)};
}
export async function getUser(uid) { const u = J(await redis('GET', 'user:' + uid)); return u ? pub(u) : null; }
export async function updateUser(uid, {name, trips}) {
  const u = J(await redis('GET', 'user:' + uid)); if (!u) throw new Error('Konto nicht gefunden');
  if (name !== undefined) u.name = clean(name, 40) || u.name;
  if (Array.isArray(trips)) {
    const map = new Map((u.trips || []).map(t => [t.code, t]));
    for (const t of trips.slice(0, 100)) {
      const code = clean(t.code, 30).toUpperCase(); if (!idFromCode(code) && !/^[A-Z0-9]{1,10}-\d{6}$/.test(code)) continue;
      if (t.removed) { map.delete(code); continue; }
      map.set(code, {code, name: clean(t.name, 40), start: clean(t.start, 10), end: clean(t.end, 10), cloud: !!idFromCode(code)});
    }
    u.trips = [...map.values()];
  }
  await redis('SET', 'user:' + uid, JSON.stringify(u));
  return pub(u);
}
export async function deleteUser(uid) { const u = J(await redis('GET', 'user:' + uid)); if (!u) return; await pipe([['DEL', 'user:' + uid], ['DEL', 'email:' + hash(u.email)]]); }

// ---------- Tägliche Erinnerung (Vercel Cron, im Hobby-Plan 1× pro Tag) ----------
export async function dailyReminders() {
  const ids = await redis('SMEMBERS', 'trips') || [], today = new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Berlin'}); let pushes = 0, active = 0;
  for (const id of ids) {
    const t = J(await redis('GET', 'trip:' + id)); if (!t) continue;
    if (today < t.start || today > (t.end || t.start)) continue; active++;
    const clips = (await listClips(t, Date.now() - 864e5)).filter(c => !c.deleted && !c.film && String(c.date).slice(0, 10) === today);
    const byDev = {}, byUser = {}; clips.forEach(c => { byDev[c.by] = (byDev[c.by] || 0) + 1; byUser[c.user] = (byUser[c.user] || 0) + 1; });
    const top = Object.entries(byUser).sort((a, b) => b[1] - a[1])[0];
    pushes += await notify(t, null, null, s => {
      const mine = byDev[s.by] || 0;
      if (!mine) return {title: t.name, body: top ? `Heute noch kein Clip von dir 👀 ${top[0]} hat schon ${top[1]}.` : 'Heute noch kein Clip – filmt den Abend! 🎬', tag: 'daily-' + id, url: '/?rec=1'};
      return {title: t.name + ' · Tag im Kasten', body: `Du hast heute ${mine} Clip${mine > 1 ? 's' : ''}, die Crew ${clips.length}. Schau sie dir an ✨`, tag: 'daily-' + id, url: '/?trip=' + encodeURIComponent(t.code)};
    });
  }
  return {active, pushes};
}
