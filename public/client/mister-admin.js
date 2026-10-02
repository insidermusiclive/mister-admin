/*!
 * Mister Admin site client v1.0
 * Include this on any static website to fill it with content from Mister Admin.
 *
 *   <script src="https://YOUR-ADMIN.pages.dev/client/mister-admin.js"
 *           data-admin="https://YOUR-ADMIN.pages.dev" data-site="my-site" defer></script>
 *
 * Then mark up your HTML:
 *   <h1 data-ma="hero.heading"></h1>                   text content
 *   <div data-ma-html="hero.text"></div>               markdown -> HTML
 *   <img data-ma-img="hero.image">                     src + srcset + alt
 *   <a data-ma="settings.phone" data-ma-attr="href" data-ma-prefix="tel:"></a>
 *   <ul data-ma-list="news"><li><h3 data-ma="title"></h3></li></ul>   repeats the first child per item
 *   <nav data-ma-menu="navigation"></nav>              renders a nested <ul> menu
 *   <section data-ma-if="news.0"> ... </section>       removed when the value is empty
 *
 * Or use it from JavaScript:
 *   const content = await MisterAdmin.load();  // { settings: {...}, news: [...] }
 */
(function () {
  'use strict';
  const script = document.currentScript;
  const cfg = {
    admin: (script && script.dataset.admin) || '',
    site: (script && script.dataset.site) || '',
    auto: !script || script.dataset.auto !== 'false',
  };
  let cache = null;

  function url() {
    if (!cfg.admin || !cfg.site) throw new Error('MisterAdmin: data-admin and data-site are required');
    return cfg.admin.replace(/\/+$/, '') + '/api/public/' + encodeURIComponent(cfg.site) + '/content';
  }

  async function load(opts) {
    if (opts) Object.assign(cfg, opts);
    if (cache) return cache;
    const res = await fetch(url(), { credentials: 'omit' });
    if (!res.ok) throw new Error('MisterAdmin: could not load content (' + res.status + ')');
    const data = await res.json();
    cache = data.collections || {};
    cache.__site = data.site;
    cache.__published_at = data.published_at;
    return cache;
  }

  function get(obj, path) {
    if (path === undefined || path === null || path === '') return obj;
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  // Minimal, safe Markdown: paragraphs, headings, bold, italic, links, lists, line breaks.
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+|tel:[^\s)]+)\)/g, '<a href="$2">$1</a>');
  }
  function markdown(md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    let html = '', para = [], list = null;
    const flush = () => { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } if (list) { html += '</' + list + '>'; list = null; } };
    for (const line of lines) {
      const t = line.trim();
      if (!t) { flush(); continue; }
      const hm = /^(#{1,4})\s+(.*)$/.exec(t);
      if (hm) { flush(); html += '<h' + hm[1].length + '>' + inline(hm[2]) + '</h' + hm[1].length + '>'; continue; }
      const li = /^[-*]\s+(.*)$/.exec(t); const oli = /^\d+[.)]\s+(.*)$/.exec(t);
      if (li || oli) {
        const kind = li ? 'ul' : 'ol';
        if (list !== kind) { if (para.length || list) flush(); html += '<' + kind + '>'; list = kind; }
        html += '<li>' + inline((li || oli)[1]) + '</li>'; continue;
      }
      if (list) flush();
      para.push(t);
    }
    flush();
    return html;
  }

  function setImage(img, value) {
    if (!value || !value.url) { img.removeAttribute('src'); img.removeAttribute('srcset'); img.alt = ''; img.hidden = true; return; }
    img.hidden = false;
    img.src = value.url;
    if (value.srcset) img.srcset = value.srcset;
    if (!img.getAttribute('sizes')) img.sizes = '100vw';
    img.alt = value.alt || '';
    if (value.width && value.height && !img.getAttribute('width')) { img.width = value.width; img.height = value.height; }
    if (value.placeholder && !img.style.backgroundImage) { img.style.backgroundImage = 'url(' + value.placeholder + ')'; img.style.backgroundSize = 'cover'; }
  }

  function renderMenu(items, depth) {
    const ul = document.createElement('ul');
    if (depth > 1) ul.className = 'ma-submenu';
    (items || []).forEach((it) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.url || '#'; a.textContent = it.label || '';
      if (it.url && location.pathname === it.url.replace(/\/$/, '') + '/' || location.pathname === it.url) a.className = 'active';
      li.appendChild(a);
      if (it.children && it.children.length) { li.className = 'has-children'; li.appendChild(renderMenu(it.children, depth + 1)); }
      ul.appendChild(li);
    });
    return ul;
  }

  // Each binding kind marks the element once it is bound, so list items bound with their
  // own item data are not overwritten by the outer pass. One element may carry several kinds.
  function each(root, selector, kind, fn) {
    root.querySelectorAll(selector).forEach((el) => {
      const done = (el.getAttribute('data-ma-done') || '').split(' ');
      if (done.indexOf(kind) !== -1) return;
      fn(el);
      el.setAttribute('data-ma-done', (done.concat(kind)).join(' ').trim());
    });
  }
  function bind(root, data) {
    each(root, '[data-ma-if]', 'if', (el) => {
      const v = get(data, el.dataset.maIf);
      const empty = v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
      if (empty) el.remove();
    });
    each(root, '[data-ma-list]', 'list', (el) => {
      const items = get(data, el.dataset.maList) || [];
      const tpl = el.firstElementChild;
      if (!tpl) return;
      el.removeChild(tpl);
      const filtered = (Array.isArray(items) ? items : []).filter((it) => !(el.dataset.maFilter && !get(it, el.dataset.maFilter)));
      filtered.forEach((it) => { const node = tpl.cloneNode(true); bindNode(node, it); el.appendChild(node); });
      if (!filtered.length && el.dataset.maEmpty) el.textContent = el.dataset.maEmpty;
    });
    each(root, '[data-ma-menu]', 'menu', (el) => { el.innerHTML = ''; el.appendChild(renderMenu(get(data, el.dataset.maMenu) || [], 1)); });
    each(root, '[data-ma]', 'text', (el) => {
      const v = get(data, el.dataset.ma);
      const text = v == null ? '' : (typeof v === 'object' ? (v.alt || '') : String(v));
      const attr = el.dataset.maAttr;
      if (attr) el.setAttribute(attr, (el.dataset.maPrefix || '') + text);
      else el.textContent = text;
    });
    each(root, '[data-ma-html]', 'html', (el) => { el.innerHTML = markdown(get(data, el.dataset.maHtml)); });
    each(root, '[data-ma-img]', 'img', (el) => {
      const v = get(data, el.dataset.maImg);
      if (el.tagName === 'IMG') setImage(el, v);
      else el.style.backgroundImage = v && v.url ? 'url(' + (v.src && v.src[2000] || v.url) + ')' : '';
    });
    if (root === document && data.settings && data.settings.title && !document.title) document.title = data.settings.title;
  }
  // Binds a cloned template node: the node itself may carry bindings, not only its children.
  function bindNode(node, item) {
    const frag = document.createElement('div');
    frag.appendChild(node);
    bind(frag, item);
    return node;
  }

  async function render(root) {
    const data = await load();
    bind(root || document, data);
    document.documentElement.classList.add('ma-ready');
    document.dispatchEvent(new CustomEvent('ma:ready', { detail: data }));
    return data;
  }

  window.MisterAdmin = { load, render, markdown, get, config: cfg };

  if (cfg.auto && cfg.admin && cfg.site) {
    const start = () => render().catch((e) => { console.error(e); document.documentElement.classList.add('ma-error'); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})();
