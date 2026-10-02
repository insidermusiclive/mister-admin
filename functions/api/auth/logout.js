import { json } from '../../_lib/http.js';
import { destroySession, clearSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  await destroySession(env, request);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
}
