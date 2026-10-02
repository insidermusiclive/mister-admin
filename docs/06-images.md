# 6. Photos: how the pipeline works and why it does not break

The usual way admin tools break with photos is that they upload the raw file (huge, HEIC,
rotated sideways) into a Git repository or a folder the website does not expect, and then
every image path on the site changes. Mister Admin avoids every one of those causes.

## What happens when you drop a photo in

All of this runs **in your browser**, in `public/lib/image.js`:

1. **Type check.** JPG, PNG, WebP, GIF, TIFF, AVIF, HEIC/HEIF accepted. Anything else is refused
   with a clear message. Max 60 MB / 80 megapixels.
2. **HEIC → JPEG.** iPhone photos are converted with the `heic2any` library, loaded on demand
   from a CDN only when needed.
3. **Rotation.** EXIF orientation is applied, so sideways phone photos come out upright.
4. **Resize.** Three versions: 480, 1200 and 2000 px wide (never upscaled; a 900 px original gives
   480 and 900). Step-down scaling keeps them sharp.
5. **Encode.** WebP at quality 0.82. Browsers that cannot encode WebP fall back to JPEG.
6. **Placeholder.** A 24 px blurred JPEG as a data URL for instant previews.
7. **Upload.** The 2–3 small files go to `POST /api/sites/:id/media` with a progress bar.
   Two uploads run in parallel. A typical 5 MB phone photo ends up as ~250–400 KB total.

The server (`functions/api/sites/[siteId]/media/index.js`):

8. Checks the role (editor+), content type, size (≤ 4 MB per variant) and **magic bytes**
   (the file really is WebP or JPEG).
9. Stores each file in R2 at `sites/<slug>/<mediaId>/<width>.webp` with immutable cache headers.
10. Writes one row in the `media` table (dimensions, alt, variant list, placeholder).

## Why image paths cannot break

- Content never stores a path. It stores `{ media_id, alt }`. URLs are generated at read time
  from the media table, so every page always gets the current, correct URL.
- Every upload has a new unique id. Nothing is ever overwritten, so caches never serve a wrong file.
- Photos live in R2, not in the website's repository, so a website rebuild never touches them.
- If you want to move photos to another domain, set one variable (`MEDIA_BASE_URL`) and
  every URL on every site updates. No content changes needed.

## Deleting

Deleting a photo that is still used in draft or published content is refused with the list of
sections using it. You can force it; those places then show no image (never a broken link).
Deleting a whole site removes its R2 files too.

## Limits

| | |
|---|---|
| Source file | ≤ 60 MB, ≤ 80 MP |
| Stored per photo | ≤ 3 variants, ≤ 4 MB each (real-world: 0.2–0.6 MB total) |
| R2 free tier | 10 GB ≈ 20 000+ photos |
| Gallery field | ≤ 200 photos |

## Browser support

Any current Chrome, Edge, Firefox, Safari (desktop and mobile). HEIC conversion needs internet
access to load the converter the first time. Very old browsers without `canvas.toBlob` cannot upload.
