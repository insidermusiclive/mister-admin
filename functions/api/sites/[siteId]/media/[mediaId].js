import { json, readJson, HttpError } from '../../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../../_lib/auth.js';
import { mediaBaseUrl, mediaRowToObject } from '../../../../_lib/media.js';

export async function onRequestPut({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  const body = await readJson(request);
  const alt = String(body.alt || '').slice(0, 300);
  const r = await env.DB.prepare('UPDATE media SET alt = ? WHERE id = ? AND site_id = ? RETURNING *').bind(alt, params.mediaId, site.id).first();
  if (!r) throw new HttpError(404, 'Image not found');
  await audit(env, { site_id: site.id, user, action: 'media.update', target: params.mediaId });
  return json({ media: mediaRowToObject(r, mediaBaseUrl(env, request)) });
}

export async function onRequestDelete({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ? AND site_id = ?').bind(params.mediaId, site.id).first();
  if (!row) throw new HttpError(404, 'Image not found');
  const force = new URL(request.url).searchParams.get('force') === '1';
  // Refuse to delete an image that is still used somewhere, unless forced.
  const used = await env.DB.prepare(
    `SELECT collection FROM content WHERE site_id = ? AND instr(data_json, ?) > 0
     UNION SELECT collection FROM published WHERE site_id = ? AND instr(data_json, ?) > 0`
  ).bind(site.id, row.id, site.id, row.id).all();
  if (used.results.length && !force) {
    throw new HttpError(409, 'This image is still used in: ' + used.results.map((u) => u.collection).join(', '), { in_use: used.results.map((u) => u.collection) });
  }
  let keys = [];
  try { keys = JSON.parse(row.variants_json).map((v) => v.key); } catch { /* ignore */ }
  if (keys.length) await env.MEDIA.delete(keys);
  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(row.id).run();
  await audit(env, { site_id: site.id, user, action: 'media.delete', target: row.original_name });
  return json({ ok: true });
}
