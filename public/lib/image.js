// Client-side image pipeline. Everything happens in the browser BEFORE upload:
//   1. HEIC/HEIF (iPhone) -> JPEG using heic2any (loaded on demand)
//   2. EXIF rotation applied
//   3. Resized to 480 / 1200 / 2000 px wide (never upscaled)
//   4. Encoded as WebP (JPEG fallback on browsers that cannot encode WebP)
//   5. A tiny blurred placeholder is generated for fast page loads
// The server receives only small, web-ready files. Originals never leave the browser.

export const VARIANT_WIDTHS = [480, 1200, 2000];
const MAX_SOURCE_BYTES = 60 * 1024 * 1024; // refuse absurdly large files
const MAX_SOURCE_PIXELS = 80 * 1024 * 1024; // ~80 megapixels
const HEIC_LIB = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

export function isSupportedImage(file) {
  if (isHeic(file)) return true;
  return /^image\/(jpeg|png|webp|gif|bmp|tiff|avif)$/.test(file.type);
}

function isHeic(file) {
  return /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

let heicLoader = null;
function loadHeicLib() {
  if (window.heic2any) return Promise.resolve();
  if (!heicLoader) {
    heicLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HEIC_LIB;
      s.onload = resolve;
      s.onerror = () => { heicLoader = null; reject(new Error('Could not load the HEIC converter. Check your internet connection.')); };
      document.head.append(s);
    });
  }
  return heicLoader;
}

async function toBitmap(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback: <img> element (browsers apply EXIF orientation automatically here)
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image')); };
      img.src = url;
    });
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

let webpSupported = null;
async function supportsWebp() {
  if (webpSupported !== null) return webpSupported;
  const c = document.createElement('canvas');
  c.width = 2; c.height = 2;
  const b = await canvasToBlob(c, 'image/webp', 0.8);
  webpSupported = !!b && b.type === 'image/webp';
  return webpSupported;
}

/**
 * Processes one file. Returns { variants: [{slot, width, height, blob, type}], width, height, placeholder }.
 * `onStatus(text)` is called with human-readable progress.
 */
export async function processImage(file, { quality = 0.82, onStatus = () => {} } = {}) {
  if (!isSupportedImage(file)) throw new Error(`"${file.name}" is not a supported image (use JPG, PNG, WebP, HEIC, GIF, TIFF or AVIF)`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`"${file.name}" is too large (max 60 MB)`);

  let source = file;
  if (isHeic(file)) {
    onStatus('Converting iPhone photo…');
    await loadHeicLib();
    try {
      source = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
      if (Array.isArray(source)) source = source[0];
    } catch (e) {
      throw new Error(`"${file.name}" could not be converted from HEIC (${e?.message || 'unknown error'})`);
    }
  }

  onStatus('Reading image…');
  const bitmap = await toBitmap(source);
  const origW = bitmap.width || bitmap.naturalWidth;
  const origH = bitmap.height || bitmap.naturalHeight;
  if (!origW || !origH) throw new Error(`"${file.name}" has no readable dimensions`);
  if (origW * origH > MAX_SOURCE_PIXELS) throw new Error(`"${file.name}" has too many pixels`);

  const useWebp = await supportsWebp();
  const type = useWebp ? 'image/webp' : 'image/jpeg';

  const variants = [];
  const produced = new Set();
  for (const slot of VARIANT_WIDTHS) {
    const w = Math.min(slot, origW);
    if (produced.has(w)) continue; // small originals: do not upscale, do not duplicate
    produced.add(w);
    onStatus(`Resizing to ${w}px…`);
    const hgt = Math.max(1, Math.round((origH * w) / origW));
    const blob = await drawScaled(bitmap, w, hgt, type, quality);
    if (!blob) throw new Error('Image encoding failed in this browser');
    variants.push({ slot, width: w, height: hgt, blob, type: blob.type });
  }

  onStatus('Creating placeholder…');
  const ph = await drawScaled(bitmap, 24, Math.max(1, Math.round((origH * 24) / origW)), 'image/jpeg', 0.5);
  const placeholder = ph ? await blobToDataUrl(ph) : '';

  if (bitmap.close) bitmap.close();
  return { variants, width: origW, height: origH, placeholder, originalName: file.name };
}

async function drawScaled(bitmap, w, hgt, type, quality) {
  // Step-down scaling for better quality on big reductions.
  let srcW = bitmap.width || bitmap.naturalWidth;
  let srcH = bitmap.height || bitmap.naturalHeight;
  let src = bitmap;
  while (srcW / 2 > w) {
    const c = document.createElement('canvas');
    c.width = Math.round(srcW / 2); c.height = Math.round(srcH / 2);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c; srcW = c.width; srcH = c.height;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, hgt); } // JPEG has no transparency
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, hgt);
  return canvasToBlob(canvas, type, quality);
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve('');
    r.readAsDataURL(blob);
  });
}

/** Builds the multipart body the server expects. */
export function buildUploadForm(processed, alt = '') {
  const fd = new FormData();
  fd.set('original_name', processed.originalName);
  fd.set('alt', alt);
  fd.set('width', String(processed.width));
  fd.set('height', String(processed.height));
  fd.set('placeholder', processed.placeholder);
  const actual = {};
  for (const v of processed.variants) {
    const ext = v.type === 'image/webp' ? 'webp' : 'jpg';
    fd.set(`variant_${v.slot}`, v.blob, `${v.width}.${ext}`);
    actual[v.slot] = v.width;
  }
  fd.set('actual_widths', JSON.stringify(actual));
  return fd;
}
