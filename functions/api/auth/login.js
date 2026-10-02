import { json, readJson, requireString, HttpError } from '../../_lib/http.js';
import { verifyPassword, createSession, sessionCookie, checkLoginAllowed, recordLoginFailure, clearLoginFailures, audit } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 254 }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${email}|${ip}`;
  await checkLoginAllowed(env, key);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const ok = user && (await verifyPassword(password, user.salt, user.password_hash));
  if (!ok) {
    await recordLoginFailure(env, key);
    throw new HttpError(401, 'Wrong email or password');
  }
  await clearLoginFailures(env, key);
  const s = await createSession(env, user.id);
  const safe = { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin };
  await audit(env, { user: safe, action: 'auth.login' });
  return json({ user: safe }, 200, { 'set-cookie': sessionCookie(s.id, s.maxAge, request) });
}
