import {json, fail, dbReady, readToken, getUser, updateUser, deleteUser} from '../../../lib/clipit.js';
export const dynamic = 'force-dynamic';
const who = req => dbReady() ? readToken(req) : null;
export async function GET(req) { const uid = who(req); if (!uid) return fail('Nicht angemeldet', 401); const u = await getUser(uid); return u ? json({user: u}) : fail('Konto nicht gefunden', 404); }
export async function PUT(req) { const uid = who(req); if (!uid) return fail('Nicht angemeldet', 401); try { return json({user: await updateUser(uid, await req.json())}); } catch (e) { return fail(e.message); } }
export async function DELETE(req) { const uid = who(req); if (!uid) return fail('Nicht angemeldet', 401); await deleteUser(uid); return json({ok: true}); }
