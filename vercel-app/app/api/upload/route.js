import {handleUpload} from '@vercel/blob/client';
import {json, fail, cloudReady, getTrip, usage} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
// Kurzlebiges Token: das Video geht direkt vom Handy in den Blob-Speicher (keine 4,5-MB-Grenze).
export async function POST(req) {
  if (!cloudReady()) return fail('Cloud-Speicher ist noch nicht eingerichtet', 503);
  const body = await req.json();
  try {
    const res = await handleUpload({request: req, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const {code, size} = JSON.parse(clientPayload || '{}'); const trip = await getTrip(code);
        if (!trip || !pathname.startsWith(`trips/${trip.id}/`)) throw new Error('Kein Zugriff auf diese Reise');
        const u = await usage(); if (u.bytes + (Number(size) || 0) > u.limit) throw new Error('Crew-Cloud ist voll (Gratis-Speicher 1 GB)');
        return {allowedContentTypes: ['video/*'], maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true};
      }});
    return json(res);
  } catch (e) { return fail(e.message, 403); }
}
