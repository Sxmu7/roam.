import {json, fail, cloudReady, dailyReminders} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
// Vercel Cron (vercel.json) – schickt abends die Crew-Erinnerung. Mit CRON_SECRET nur durch Vercel auslösbar.
export async function GET(req) {
  const s = process.env.CRON_SECRET; if (s && req.headers.get('authorization') !== 'Bearer ' + s) return fail('Nicht erlaubt', 401);
  if (!cloudReady()) return json({skipped: true});
  return json(await dailyReminders());
}
