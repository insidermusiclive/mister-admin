// Copies draft content to the published table and clears the public cache.
import { json, nowIso } from '../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../_lib/auth.js';
import { publicCacheKey } from '../../../_lib/publiccache.js';

export async function onRequestPost({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  const { results } = await env.DB.prepare('SELECT collection, data_json FROM content WHERE site_id = ?').bind(site.id).all();
  const ts = nowIso();
  const stmts = [env.DB.prepare('DELETE FROM published WHERE site_id = ?').bind(site.id)];
  for (const r of results) {
    stmts.push(env.DB.prepare('INSERT INTO published (site_id, collection, data_json, published_at) VALUES (?, ?, ?, ?)').bind(site.id, r.collection, r.data_json, ts));
  }
  stmts.push(env.DB.prepare('UPDATE sites SET published_at = ? WHERE id = ?').bind(ts, site.id));
  await env.DB.batch(stmts);
  try { await caches.default.delete(publicCacheKey(request, site.slug)); } catch { /* cache not available locally */ }
  await audit(env, { site_id: site.id, user, action: 'site.publish' });
  return json({ ok: true, published_at: ts });
}
