import { json, readJson, requireString, HttpError } from '../../_lib/http.js';
import { requireAdmin, hashPassword, validatePasswordStrength, audit } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, data, params }) {
  const admin = requireAdmin(data);
  const body = await readJson(request);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.userId).first();
  if (!user) throw new HttpError(404, 'User not found');
  const name = requireString(body, 'name', { max: 100, optional: true });
  let isAdmin = user.is_admin;
  if (typeof body.is_admin === 'boolean') {
    if (user.id === admin.id && !body.is_admin) throw new HttpError(400, 'You cannot remove your own administrator rights');
    isAdmin = body.is_admin ? 1 : 0;
  }
  await env.DB.prepare('UPDATE users SET name = ?, is_admin = ? WHERE id = ?').bind(name, isAdmin, user.id).run();
  if (body.password) {
    validatePasswordStrength(body.password);
    const { salt, hash } = await hashPassword(body.password);
    await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    await audit(env, { user: admin, action: 'user.reset_password', target: user.email });
  }
  await audit(env, { user: admin, action: 'user.update', target: user.email });
  return json({ user: { id: user.id, email: user.email, name, is_admin: !!isAdmin } });
}

export async function onRequestDelete({ env, data, params }) {
  const admin = requireAdmin(data);
  if (params.userId === admin.id) throw new HttpError(400, 'You cannot delete your own account');
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(params.userId).first();
  if (!user) throw new HttpError(404, 'User not found');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params.userId),
    env.DB.prepare('DELETE FROM memberships WHERE user_id = ?').bind(params.userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.userId),
  ]);
  await audit(env, { user: admin, action: 'user.delete', target: user.email });
  return json({ ok: true });
}
