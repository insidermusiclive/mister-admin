import { json, readJson, HttpError, nowIso } from '../../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../../_lib/auth.js';
import { parseSchema, validateCollectionData } from '../../../../_lib/schema.js';
import { loadMediaMap, mediaBaseUrl, resolveImages } from '../../../../_lib/media.js';

export async function onRequestGet({ request, env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const schema = parseSchema(site);
  const col = schema.collections[params.collection];
  if (!col) throw new HttpError(404, 'Unknown collection');
  const row = await env.DB.prepare('SELECT data_json, updated_at FROM content WHERE site_id = ? AND collection = ?').bind(site.id, params.collection).first();
  const mediaMap = await loadMediaMap(env, site.id, mediaBaseUrl(env, request));
  const value = row ? resolveImages(JSON.parse(row.data_json), mediaMap) : (col.type === 'single' ? {} : []);
  return json({ collection: params.collection, schema: col, data: value, updated_at: row?.updated_at || null });
}

// Replaces the whole collection. Validated against the schema; images must exist.
export async function onRequestPut({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  const schema = parseSchema(site);
  const col = schema.collections[params.collection];
  if (!col) throw new HttpError(404, 'Unknown collection');
  const body = await readJson(request);
  const { results } = await env.DB.prepare('SELECT id FROM media WHERE site_id = ?').bind(site.id).all();
  const mediaIds = new Set(results.map((r) => r.id));
  const clean = validateCollectionData(col, body.data, mediaIds);
  const dataJson = JSON.stringify(clean);
  if (dataJson.length > 900000) throw new HttpError(413, 'This collection is too large (max ~900 KB)');
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO content (site_id, collection, data_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(site_id, collection) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).bind(site.id, params.collection, dataJson, ts, user.id).run();
  await audit(env, { site_id: site.id, user, action: 'content.save', target: params.collection });
  const mediaMap = await loadMediaMap(env, site.id, mediaBaseUrl(env, request));
  return json({ ok: true, data: resolveImages(clean, mediaMap), updated_at: ts });
}
