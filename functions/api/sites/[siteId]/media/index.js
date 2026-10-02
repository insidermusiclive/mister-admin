// Media library: list and upload.
// The browser does all the heavy work (HEIC conversion, rotation, resizing, WebP encoding)
// and sends 2-3 small variants. The server only validates and stores them.
import { json, HttpError } from '../../../../_lib/http.js';
import { requireSiteRole, randomId, audit } from '../../../../_lib/auth.js';
import { VARIANT_WIDTHS, MAX_VARIANT_BYTES, ALLOWED_VARIANT_TYPES, mediaKey, mediaBaseUrl, mediaRowToObject } from '../../../../_lib/media.js';

export async function onRequestGet({ request, env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const base = mediaBaseUrl(env, request);
  const { results } = await env.DB.prepare('SELECT * FROM media WHERE site_id = ? ORDER BY created_at DESC').bind(site.id).all();
  return json({ media: results.map((r) => mediaRowToObject(r, base)) });
}

export async function onRequestPost({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  const ct = request.headers.get('content-type') || '';
  if (!ct.startsWith('multipart/form-data')) throw new HttpError(415, 'Expected multipart/form-data');
  const form = await request.formData();

  const originalName = String(form.get('original_name') || 'image').slice(0, 200);
  const alt = String(form.get('alt') || '').slice(0, 300);
  const width = Math.max(0, parseInt(form.get('width'), 10) || 0);
  const height = Math.max(0, parseInt(form.get('height'), 10) || 0);
  const placeholder = String(form.get('placeholder') || '');
  if (placeholder && (!placeholder.startsWith('data:image/') || placeholder.length > 4000)) {
    throw new HttpError(400, 'Invalid placeholder');
  }

  // The browser may produce a smaller image than the slot (e.g. a 600px original in the 1200 slot).
  let actualWidths = {};
  try { actualWidths = JSON.parse(form.get('actual_widths') || '{}'); } catch { throw new HttpError(400, 'Invalid actual_widths'); }

  const files = [];
  const seenWidths = new Set();
  for (const slot of VARIANT_WIDTHS) {
    const f = form.get(`variant_${slot}`);
    if (!f || typeof f === 'string') continue;
    const w = parseInt(actualWidths[slot], 10) || slot;
    if (w < 1 || w > 8000) throw new HttpError(400, `Variant ${slot}: invalid width`);
    if (seenWidths.has(w)) throw new HttpError(400, `Variant ${slot}: duplicate width ${w}`);
    seenWidths.add(w);
    if (!ALLOWED_VARIANT_TYPES.includes(f.type)) throw new HttpError(400, `Variant ${w}: unsupported type ${f.type}. Only WebP or JPEG.`);
    if (f.size > MAX_VARIANT_BYTES) throw new HttpError(413, `Variant ${w} is too large`);
    if (f.size === 0) throw new HttpError(400, `Variant ${w} is empty`);
    files.push({ width: w, file: f });
  }
  if (files.length === 0) throw new HttpError(400, 'No image variants received');

  // Verify the bytes really are WebP/JPEG (magic numbers), not just the declared type.
  for (const { file, width: w } of files) {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    if (!isJpeg && !isWebp) throw new HttpError(400, `Variant ${w} is not a valid image file`);
  }

  const id = randomId();
  const variants = [];
  let total = 0;
  for (const { width: w, file } of files) {
    const ext = file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = mediaKey(site.slug, id, w, ext);
    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { site: site.slug, media: id, width: String(w) },
    });
    variants.push({ width: w, key, bytes: file.size, type: file.type });
    total += file.size;
  }
  await env.DB.prepare(
    'INSERT INTO media (id, site_id, original_name, alt, width, height, variants_json, placeholder, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, site.id, originalName, alt, width, height, JSON.stringify(variants), placeholder, total, user.id).run();
  await audit(env, { site_id: site.id, user, action: 'media.upload', target: originalName });

  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
  return json({ media: mediaRowToObject(row, mediaBaseUrl(env, request)) }, 201);
}
