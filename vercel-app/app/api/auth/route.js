import {json, fail, dbReady, register, login} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  if (!dbReady()) return fail('Konten sind noch nicht eingerichtet', 503);
  try { const b = await req.json(); return json(b.action === 'register' ? await register(b) : await login(b)); }
  catch (e) { return fail(e.message, e.message.startsWith('DB:') ? 500 : 400); }
}
