# 5. Connecting a website

A website gets its content from one URL:

```
https://YOUR-ADMIN.pages.dev/api/public/<slug>/content
```

It returns the **published** content, with every image resolved to full URLs.
It is public, read-only, CORS-enabled and cached for 60 seconds.

There are two ways to use it.

## Option A – fill the page in the browser (recommended, no build step)

Add the client script at the end of your HTML and mark up elements with `data-ma-*` attributes.

```html
<script src="https://YOUR-ADMIN.pages.dev/client/mister-admin.js"
        data-admin="https://YOUR-ADMIN.pages.dev" data-site="my-site" defer></script>
```

| Attribute | What it does |
|---|---|
| `data-ma="settings.title"` | sets the element's text |
| `data-ma="settings.phone" data-ma-attr="href" data-ma-prefix="tel:"` | sets an attribute instead of text |
| `data-ma-html="hero.text"` | renders Markdown (headings, bold, italic, links, lists) |
| `data-ma-img="hero.image"` | on `<img>`: sets `src`, `srcset`, `alt`, `width`, `height`; on other elements: background image |
| `data-ma-list="events"` | repeats its first child element once per item; inside, paths are relative to the item (`data-ma="name"`) |
| `data-ma-filter="published"` | on a list: only items where that field is truthy |
| `data-ma-empty="No events yet"` | on a list: text shown when empty |
| `data-ma-menu="navigation"` | renders a nested `<ul>` menu from a tree collection |
| `data-ma-if="hero.button_label"` | removes the element when the value is empty |
| `data-ma-unless="events.0"` | removes the element when the value is NOT empty (for "nothing published yet" placeholders) |

Text that is already in the HTML stays as the default when the value in Mister Admin is empty.

## Shipping the sections with the website

Put a `mister-admin.json` file in the website (a schema, optionally with starting `content`, in the
export format). When someone adds the website in Mister Admin they choose **From a file** and pick it:
sections and starting texts are set up in one go. Keep that file next to the HTML so the website and
its sections stay in sync.

A full working page is in [`examples/demo-site/index.html`](../examples/demo-site/index.html).

Use it from JavaScript as well:

```js
document.addEventListener('ma:ready', (e) => {
  const content = e.detail;              // { settings: {...}, events: [...], ... }
  document.documentElement.style.setProperty('--accent', content.settings.accent_color);
});
// or without the auto-binding:  const content = await MisterAdmin.load({ admin: '…', site: 'my-site' });
```

Pros: changes appear on the site within a minute of pressing Publish, no rebuild, works on
any host. Cons: content is filled after the page loads (set `html:not(.ma-ready)` styles to
avoid a flash), and search engines see the content only after running JavaScript
(Google does, most others do too).

## Option B – bake the content in at build time

If your site is built with a generator (Astro, Eleventy, Hugo, Next, …) fetch the JSON during the
build:

```js
const res = await fetch('https://YOUR-ADMIN.pages.dev/api/public/my-site/content');
const { collections } = await res.json();
```

Then create a **deploy hook** for the website in Cloudflare Pages (project → Settings →
Builds & deployments → Deploy hooks) and paste it into Mister Admin → site → Settings.
Pressing **Publish** will then also rebuild the website.

Pros: fully static HTML, perfect SEO. Cons: a rebuild takes about a minute, and uses one of
the 500 free builds per month.

## Mixing both

Common pattern: bake the page at build time (Option B) *and* include the script (Option A).
Visitors always get finished HTML, and small text fixes still show up without waiting for a build.

## Photos on the website

Use `<img data-ma-img="…" sizes="…">`. The script fills `srcset`, so the browser downloads the
480, 1200 or 2000 px version depending on screen size. Set `sizes` to the width the image
occupies (e.g. `sizes="(max-width: 600px) 100vw, 600px"`). Everything is WebP and already
compressed; nothing else to do.
