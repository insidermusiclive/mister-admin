// Change your own password.
import { json, readJson, HttpError } from '../../_lib/http.js';
import { requireUser, verifyPassword, hashPassword, validatePasswordStrength, audit } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, data }) {
  const user = requireUser(data);
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT salt, password_hash FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(String(body.current_password || ''), row.salt, row.password_hash))) {
    throw new HttpError(400, 'Current password is wrong');
  }
  validatePasswordStrength(body.new_password);
  const { salt, hash } = await hashPassword(body.new_password);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run();
  await audit(env, { user, action: 'auth.change_password' });
  return json({ ok: true });
}
