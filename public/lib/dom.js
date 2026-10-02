// Tiny DOM helpers. No framework, no build step.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function toast(message, type = 'info', ms = 3500) {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div', { id: 'toasts' }); document.body.append(host); }
  const t = h('div', { class: `toast toast-${type}`, role: 'status' }, message);
  host.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function modal({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const close = (value) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const overlay = h('div', { class: 'overlay', onClick: (e) => { if (e.target === overlay) close(null); } },
      h('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'btn btn-ghost', onClick: () => close(null), 'aria-label': 'Close' }, '✕')),
        h('div', { class: 'modal-body' }, body),
        actions.length ? h('div', { class: 'modal-actions' },
          actions.map((a) => h('button', { class: `btn ${a.class || ''}`, onClick: async () => { const r = a.onClick ? await a.onClick() : a.value; if (r !== false) close(r === undefined ? a.value : r); } }, a.label))
        ) : null
      )
    );
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    overlay.close = close;
    const first = overlay.querySelector('input, textarea, select, button.btn-primary');
    if (first) first.focus();
  });
}

export function confirmDialog(message, { okLabel = 'Yes', danger = false } = {}) {
  return modal({
    title: 'Please confirm',
    body: h('p', {}, message),
    actions: [
      { label: 'Cancel', value: false, class: 'btn-ghost' },
      { label: okLabel, value: true, class: danger ? 'btn-danger' : 'btn-primary' },
    ],
  }).then((v) => v === true);
}

export function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString();
}

export function bytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
