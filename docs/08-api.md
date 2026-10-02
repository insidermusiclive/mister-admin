# 8. API reference

Base: your admin URL. All responses are JSON. Errors look like `{ "error": "message", "details": [...] }`.

Every request that is not `GET` must send the header `X-Requested-With: MisterAdmin` (CSRF guard).
Authentication is a session cookie set by `/api/auth/login`.

## Public (no auth, CORS `*`)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/public/:slug/content` | `{ site, published_at, collections }` – published content, images resolved. Cached 60 s. |
| GET | `/media/sites/:slug/:mediaId/:width.webp` | the photo file (immutable) |

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/auth/setup` | | `{ needs_setup }` |
| POST | `/api/auth/setup` | `{ name, email, password }` | only while no users exist; creates admin + session |
| POST | `/api/auth/login` | `{ email, password }` | sets cookie; 429 after 8 failures |
| POST | `/api/auth/logout` | | |
| GET | `/api/auth/me` | | `{ user }` or `{ user: null }` |
| PUT | `/api/auth/password` | `{ current_password, new_password }` | |

## Users (administrator)

| Method | Path | Body |
|---|---|---|
| GET | `/api/users` | |
| POST | `/api/users` | `{ name, email, password, is_admin }` |
| PUT | `/api/users/:id` | `{ name, is_admin?, password? }` |
| DELETE | `/api/users/:id` | |

## Sites

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/api/sites` | any | sites the user can access, with `role` and `has_unpublished_changes` |
| POST | `/api/sites` | admin | `{ name, slug, url?, schema? }` |
| GET | `/api/sites/:id` | viewer | site with `schema`, `role`, publish state |
| PUT | `/api/sites/:id` | owner | `{ name?, url?, deploy_hook_url?, schema? }` |
| DELETE | `/api/sites/:id` | admin | deletes content, media files, memberships |
| GET | `/api/sites/:id/members` | viewer | |
| POST | `/api/sites/:id/members` | owner | `{ email, role }` – user must exist |
| DELETE | `/api/sites/:id/members/:userId` | owner | |
| GET | `/api/sites/:id/audit` | viewer | last 200 history entries |
| GET | `/api/sites/:id/export` | viewer | backup JSON (`format: mister-admin-export/1`) |
| POST | `/api/sites/:id/import` | owner | a backup JSON; replaces schema + draft content |
| POST | `/api/sites/:id/publish` | editor | copies draft → published, clears public cache |
| POST | `/api/sites/:id/deploy` | editor | calls the site's Cloudflare deploy hook |

## Content (draft)

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/api/sites/:id/content` | viewer | all collections, images resolved |
| GET | `/api/sites/:id/content/:collection` | viewer | `{ schema, data, updated_at }` |
| PUT | `/api/sites/:id/content/:collection` | editor | `{ data }` – whole collection; validated; 400 with `details[]` on problems |

## Media

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/api/sites/:id/media` | viewer | |
| POST | `/api/sites/:id/media` | editor | multipart: `original_name`, `alt`, `width`, `height`, `placeholder`, `actual_widths` (JSON), `variant_480`, `variant_1200`, `variant_2000` (WebP/JPEG files) |
| PUT | `/api/sites/:id/media/:mediaId` | editor | `{ alt }` |
| DELETE | `/api/sites/:id/media/:mediaId[?force=1]` | editor | 409 with `details.in_use` if referenced and not forced |

## Example: fetch content from a website build

```js
const r = await fetch('https://admin.example.com/api/public/my-site/content');
const { collections } = await r.json();
console.log(collections.settings.title, collections.events.length);
```
