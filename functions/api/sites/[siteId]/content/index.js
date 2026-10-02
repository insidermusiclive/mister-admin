import { json } from '../../../../_lib/http.js';
import { requireSiteRole } from '../../../../_lib/auth.js';
import { parseSchema } from '../../../../_lib/schema.js';
import { loadMediaMap, mediaBaseUrl, resolveImages } from '../../../../_lib/media.js';

// Returns the draft content of every collection, with images resolved.
export async function onRequestGet({ request, env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const schema = parseSchema(site);
  const mediaMap = await loadMediaMap(env, site.id, mediaBaseUrl(env, request));
  const { results } = await env.DB.prepare('SELECT collection, data_json, updated_at FROM content WHERE site_id = ?').bind(site.id).all();
  const content = {};
  const meta = {};
  for (const r of results) {
    try { content[r.collection] = resolveImages(JSON.parse(r.data_json), mediaMap); } catch { /* skip corrupt */ }
    meta[r.collection] = { updated_at: r.updated_at };
  }
  for (const name of Object.keys(schema.collections)) {
    if (!(name in content)) content[name] = schema.collections[name].type === 'single' ? {} : [];
  }
  return json({ content, meta });
}
