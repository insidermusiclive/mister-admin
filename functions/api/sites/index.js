import { json, readJson, requireString, isValidSlug, HttpError } from '../../_lib/http.js';
import { requireUser, requireAdmin, randomId, audit } from '../../_lib/auth.js';
import { validateSchema } from '../../_lib/schema.js';

export async function onRequestGet({ env, data }) {
  const user = requireUser(data);
  let rows;
  if (user.is_admin) {
    rows = (await env.DB.prepare(
      `SELECT s.id, s.slug, s.name, s.url, s.published_at, s.created_at, 'owner' AS role,
              (SELECT MAX(updated_at) FROM content c WHERE c.site_id = s.id) AS updated_at
         FROM sites s ORDER BY s.name`
    ).all()).results;
  } else {
    rows = (await env.DB.prepare(
      `SELECT s.id, s.slug, s.name, s.url, s.published_at, s.created_at, m.role,
              (SELECT MAX(updated_at) FROM content c WHERE c.site_id = s.id) AS updated_at
         FROM sites s JOIN memberships m ON m.site_id = s.id
        WHERE m.user_id = ? ORDER BY s.name`
    ).bind(user.id).all()).results;
  }
  return json({ sites: rows.map(withDirtyFlag) });
}

export function withDirtyFlag(row) {
  return { ...row, has_unpublished_changes: !!row.updated_at && (!row.published_at || row.updated_at > row.published_at) };
}

export async function onRequestPost({ request, env, data }) {
  const admin = requireAdmin(data);
  const body = await readJson(request);
  const name = requireString(body, 'name', { max: 100 });
  const slug = requireString(body, 'slug', { max: 64 }).toLowerCase();
  if (!isValidSlug(slug)) throw new HttpError(400, 'Slug must be lowercase letters, numbers and dashes (e.g. "my-site")');
  const url = requireString(body, 'url', { max: 500, optional: true });
  const schema = validateSchema(body.schema || { collections: {} });
  const exists = await env.DB.prepare('SELECT id FROM sites WHERE slug = ?').bind(slug).first();
  if (exists) throw new HttpError(409, 'A site with this slug already exists');
  const id = randomId();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sites (id, slug, name, url, schema_json) VALUES (?, ?, ?, ?, ?)').bind(id, slug, name, url, JSON.stringify(schema)),
    env.DB.prepare('INSERT INTO memberships (user_id, site_id, role) VALUES (?, ?, ?)').bind(admin.id, id, 'owner'),
  ]);
  await audit(env, { site_id: id, user: admin, action: 'site.create', target: slug });
  return json({ site: { id, slug, name, url, schema, role: 'owner' } }, 201);
}
