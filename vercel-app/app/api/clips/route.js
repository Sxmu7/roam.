import {json, fail, cloudReady, getTrip, listClips, addClips, removeClip} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
async function trip(code) { if (!cloudReady()) throw [503, 'Cloud-Speicher ist noch nicht eingerichtet']; const t = await getTrip(code); if (!t) throw [404, 'Reise nicht gefunden']; return t; }
const err = e => Array.isArray(e) ? fail(e[1], e[0]) : fail(e.message || 'Fehler');
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  try { const t = await trip(q.get('code')); return json({clips: await listClips(t, Number(q.get('since')) || 0), now: Date.now()}); } catch (e) { return err(e); }
}
export async function POST(req) {
  try { const b = await req.json(); const t = await trip(b.code); return json({clips: await addClips(t, b.device, b.user, b.clips || [])}); } catch (e) { return err(e); }
}
export async function DELETE(req) {
  try { const b = await req.json(); const t = await trip(b.code); return json({ok: await removeClip(t, b.device, b.id)}); } catch (e) { return err(e); }
}
