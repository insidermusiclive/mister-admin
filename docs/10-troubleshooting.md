# 10. Troubleshooting

**"Server is not configured: D1 (DB) and R2 (MEDIA) bindings are required"**
The Pages project has no bindings. Dashboard → Workers & Pages → mister-admin → Settings →
Bindings → add D1 `DB` and R2 `MEDIA`. Or redeploy from the CLI after fixing `wrangler.toml`.

**Internal server error on first visit / "no such table"**
Migrations were not applied. Run `npm run db:migrate:remote` (or `:local` for dev).

**The Welcome screen does not appear, login fails, and I have no account**
Someone already created the first admin. Ask them, or reset: delete and recreate the D1 database
(`wrangler d1 delete mister-admin`, then redo setup).

**Photos upload but do not show on the website**
- Press **Publish**; the website reads published content only.
- Check the browser console on the website for a 404 on `/api/public/<slug>/content`:
  the slug in the script tag must match the site slug.
- If `MEDIA_BASE_URL` is set, the custom domain on the R2 bucket must be active.

**HEIC photo fails with "Could not load the HEIC converter"**
The browser could not reach cdn.jsdelivr.net. Check the internet connection or an ad blocker.
Alternative: on iPhone, Settings → Camera → Formats → Most Compatible saves JPEG instead.

**Upload says "Variant … is not a valid image file"**
The browser produced something unexpected. Try a different browser; report the browser version.

**"Missing request header"**
A request without `X-Requested-With: MisterAdmin`. The admin UI always sends it; if you are
scripting the API, add the header.

**"Too many failed logins"**
Wait 15 minutes or sign in from another network. The limit is per email + IP.

**Website shows old content for a minute after Publish**
Expected: the public JSON is cached 60 s at the edge. Publish clears the cache on the edge that
served the publish request; other edges expire within 60 s.

**Schema save fails**
The error message names the exact collection/field. Common: a field named `id` or `children`
(reserved), uppercase letters, a `select` without `options`.

**Local dev: `npm run dev` says it cannot find the D1 database**
Run `npm run db:migrate:local` first; it creates the local database in `.wrangler/state`.

**I deleted a photo that was in use**
Those fields now show no image. Pick a new photo in the editor and save.

## Getting the logs

Dashboard → Workers & Pages → mister-admin → Logs (real-time) shows every API error with its stack.
