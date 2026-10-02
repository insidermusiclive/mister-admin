// Serves images from R2 at /media/<key>. Immutable cache headers (keys are unique per upload).
export async function onRequestGet({ request, env, params }) {
  const key = (params.path || []).join('/');
  if (!key.startsWith('sites/') || key.includes('..')) return new Response('Not found', { status: 404 });
  let cache = null;
  try { cache = caches.default; } catch { /* local dev */ }
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  const res = new Response(obj.body, { headers });
  if (cache) await cache.put(request, res.clone());
  return res;
}
