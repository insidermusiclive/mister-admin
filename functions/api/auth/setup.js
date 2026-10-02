// First-run setup: creates the first administrator. Only works while there are no users.
import { json, readJson, requireString, isValidEmail, HttpError } from '../../_lib/http.js';
import { hashPassword, validatePasswordStrength, randomId, createSession, sessionCookie, audit } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return json({ needs_setup: row.n === 0 });
}

export async function onRequestPost({ request, env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (row.n > 0) throw new HttpError(403, 'Setup has already been completed');
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 254 }).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email address');
  const name = requireString(body, 'name', { max: 100, optional: true });
  validatePasswordStrength(body.password);
  const { salt, hash } = await hashPassword(body.password);
  const id = randomId();
  await env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt, is_admin) VALUES (?, ?, ?, ?, ?, 1)')
    .bind(id, email, name, hash, salt).run();
  const user = { id, email, name, is_admin: true };
  await audit(env, { user, action: 'setup.create_admin', target: email });
  const s = await createSession(env, id);
  return json({ user }, 201, { 'set-cookie': sessionCookie(s.id, s.maxAge, request) });
}
