// Media helpers: R2 keys, URL building, resolving image references in content.
export const VARIANT_WIDTHS = [480, 1200, 2000];
export const MAX_VARIANT_BYTES = 4 * 1024 * 1024; // 4 MB per variant, generous
export const ALLOWED_VARIANT_TYPES = ['image/webp', 'image/jpeg'];

export function mediaKey(siteSlug, mediaId, width, ext) {
  return `sites/${siteSlug}/${mediaId}/${width}.${ext}`;
}

export function mediaBaseUrl(env, request) {
  const base = (env.MEDIA_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base) return base;
  return new URL(request.url).origin + '/media';
}

export function mediaRowToObject(row, base) {
  let variants = [];
  try { variants = JSON.parse(row.variants_json || '[]'); } catch { /* ignore */ }
  const src = {};
  for (const v of variants) src[v.width] = `${base}/${v.key}`;
  const widths = variants.map((v) => v.width).sort((a, b) => a - b);
  const largest = widths[widths.length - 1];
  return {
    media_id: row.id,
    alt: row.alt || '',
    width: row.width,
    height: row.height,
    original_name: row.original_name,
    created_at: row.created_at,
    size_bytes: row.size_bytes,
    placeholder: row.placeholder || '',
    src,
    url: largest ? src[largest] : '',
    srcset: variants.map((v) => `${base}/${v.key} ${v.width}w`).join(', '),
  };
}

export async function loadMediaMap(env, siteId, base) {
  const { results } = await env.DB.prepare('SELECT * FROM media WHERE site_id = ?').bind(siteId).all();
  const map = new Map();
  for (const r of results) map.set(r.id, mediaRowToObject(r, base));
  return map;
}

/** Replaces { media_id, alt } references with full image objects (src, srcset, ...). */
export function resolveImages(value, mediaMap) {
  if (Array.isArray(value)) return value.map((v) => resolveImages(v, mediaMap));
  if (!value || typeof value !== 'object') return value;
  if (typeof value.media_id === 'string' && Object.keys(value).length <= 2) {
    const m = mediaMap.get(value.media_id);
    if (!m) return null;
    return { ...m, alt: value.alt || m.alt };
  }
  const out = {};
  for (const k of Object.keys(value)) out[k] = resolveImages(value[k], mediaMap);
  return out;
}
