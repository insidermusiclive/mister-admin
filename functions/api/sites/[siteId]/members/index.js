import { json, readJson, requireString, HttpError } from '../../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../../_lib/auth.js';

export async function onRequestGet({ env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, m.role FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.site_id = ? ORDER BY u.email`
  ).bind(site.id).all();
  return json({ members: results });
}

export async function onRequestPost({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'owner');
  const body = await readJson(request);
  const email = requireString(body, 'email', { max: 254 }).toLowerCase();
  const role = requireString(body, 'role', { max: 10 });
  if (!['owner', 'editor', 'viewer'].includes(role)) throw new HttpError(400, 'Role must be owner, editor or viewer');
  const target = await env.DB.prepare('SELECT id, email, name FROM users WHERE email = ?').bind(email).first();
  if (!target) throw new HttpError(404, 'No user with that email. An administrator must create the user first.');
  await env.DB.prepare(
    'INSERT INTO memberships (user_id, site_id, role) VALUES (?, ?, ?) ON CONFLICT(user_id, site_id) DO UPDATE SET role = excluded.role'
  ).bind(target.id, site.id, role).run();
  await audit(env, { site_id: site.id, user, action: 'member.set', target: `${email}:${role}` });
  return json({ member: { ...target, role } }, 201);
}
