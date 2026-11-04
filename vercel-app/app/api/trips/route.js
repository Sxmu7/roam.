import {json, fail, cloudReady, createTrip, getTrip, publicTrip} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  if (!cloudReady()) return fail('Cloud-Speicher ist noch nicht eingerichtet', 503);
  try { const b = await req.json(); return json(await createTrip(b)); } catch (e) { return fail(e.message); }
}
export async function GET(req) {
  if (!cloudReady()) return fail('Cloud-Speicher ist noch nicht eingerichtet', 503);
  const t = await getTrip(new URL(req.url).searchParams.get('code'));
  return t ? json(publicTrip(t)) : fail('Reise nicht gefunden', 404);
}
