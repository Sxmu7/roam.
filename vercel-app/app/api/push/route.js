import {json, fail, cloudReady, getTrip, subscribe} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  if (!cloudReady()) return fail('Cloud-Speicher ist noch nicht eingerichtet', 503);
  try { const b = await req.json(); const t = await getTrip(b.code); if (!t) return fail('Reise nicht gefunden', 404); await subscribe(t, b.device, b.sub); return json({ok: true}); }
  catch (e) { return fail(e.message); }
}
