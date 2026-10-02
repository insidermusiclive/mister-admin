// PUBLIC, read-only. This is what the websites call.
// Serves the PUBLISHED content of a site with images resolved to full URLs.
// Cached at the edge for 60 seconds; the cache is cleared on publish.
import { json, HttpError, isValidSlug } from '../../../_lib/http.js';
import { parseSchema } from '../../../_lib/schema.js';
import { loadMediaMap, mediaBaseUrl, resolveImages } from '../../../_lib/media.js';
import { publicCacheKey } from '../../../_lib/publiccache.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const slug = String(params.slug || '');
  if (!isValidSlug(slug)) throw new HttpError(404, 'Site not found');

  let cache = null;
  try { cache = caches.default; } catch { /* not available locally */ }
  const cacheKey = publicCacheKey(request, slug);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const site = await env.DB.prepare('SELECT * FROM sites WHERE slug = ?').bind(slug).first();
  if (!site) throw new HttpError(404, 'Site not found');
  const schema = parseSchema(site);
  const mediaMap = await loadMediaMap(env, site.id, mediaBaseUrl(env, request));
  const { results } = await env.DB.prepare('SELECT collection, data_json FROM published WHERE site_id = ?').bind(site.id).all();
  const collections = {};
  for (const r of results) {
    if (!schema.collections[r.collection]) continue;
    try { collections[r.collection] = resolveImages(JSON.parse(r.data_json), mediaMap); } catch { /* skip */ }
  }
  for (const name of Object.keys(schema.collections)) {
    if (!(name in collections)) collections[name] = schema.collections[name].type === 'single' ? {} : [];
  }
  const res = json(
    { site: { slug: site.slug, name: site.name, url: site.url }, published_at: site.published_at, collections },
    200,
    { 'cache-control': 'public, max-age=60, s-maxage=60' }
  );
  if (cache && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
