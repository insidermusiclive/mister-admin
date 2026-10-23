/*!
 * Mister Admin site client v1.1
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
 *   <section data-ma-unless="news.0"> ... </section>   removed when the value is NOT empty (placeholders)
 *   <div data-ma-promos="promotions"></div>            ready-made offer cards (old price -> new price, dates, button)
 * Text already in the HTML stays as the default when the admin value is empty.
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
    locale: (script && script.dataset.locale) || '',
    currency: (script && script.dataset.currency) || '',
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

  // ---- Promotions -------------------------------------------------------------------------
  // <div data-ma-promos="promotions"> draws the offers of a "Promotions" section (see the ready-made
  // section in the admin). Options (all optional) on the element:
  //   data-ma-promos-show="running|all"   running (default): published and inside its dates
  //   data-ma-promos-variant="cards|feature"   feature = only the first offer, large, no card
  //   data-ma-promos-limit="3"            data-ma-locale="fr-BE"   data-ma-currency="EUR"
  //   data-ma-empty="No offer right now"  (without it, whatever the HTML says stays)
  // Colours and fonts follow the website: set --ma-accent, --ma-accent-text, --ma-soft,
  // --ma-border, --ma-muted, --ma-display on .ma-promos (or any parent).
  const PROMO_LABELS = {
    en: { duration: 'Duration', valid: 'Valid', from: 'From', to: 'to', until: 'Until', details: 'Details and conditions', book: 'Book now', was: 'instead of', now: 'Offer price' },
    fr: { duration: 'Durée', valid: 'Valable', from: 'Du', to: 'au', until: 'Jusqu’au', details: 'Détails et conditions', book: 'Réserver', was: 'au lieu de', now: 'Prix promo' },
    nl: { duration: 'Duur', valid: 'Geldig', from: 'Van', to: 'tot', until: 'Tot', details: 'Details en voorwaarden', book: 'Reserveer', was: 'in plaats van', now: 'Actieprijs' },
  };
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** Published, started (if it has a start date) and not ended (if it has an end date). */
  function isRunning(item, today) {
    today = today || todayISO();
    if (!item || !item.published) return false;
    if (item.start_date && item.start_date > today) return false;
    if (item.end_date && item.end_date < today) return false;
    return true;
  }
  function formatMoney(v, locale, currency) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '';
    const n = Number(v);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
    } catch (e) { return n + ' ' + (currency || 'EUR'); }
  }
  function formatDay(iso, locale) {
    try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso + 'T00:00:00')); } catch (e) { return iso; }
  }
  /** Everything the card needs, as plain text (HTML-escaped later). */
  function promoModel(item, opts) {
    opts = opts || {};
    const locale = opts.locale || 'en';
    const L = Object.assign({}, PROMO_LABELS[String(locale).slice(0, 2)] || PROMO_LABELS.en, opts.labels || {});
    const price = item.price, was = item.old_price;
    let badge = String(item.discount_label || '').trim();
    if (!badge && was > 0 && price !== null && price !== undefined && price !== '' && Number(price) < was) badge = '-' + Math.round((1 - Number(price) / was) * 100) + '%';
    let validity = '';
    if (item.start_date && item.end_date) validity = L.from + ' ' + formatDay(item.start_date, locale) + ' ' + L.to + ' ' + formatDay(item.end_date, locale);
    else if (item.end_date) validity = L.until + ' ' + formatDay(item.end_date, locale);
    else if (item.start_date) validity = L.from + ' ' + formatDay(item.start_date, locale);
    return {
      labels: L,
      title: item.title || '',
      intro: item.intro || '',
      conditions: item.conditions || '',
      price: formatMoney(price, locale, opts.currency),
      oldPrice: formatMoney(was, locale, opts.currency),
      badge,
      duration: item.duration || '',
      validity,
      photo: item.photo && item.photo.url ? item.photo : null,
      buttonLabel: item.button_url ? (item.button_label || L.book) : '',
      buttonUrl: item.button_url || '',
    };
  }
  function promoHTML(item, opts) {
    const m = promoModel(item, opts);
    const L = m.labels;
    const feature = opts.variant === 'feature';
    const priceBlock = (m.price || m.badge)
      ? '<p class="ma-promo__price">'
        + (m.price ? '<span class="ma-promo__now"><span class="ma-promo__sr">' + esc(L.now) + ' : </span>' + esc(m.price) + '</span>' : '')
        + (m.price && m.oldPrice ? '<s class="ma-promo__was"><span class="ma-promo__sr">' + esc(L.was) + ' </span>' + esc(m.oldPrice) + '</s>' : '')
        + (m.badge && (m.price || true) ? (m.price ? '<span class="ma-promo__badge">' + esc(m.badge) + '</span>' : '<span class="ma-promo__now">' + esc(m.badge) + '</span>') : '')
        + '</p>'
      : '';
    const facts = (m.duration || m.validity)
      ? '<ul class="ma-promo__facts">'
        + (m.duration ? '<li>' + ICON_CLOCK + '<span><b>' + esc(L.duration) + '</b> ' + esc(m.duration) + '</span></li>' : '')
        + (m.validity ? '<li>' + ICON_CAL + '<span><b>' + esc(L.valid) + '</b> ' + esc(m.validity) + '</span></li>' : '')
        + '</ul>'
      : '';
    let button = '';
    if (m.buttonUrl) {
      const ext = /^https?:\/\//i.test(m.buttonUrl);
      button = '<a class="ma-promo__btn" href="' + esc(m.buttonUrl) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(m.buttonLabel) + '</a>';
    }
    const details = (m.intro || m.conditions) && !feature
      ? '<div class="ma-promo__more"><h4>' + esc(L.details) + '</h4>' + (m.intro ? '<p class="ma-promo__lead">' + esc(m.intro) + '</p>' : '') + (m.conditions ? markdown(m.conditions) : '') + '</div>'
      : '';
    const photo = m.photo && !feature
      ? '<img class="ma-promo__photo" loading="lazy" src="' + esc(m.photo.url) + '"' + (m.photo.srcset ? ' srcset="' + esc(m.photo.srcset) + '" sizes="(max-width: 700px) 100vw, 400px"' : '') + ' alt="' + esc(m.photo.alt || '') + '">'
      : '';
    const body = '<h3 class="ma-promo__name">' + esc(m.title) + '</h3>' + priceBlock + facts + (button ? '<p class="ma-promo__cta">' + button + '</p>' : '') + details;
    return '<article class="ma-promo' + (feature ? ' ma-promo--feature' : '') + '">' + photo + '<div class="ma-promo__body">' + body + '</div></article>';
  }
  const PROMO_CSS = [
    ':where(.ma-promos){display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}',
    ':where(.ma-promos--feature){display:block}',
    ':where(.ma-promo){display:flex;flex-direction:column;background:var(--ma-surface,#fff);border:1px solid var(--ma-border,#d5ddd8);border-radius:var(--ma-radius,20px);overflow:hidden;color:inherit}',
    ':where(.ma-promo--feature){background:none;border:0;border-radius:0;overflow:visible}',
    ':where(.ma-promo__photo){display:block;width:100%;aspect-ratio:3/2;object-fit:cover}',
    ':where(.ma-promo__body){display:flex;flex-direction:column;align-items:flex-start;gap:1rem;padding:1.5rem}',
    ':where(.ma-promo--feature .ma-promo__body){padding:0}',
    ':where(.ma-promo__name){margin:0;font-family:var(--ma-display,inherit);font-size:1.6rem;line-height:1.2}',
    ':where(.ma-promo__price){display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem 1rem;margin:0}',
    ':where(.ma-promo__now){font-family:var(--ma-display,inherit);font-size:clamp(2.75rem,8vw,4rem);font-weight:700;line-height:1;color:var(--ma-accent,#2f5d50)}',
    ':where(.ma-promo__was){font-size:1.3rem;color:var(--ma-muted,#5f6b65);text-decoration-thickness:2px}',
    ':where(.ma-promo__badge){align-self:center;padding:.2rem .75rem;border-radius:999px;background:var(--ma-accent,#2f5d50);color:var(--ma-accent-text,#fff);font-size:.875rem;font-weight:700}',
    ':where(.ma-promo__facts){display:flex;flex-wrap:wrap;gap:.5rem .75rem;margin:0;padding:0;list-style:none}',
    ':where(.ma-promo__facts li){display:inline-flex;align-items:center;gap:.5rem;padding:.4rem 1rem;background:var(--ma-soft,#eef2ef);border:1px solid var(--ma-border,#d5ddd8);border-radius:999px;font-size:.875rem}',
    ':where(.ma-promo__facts svg){flex:none;width:18px;height:18px;color:var(--ma-accent,#2f5d50)}',
    ':where(.ma-promo__cta){margin:0}',
    ':where(.ma-promo__btn){display:inline-flex;align-items:center;min-height:48px;padding:0 1.75rem;border-radius:999px;background:var(--ma-accent,#2f5d50);color:var(--ma-accent-text,#fff);font-weight:600;text-decoration:none}',
    ':where(.ma-promo__btn:hover){filter:brightness(.92)}',
    ':where(.ma-promo__more){display:flex;flex-direction:column;gap:.75rem;width:100%;padding-top:.5rem;border-top:1px solid var(--ma-border,#d5ddd8);font-size:.95rem}',
    ':where(.ma-promo__more > *){margin:0}',
    ':where(.ma-promo__more h4){font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ma-accent,#2f5d50)}',
    ':where(.ma-promo__lead){font-weight:600}',
    '.ma-promo__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
  ].join('\n');
  function ensurePromoStyle() {
    if (document.querySelector('style[data-ma-promo-style]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-ma-promo-style', '');
    st.textContent = PROMO_CSS;
    document.head.appendChild(st);
  }
  function renderPromos(el, data) {
    const items = get(data, el.dataset.maPromos);
    const locale = el.dataset.maLocale || cfg.locale || document.documentElement.lang || (typeof navigator !== 'undefined' && navigator.language) || 'en';
    const opts = { locale, currency: el.dataset.maCurrency || cfg.currency || 'EUR', variant: el.dataset.maPromosVariant === 'feature' ? 'feature' : 'cards' };
    let list = Array.isArray(items) ? items : [];
    if ((el.dataset.maPromosShow || 'running') !== 'all') { const t = todayISO(); list = list.filter((it) => isRunning(it, t)); }
    list = list.slice().sort((a, b) => String(a.end_date || '9999').localeCompare(String(b.end_date || '9999')));
    const limit = Number(el.dataset.maPromosLimit) || (opts.variant === 'feature' ? 1 : Infinity);
    list = list.slice(0, limit);
    if (!list.length) { if (el.dataset.maEmpty) el.textContent = el.dataset.maEmpty; return; }
    ensurePromoStyle();
    el.classList.add('ma-promos');
    if (opts.variant === 'feature') el.classList.add('ma-promos--feature');
    el.innerHTML = list.map((it) => promoHTML(it, opts)).join('');
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
  function isEmpty(v) { return v == null || v === '' || v === false || (Array.isArray(v) && !v.length); }
  function bind(root, data) {
    each(root, '[data-ma-list]', 'list', (el) => {
      const items = get(data, el.dataset.maList) || [];
      const tpl = el.firstElementChild;
      if (!tpl) return;
      el.removeChild(tpl);
      const filtered = (Array.isArray(items) ? items : []).filter((it) => !(el.dataset.maFilter && !get(it, el.dataset.maFilter)));
      filtered.forEach((it) => { const node = tpl.cloneNode(true); bindNode(node, it); el.appendChild(node); });
      if (!filtered.length && el.dataset.maEmpty) el.textContent = el.dataset.maEmpty;
    });
    // if / unless run AFTER the lists: a list template must be cloned intact, and each clone
    // is bound with its own item, so these passes only ever see finished clones.
    each(root, '[data-ma-if]', 'if', (el) => { if (isEmpty(get(data, el.dataset.maIf))) el.remove(); });
    each(root, '[data-ma-unless]', 'unless', (el) => { if (!isEmpty(get(data, el.dataset.maUnless))) el.remove(); });
    each(root, '[data-ma-promos]', 'promos', (el) => renderPromos(el, data));
    each(root, '[data-ma-menu]', 'menu', (el) => { el.innerHTML = ''; el.appendChild(renderMenu(get(data, el.dataset.maMenu) || [], 1)); });
    each(root, '[data-ma]', 'text', (el) => {
      const v = get(data, el.dataset.ma);
      if (isEmpty(v)) return; // keep whatever the HTML already says
      const text = typeof v === 'object' ? (v.alt || '') : String(v);
      const attr = el.dataset.maAttr;
      if (attr) el.setAttribute(attr, (el.dataset.maPrefix || '') + text);
      else el.textContent = text;
    });
    each(root, '[data-ma-html]', 'html', (el) => { const v = get(data, el.dataset.maHtml); if (!isEmpty(v)) el.innerHTML = markdown(v); });
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

  window.MisterAdmin = { load, render, markdown, get, config: cfg, promos: { model: promoModel, isRunning, formatMoney, html: promoHTML } };

  if (cfg.auto && cfg.admin && cfg.site) {
    const start = () => render().catch((e) => { console.error(e); document.documentElement.classList.add('ma-error'); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})();
