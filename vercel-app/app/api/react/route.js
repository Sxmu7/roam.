import {json, fail, cloudReady, getTrip, react, reactions} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  if (!cloudReady()) return fail('Cloud nicht eingerichtet', 503);
  const q = new URL(req.url).searchParams, t = await getTrip(q.get('code')); if (!t) return fail('Reise nicht gefunden', 404);
  return json({reactions: await reactions(t, q.get('device') || '')});
}
export async function POST(req) {
  if (!cloudReady()) return fail('Cloud nicht eingerichtet', 503);
  try { const b = await req.json(), t = await getTrip(b.code); if (!t) return fail('Reise nicht gefunden', 404);
    await react(t, b.device, b.user, b.clip, b.emoji || ''); return json({reactions: await reactions(t, b.device)}); }
  catch (e) { return fail(e.message); }
}
