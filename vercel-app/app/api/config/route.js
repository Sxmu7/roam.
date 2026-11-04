import {json, cloudReady, dbReady, blobReady, pushReady, usage} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export async function GET() {
  let use = null; if (dbReady()) { try { use = await usage(); } catch {} }
  return json({cloud: cloudReady(), accounts: dbReady(), blob: blobReady(), push: pushReady() ? process.env.VAPID_PUBLIC_KEY : null,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null, usage: use});
}
