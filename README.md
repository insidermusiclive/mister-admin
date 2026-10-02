# Mister Admin

**A simple, reliable admin panel for static websites hosted on Cloudflare Pages.**
Everyone installs their own copy in their own Cloudflare account, in one click or by
double-clicking an installer. No AI, no build step, no framework, no monthly cost.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/insidermusiclive/mister-admin)

## Install (pick one)

| Way | For whom | What happens |
|---|---|---|
| **Button above** | anyone with a Cloudflare and GitHub account | Cloudflare copies the repo, creates the database and photo storage, deploys. About 3 minutes. |
| **Zip + installer** | anyone with a Cloudflare account, no GitHub needed | Download the zip from [Releases](https://github.com/insidermusiclive/mister-admin/releases), unzip, double-click `install/install-mac.command` or `install/install-windows.bat`. Needs [Node.js](https://nodejs.org). |
| **Command line** | developers | `npm install && npx wrangler login && node install/install.mjs` |

Then open your new address, create your administrator account on the Welcome screen, and start.
Full details: [docs/03-setup-cloudflare.md](docs/03-setup-cloudflare.md).

```
  Your Cloudflare account              Your wife's Cloudflare account
  ┌──────────────────────┐             ┌──────────────────────┐
  │ Mister Admin (yours) │             │ Mister Admin (hers)  │
  │  Worker + D1 + R2    │             │  Worker + D1 + R2    │
  └─────────┬────────────┘             └─────────┬────────────┘
            │ reads JSON + photos                │
  ┌─────────┴────────────┐             ┌─────────┴────────────┐
  │ your website(s)      │             │ her website(s)       │
  └──────────────────────┘             └──────────────────────┘
```
Each installation is completely independent: its own login, data and photos.

## What it does

- **Edit text, menus, lists and photos** of any number of static websites from one place.
- **Photos just work.** Every photo is converted in the browser *before* upload:
  iPhone HEIC → JPEG, rotation fixed, resized to 480/1200/2000 px, encoded as WebP.
  A 6 MB phone photo becomes ~300 KB of web-ready files. Originals never hit the server.
- **Your own instance.** Installed in your own Cloudflare account; nobody else has access.
  Inside it you can still manage several websites and invite extra people with roles if you want.
- **Draft → Publish.** Edits are saved as drafts. The website only changes when you press
  **Publish**, so half-finished work never goes live.
- **Schema-driven.** Each website declares its own structure (sections, fields, menu)
  in a small JSON schema. Mister Admin builds the editing screens from it.
  A different website = a different schema, same app.
- **Safe by design.** Server-side validation of every field, images can only reference
  photos that exist, deleting a photo in use is refused, every action is logged,
  one-click JSON backup and restore.
- **Free.** Cloudflare Workers + D1 + R2, all inside the free tier for normal small-business use. See [docs/09-costs-and-limits.md](docs/09-costs-and-limits.md).

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

## Run locally (developers, no Cloudflare account needed)

```bash
npm install
npm run dev
```

Open http://localhost:8788. The database tables are created automatically on first use.
Open `examples/demo-site/index.html` in a browser to see a website pulling the content.

## Project layout

```
src/worker.js      Cloudflare Worker entry: static assets, API router, first-run database setup
public/            the admin web app (static files, no build step)
  app.js           router + screens
  lib/             api, forms, editors, media library, image pipeline
  client/          copy of site-client/mister-admin.js served to websites
functions/         the API route handlers
  _lib/            auth, schema validation, media helpers
  api/             one file per route
  media/           serves photos from R2
install/           double-click installers (Mac, Windows) and the Node installer script
migrations/        D1 database schema (applied automatically by the Worker)
site-client/       the script websites include
examples/          an example schema and a demo website
docs/              documentation
test/              unit tests (node --test)
```

## License

MIT. Do whatever you want with it.
