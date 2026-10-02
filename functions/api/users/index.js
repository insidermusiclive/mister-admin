import { json, readJson, requireString, isValidEmail, HttpError } from '../../_lib/http.js';
import { requireAdmin, hashPassword, validatePasswordStrength, randomId, audit } from '../../_lib/auth.js';

export async function onRequestGet({ env, data }) {
  requireAdmin(data);
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) AS site_count
       FROM users u ORDER BY u.created_at`
  ).all();
  return json({ users: results.map((u) => ({ ...u, is_admin: !!u.is_admin })) });
}

export async function onRequestPost({ request, env, data }) {
  const admin = requireAdmin(data);
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 254 }).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email address');
  const name = requireString(body, 'name', { max: 100, optional: true });
  validatePasswordStrength(body.password);
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'A user with this email already exists');
  const { salt, hash } = await hashPassword(body.password);
  const id = randomId();
  const isAdmin = body.is_admin ? 1 : 0;
  await env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt, is_admin) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, name, hash, salt, isAdmin).run();
  await audit(env, { user: admin, action: 'user.create', target: email });
  return json({ user: { id, email, name, is_admin: !!isAdmin } }, 201);
}
