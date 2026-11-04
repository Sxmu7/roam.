import {json, cloudReady, pushReady} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
export function GET() {
  return json({cloud: cloudReady(), push: pushReady() ? process.env.VAPID_PUBLIC_KEY : null, googleClientId: process.env.GOOGLE_CLIENT_ID || null});
}
