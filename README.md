# Mister Admin

**A simple, reliable admin panel for static websites hosted on Cloudflare Pages.**
One Mister Admin can manage many websites, with separate logins for each person.
No AI, no build step, no framework. Runs entirely on Cloudflare's free tier.

```
  ┌──────────────┐      edits       ┌──────────────────┐      reads JSON      ┌──────────────┐
  │  Your wife   │ ───────────────▶ │                  │ ◀─────────────────── │  Website A   │
  │  Your son    │  (browser login) │   Mister Admin   │                      │  Website B   │
  │  You         │                  │  Pages+D1+R2     │ ───────────────────▶ │  Website C   │
  └──────────────┘                  └──────────────────┘   serves photos      └──────────────┘
```

## What it does

- **Edit text, menus, lists and photos** of any number of static websites from one place.
- **Photos just work.** Every photo is converted in the browser *before* upload:
  iPhone HEIC → JPEG, rotation fixed, resized to 480/1200/2000 px, encoded as WebP.
  A 6 MB phone photo becomes ~300 KB of web-ready files. Originals never hit the server.
- **Multi-user, multi-site.** Administrators create accounts. Each site has owners,
  editors and viewers. Your family can log in and change their own sites.
- **Draft → Publish.** Edits are saved as drafts. The website only changes when you press
  **Publish**, so half-finished work never goes live.
- **Schema-driven.** Each website declares its own structure (sections, fields, menu)
  in a small JSON schema. Mister Admin builds the editing screens from it.
  A different website = a different schema, same app.
- **Safe by design.** Server-side validation of every field, images can only reference
  photos that exist, deleting a photo in use is refused, every action is logged,
  one-click JSON backup and restore.
- **Free.** Cloudflare Pages + Functions + D1 + R2, all inside the free tier for
  normal small-business use. See [docs/09-costs-and-limits.md](docs/09-costs-and-limits.md).

## How a website uses it

A website stays 100% static. It just includes one script and marks up its HTML:

```html
<h1 data-ma="hero.heading"></h1>
<img data-ma-img="hero.image">
<nav data-ma-menu="navigation"></nav>
<script src="https://YOUR-ADMIN.pages.dev/client/mister-admin.js"
        data-admin="https://YOUR-ADMIN.pages.dev" data-site="my-site" defer></script>
```

Sites that prefer to bake content in at build time can call the public JSON endpoint
and use a Cloudflare deploy hook instead. Both are explained in
[docs/05-connecting-a-site.md](docs/05-connecting-a-site.md).

## Documentation

| Doc | What it covers |
|---|---|
| [01-overview.md](docs/01-overview.md) | Concepts: sites, schema, collections, draft/publish, roles |
| [02-architecture.md](docs/02-architecture.md) | How the pieces fit: Pages, Functions, D1, R2, caching |
| [03-setup-cloudflare.md](docs/03-setup-cloudflare.md) | **Step-by-step installation** (about 15 minutes) |
| [04-schema-format.md](docs/04-schema-format.md) | Every field type and collection type, with examples |
| [05-connecting-a-site.md](docs/05-connecting-a-site.md) | Putting Mister Admin content on a website |
| [06-images.md](docs/06-images.md) | The photo pipeline and why photos cannot "break" |
| [07-users-and-roles.md](docs/07-users-and-roles.md) | Giving family / clients access |
| [08-api.md](docs/08-api.md) | Every API endpoint |
| [09-costs-and-limits.md](docs/09-costs-and-limits.md) | Free-tier numbers and hard limits |
| [10-troubleshooting.md](docs/10-troubleshooting.md) | When something does not work |

## Quick start (local, no Cloudflare account needed)

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open http://localhost:8788, create the first administrator, create a site, and start editing.
Open `examples/demo-site/index.html` in a browser to see a website pulling the content.

## Project layout

```
public/            the admin web app (static files, no build step)
  app.js           router + screens
  lib/             api, forms, editors, media library, image pipeline
  client/          copy of site-client/mister-admin.js served to websites
functions/         Cloudflare Pages Functions (the API)
  _lib/            auth, schema validation, media helpers
  api/             routes (file-based routing)
  media/           serves photos from R2
migrations/        D1 database schema
site-client/       the script websites include
examples/          an example schema and a demo website
docs/              documentation
test/              unit tests (node --test)
```

## License

MIT. Do whatever you want with it.
