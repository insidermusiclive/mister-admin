# 2. Architecture

Everything runs on Cloudflare. There is no server to maintain.

```
Browser (admin user)
   │  HTTPS, session cookie
   ▼
Cloudflare Pages  ── static files: public/ (the admin UI)
   │
   ├─ Pages Functions (functions/)  ── the API, runs on Workers
   │       │
   │       ├─ D1 (SQLite)  ── users, sessions, sites, schema, content, published, media index, audit log
   │       └─ R2 (object storage) ── the photo files
   │
   └─ /api/public/<slug>/content  ── read-only JSON for websites (cached at the edge, no auth)

Website (static, anywhere)
   └─ <script src=…/client/mister-admin.js>  ── fetches the JSON and fills the page
```

## Request flow

1. `functions/_middleware.js` runs on every API request. It loads the session user from the
   cookie, enforces a CSRF header on all non-GET requests, adds CORS headers only for the
   public endpoints, and turns thrown `HttpError`s into JSON responses.
2. Route files under `functions/api/` handle one URL each (Pages file-based routing,
   `[param]` folders are URL parameters).
3. `functions/_lib/auth.js` provides `requireUser`, `requireAdmin` and `requireSiteRole`.
   Every site route calls `requireSiteRole(env, data, siteId, 'editor')` (or `owner`/`viewer`)
   which loads the site and checks membership in one go.
4. Content writes go through `functions/_lib/schema.js → validateCollectionData`, which
   strips unknown fields, enforces types, required fields, select options, number ranges,
   date format and that every image reference points to an existing photo of that site.

## Storage model

- **Draft content**: table `content`, one row per (site, collection), the whole collection as JSON.
  Saving replaces the row atomically. Simple and impossible to half-save.
- **Published content**: table `published`, same shape. `POST /publish` copies every draft row
  in one D1 batch (transaction).
- **Photos**: table `media` holds the index (dimensions, alt text, variants). Files are in R2 at
  `sites/<slug>/<mediaId>/<width>.webp`. Keys are unique per upload, so they are served with
  `immutable` cache headers and never go stale.
- Content stores images as `{ media_id, alt }` only. URLs are resolved on read. If you ever
  move the bucket to a custom domain, set `MEDIA_BASE_URL` and every URL changes at once.

## Caching

- Public content JSON: `Cache-Control: max-age=60` plus the Workers Cache API. Publishing deletes
  the cached entry, so the website sees the new content within seconds (max 60 s on a cold edge).
- Photos: `max-age=31536000, immutable`, also cached via the Cache API.
- Admin API: `no-store`.

## Security

- Passwords: PBKDF2-SHA256, 100 000 iterations, random 16-byte salt, constant-time compare.
- Sessions: random 256-bit id in an `HttpOnly; Secure; SameSite=Lax` cookie, 30 days, stored in D1.
- CSRF: every mutating request must carry `X-Requested-With: MisterAdmin` (browsers do not let
  cross-site forms set custom headers).
- Login rate limit: 8 failures per email+IP per 15 minutes.
- Uploads: only WebP/JPEG variants, verified by magic bytes, max 4 MB each.
- Deploy hook URLs must be Cloudflare Pages hook URLs (no SSRF to arbitrary hosts).
- Headers: `X-Frame-Options: DENY`, `nosniff`, no indexing.
- Public endpoint exposes only published content of a site by slug. Nothing else is public.

## Why no framework and no build step

The admin UI is plain ES modules served as-is. There is nothing to compile, no dependency
that can break next year, and `wrangler pages deploy public` is the entire deployment.
The code is small enough to read in an afternoon.
