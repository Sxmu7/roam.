import {handleUpload} from '@vercel/blob/client';
import {json, fail, cloudReady, getTrip} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
// Gibt dem Browser ein kurzlebiges Token, damit das Video direkt in den Blob-Speicher geht (keine 4,5-MB-Grenze).
export async function POST(req) {
  if (!cloudReady()) return fail('Cloud-Speicher ist noch nicht eingerichtet', 503);
  const body = await req.json();
  try {
    const res = await handleUpload({request: req, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const {code} = JSON.parse(clientPayload || '{}'); const trip = await getTrip(code);
        if (!trip || !pathname.startsWith(`trips/${trip.id}/clips/`)) throw new Error('Kein Zugriff auf diese Reise');
        return {allowedContentTypes: ['video/*'], maximumSizeInBytes: 1024 * 1024 * 1024, addRandomSuffix: true};
      }});
    return json(res);
  } catch (e) { return fail(e.message, 403); }
}
