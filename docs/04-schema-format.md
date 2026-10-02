# 4. Schema format

The schema tells Mister Admin what a website can edit. It is a JSON object stored per site.
Edit it in the admin under **Settings → Schema**, or send it with the API.

```json
{
  "collections": {
    "settings":   { "label": "Site settings", "type": "single", "fields": [ ... ] },
    "navigation": { "label": "Menu",          "type": "tree",   "titleField": "label", "fields": [ ... ] },
    "events":     { "label": "Events",        "type": "list",   "titleField": "name",  "fields": [ ... ] }
  }
}
```

A complete example is in [`examples/site.schema.json`](../examples/site.schema.json).

## Collections

| Key | Required | Meaning |
|---|---|---|
| `type` | no (default `single`) | `single`, `list` or `tree` |
| `label` | no | Name shown in the admin sidebar |
| `help` | no | One line of guidance shown above the editor |
| `fields` | yes | Array of field definitions (1–60) |
| `titleField` | no | For `list`/`tree`: which field is shown as the item title (default: first field) |

Collection names: lowercase letters, numbers, underscores, max 40 chars, must start with a letter.
They are the keys your website uses (`data-ma="settings.title"`).

## Fields

Every field has `name`, `type`, and optionally `label`, `help`, `required`.
Field names follow the same rule as collection names. `id` and `children` are reserved.

| Type | Stored as | Editor | Extra options |
|---|---|---|---|
| `text` | string, single line | text box | `maxLength` (default 500) |
| `textarea` | string, multi-line | text area | `maxLength` (default 20000) |
| `markdown` | string | text area with Markdown hint | `maxLength` |
| `number` | number or null | number box | `min`, `max` |
| `boolean` | true/false | checkbox | |
| `date` | `"YYYY-MM-DD"` | date picker | |
| `link` | string | text box (`https://…` or `/page`) | |
| `select` | one of the options | drop-down | `options` (required, array of strings) |
| `color` | `"#rrggbb"` | colour picker | |
| `image` | image object or null | photo picker + alt text | |
| `gallery` | array of image objects | multi photo picker with ordering | |

### Image objects (what the website receives)

```json
{
  "media_id": "6f1c…",
  "alt": "Our shop front",
  "width": 4032, "height": 3024,
  "url": "https://…/sites/my-site/6f1c…/2000.webp",
  "src": { "480": "https://…/480.webp", "1200": "https://…/1200.webp", "2000": "https://…/2000.webp" },
  "srcset": "https://…/480.webp 480w, https://…/1200.webp 1200w, https://…/2000.webp 2000w",
  "placeholder": "data:image/jpeg;base64,…"
}
```

`url` is always the largest size. `placeholder` is a tiny blurred preview.

## Shapes of the three collection types

**single** → one object:
```json
{ "title": "My Bakery", "logo": { …image… } }
```

**list** → array of items, each with an `id`:
```json
[ { "id": "a1", "name": "Summer concert", "date": "2026-07-14", "published": true }, … ]
```

**tree** → array of items with `children` (max 3 levels):
```json
[
  { "id": "n1", "label": "Home", "url": "/", "children": [] },
  { "id": "n2", "label": "Shop", "url": "/shop", "children": [
      { "id": "n3", "label": "Bread", "url": "/shop/bread", "children": [] } ] }
]
```

## Validation rules (enforced on every save)

- Unknown fields are dropped. Required fields must be filled.
- `select` values must be in `options`; `number` must be within `min`/`max`;
  `date` must be a real date; `color` must be `#rrggbb`; `link` may not start with `javascript:`.
- Image references must point to a photo that exists in this site's library.
- A list or tree may hold at most 2000 items. A collection may not exceed ~900 KB.
- When validation fails nothing is saved and the admin shows every problem.

## Changing a schema later

- **Adding** a field or collection is always safe. Existing content gets the empty value.
- **Renaming** a field is the same as removing it and adding a new one: the old content
  stays in the database but is no longer shown or published. Rename in the website too.
- **Removing** a collection hides and stops publishing its content.
- Mister Admin asks for confirmation before saving a schema.

Tip: keep the schema in your website's repository as `site.schema.json` next to the HTML,
so the website code and its schema are versioned together.
