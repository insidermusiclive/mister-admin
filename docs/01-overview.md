# 1. Overview and concepts

Mister Admin is a **content admin**. It does not generate your website and it does not
host it. Your website stays a normal static site on Cloudflare Pages (or anywhere else).
Mister Admin stores the *content* (texts, menu, photos, lists) and hands it to the website.

## The main ideas

### Site
One website you want to manage. Each site has:
- a **name** (shown in the admin),
- a **slug** (short id used in the public URL, e.g. `my-bakery`),
- a **schema** (what can be edited),
- **content**, **photos**, and **people** who can access it.

One Mister Admin manages as many sites as you like.

### Schema
The schema is the contract between Mister Admin and a website. It lists the
**collections** (sections) of the site and the **fields** in each. The admin builds its
editing screens from it. You create it by picking a template when adding a website and
by using the visual "Sections" editor in Settings; no code involved. Since every site has its own schema, every site gets its own admin
screens without any code change. Full reference: [04-schema-format.md](04-schema-format.md).

### Collection
A section of content. Three kinds:

| Type | What it is | Example |
|---|---|---|
| `single` | one set of fields | Site settings, home page banner |
| `list` | an ordered list of items, each with the same fields | News, events, products, team |
| `tree` | a nested list (up to 3 levels) | The navigation menu |

### Field
One editable value inside a collection. Field types: `text`, `textarea`, `markdown`,
`number`, `boolean`, `date`, `link`, `select`, `color`, `image`, `gallery`.

### Draft and Publish
Every save goes to the **draft**. The website only ever reads the **published** version.
When editors are happy they press **Publish** and the whole site goes live at once.
The admin shows "Unpublished changes" until you do.

### Photos
Photos are uploaded once into the site's photo library and then *referenced* from fields.
A photo is never copied into content. Deleting a photo still in use is refused
(you can force it, in which case those places show no image).
Details: [06-images.md](06-images.md).

### People and roles
- **Administrator** (account flag): manages users and all sites.
- **Owner** (per site): settings, schema, people, plus everything an editor can do.
- **Editor** (per site): edit content, upload photos, publish.
- **Viewer** (per site): look but not touch.
Details: [07-users-and-roles.md](07-users-and-roles.md).

### History
Every login, save, upload, publish and setting change is recorded per site with who did it.

### Backup
Settings → Backup downloads a JSON file with the schema, content and photo index.
The same screen restores one. Photo files themselves live in R2 and are not in the JSON
(they are referenced by id).

## What Mister Admin deliberately does not do

- It does not edit HTML or CSS. Layout stays in the website's code, where it is safe.
- It does not use AI.
- It does not deploy websites. (It can *trigger* a Cloudflare deploy hook if a site needs a rebuild.)
- It does not store photo originals. Only the web-sized versions.
