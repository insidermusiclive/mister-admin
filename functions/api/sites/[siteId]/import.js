// Restores content (and optionally schema) from an export file. Owner only.
import { json, readJson, HttpError, nowIso } from '../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../_lib/auth.js';
import { validateSchema, validateCollectionData } from '../../../_lib/schema.js';

export async function onRequestPost({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'owner');
  const body = await readJson(request);
  if (body.format !== 'mister-admin-export/1') throw new HttpError(400, 'Not a Mister Admin export file');
  const schema = validateSchema(body.schema);
  const mediaIds = new Set((await env.DB.prepare('SELECT id FROM media WHERE site_id = ?').bind(site.id).all()).results.map((r) => r.id));
  const stmts = [env.DB.prepare('UPDATE sites SET schema_json = ? WHERE id = ?').bind(JSON.stringify(schema), site.id)];
  const ts = nowIso();
  for (const [name, col] of Object.entries(schema.collections)) {
    const raw = body.content?.[name];
    if (raw === undefined) continue;
    const clean = validateCollectionData(col, raw, mediaIds);
    stmts.push(env.DB.prepare(
      `INSERT INTO content (site_id, collection, data_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(site_id, collection) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    ).bind(site.id, name, JSON.stringify(clean), ts, user.id));
  }
  await env.DB.batch(stmts);
  await audit(env, { site_id: site.id, user, action: 'site.import' });
  return json({ ok: true });
}
