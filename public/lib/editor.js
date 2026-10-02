// Collection editors: single (one form), list (ordered items), tree (nested menu).
import { h, clear, toast, confirmDialog } from './dom.js';
import { api } from './api.js';
import { renderFields } from './forms.js';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export async function collectionView(site, name, state) {
  const col = site.schema.collections[name];
  if (!col) return h('div', { class: 'empty' }, 'This section does not exist in the site schema.');
  const canEdit = ['owner', 'editor'].includes(site.role);
  const root = h('div');
  const errors = h('ul', { class: 'error-list hidden' });
  const body = h('div');
  let data;
  let dirty = false;
  const markDirty = () => { dirty = true; state.setDirty(true); saveBtn.disabled = false; };

  const saveBtn = h('button', { class: 'btn btn-primary', disabled: true, onClick: save }, 'Save');
  const status = h('span', { class: 'muted small' });

  async function save() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    errors.classList.add('hidden');
    try {
      const r = await api('PUT', `/api/sites/${site.id}/content/${name}`, { data });
      data = r.data;
      dirty = false;
      state.setDirty(false);
      state.onSaved?.();
      toast('Saved. Remember to Publish when you are ready.', 'success');
      renderBody();
    } catch (e) {
      clear(errors);
      if (e.details?.length) { for (const p of e.details) errors.append(h('li', {}, p)); errors.classList.remove('hidden'); }
      toast(e.message, 'error');
      saveBtn.disabled = false;
    } finally { saveBtn.textContent = 'Save'; }
  }

  const ctx = { site, readOnly: !canEdit, onChange: markDirty };
  function renderBody() {
    clear(body);
    if (col.type === 'single') body.append(h('div', { class: 'card' }, renderFields(col.fields, data, ctx)));
    else if (col.type === 'list') body.append(listEditor(col, data, ctx, markDirty));
    else body.append(treeEditor(col, data, ctx, markDirty));
  }

  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, col.label), col.help ? h('span', { class: 'muted small', style: { width: '100%' } }, col.help) : null),
    errors, body
  );
  if (canEdit) root.append(h('div', { class: 'sticky-actions' }, saveBtn, status));

  try {
    const r = await api('GET', `/api/sites/${site.id}/content/${name}`);
    data = r.data ?? (col.type === 'single' ? {} : []);
    if (col.type === 'single' && Array.isArray(data)) data = {};
    if (col.type !== 'single' && !Array.isArray(data)) data = [];
    status.textContent = r.updated_at ? `Last saved ${new Date(r.updated_at.replace(' ', 'T') + 'Z').toLocaleString()}` : 'Not saved yet';
  } catch (e) { toast(e.message, 'error'); data = col.type === 'single' ? {} : []; }
  renderBody();
  return root;
}

function titleOf(col, item) {
  const v = item[col.titleField];
  if (v && typeof v === 'object') return v.alt || v.original_name || '(photo)';
  return (v ?? '').toString().trim() || '(untitled)';
}

function listEditor(col, items, ctx, markDirty) {
  const wrap = h('div');
  const open = new Set();
  const render = () => {
    clear(wrap);
    if (!items.length) wrap.append(h('div', { class: 'empty' }, `No ${col.label.toLowerCase()} yet.`));
    items.forEach((item, i) => wrap.append(itemRow(col, item, i, items, ctx, markDirty, open, render)));
    if (!ctx.readOnly) wrap.append(h('button', { class: 'btn', style: { marginTop: '.5rem' }, onClick: () => { const it = blank(col); items.push(it); open.add(it.id); markDirty(); render(); } }, '+ Add'));
  };
  render();
  return wrap;
}

function blank(col) {
  const it = { id: newId() };
  for (const f of col.fields) it[f.name] = f.type === 'boolean' ? false : f.type === 'gallery' ? [] : f.type === 'image' || f.type === 'number' ? null : '';
  if (col.type === 'tree') it.children = [];
  return it;
}

function itemRow(col, item, i, siblings, ctx, markDirty, open, rerender, depth = 1) {
  if (!item.id) item.id = newId();
  const isOpen = open.has(item.id);
  const head = h('div', { class: 'item-head', onClick: (e) => { if (e.target.closest('button')) return; if (isOpen) open.delete(item.id); else open.add(item.id); rerender(); } },
    h('span', { class: 'muted' }, isOpen ? '▾' : '▸'),
    h('span', { class: 'title' }, titleOf(col, item)),
    !ctx.readOnly ? [
      h('button', { class: 'btn btn-sm btn-icon', title: 'Move up', disabled: i === 0, onClick: () => { [siblings[i - 1], siblings[i]] = [siblings[i], siblings[i - 1]]; markDirty(); rerender(); } }, '↑'),
      h('button', { class: 'btn btn-sm btn-icon', title: 'Move down', disabled: i === siblings.length - 1, onClick: () => { [siblings[i + 1], siblings[i]] = [siblings[i], siblings[i + 1]]; markDirty(); rerender(); } }, '↓'),
      h('button', { class: 'btn btn-sm btn-icon', title: 'Duplicate', onClick: () => { const copy = JSON.parse(JSON.stringify(item)); reId(copy); siblings.splice(i + 1, 0, copy); markDirty(); rerender(); } }, '⧉'),
      h('button', { class: 'btn btn-sm btn-icon btn-danger', title: 'Delete', onClick: async () => { if (await confirmDialog(`Delete "${titleOf(col, item)}"?`, { okLabel: 'Delete', danger: true })) { siblings.splice(i, 1); markDirty(); rerender(); } } }, '✕'),
    ] : null
  );
  const el = h('div', { class: 'item' }, head);
  if (isOpen) {
    const bodyEl = h('div', { class: 'item-body' }, renderFields(col.fields, item, { ...ctx, onChange: (f) => { markDirty(); if (f === col.titleField) head.querySelector('.title').textContent = titleOf(col, item); } }));
    if (col.type === 'tree' && depth < 3) {
      const kids = h('div', { class: 'tree-children' });
      const renderKids = () => { clear(kids); item.children.forEach((c, j) => kids.append(itemRow(col, c, j, item.children, ctx, markDirty, open, rerender, depth + 1))); };
      if (!Array.isArray(item.children)) item.children = [];
      renderKids();
      bodyEl.append(h('h4', { class: 'muted small', style: { margin: '.5rem 0 .25rem' } }, 'Sub-items'), kids);
      if (!ctx.readOnly) bodyEl.append(h('button', { class: 'btn btn-sm', style: { marginTop: '.4rem' }, onClick: () => { const it = blank(col); item.children.push(it); open.add(it.id); markDirty(); rerender(); } }, '+ Add sub-item'));
    }
    el.append(bodyEl);
  } else if (col.type === 'tree' && item.children?.length) {
    el.append(h('div', { class: 'item-body small muted' }, `${item.children.length} sub-item${item.children.length > 1 ? 's' : ''}`));
  }
  return el;
}

function reId(item) {
  item.id = newId();
  if (Array.isArray(item.children)) item.children.forEach(reId);
}

function treeEditor(col, items, ctx, markDirty) {
  return listEditor(col, items, ctx, markDirty);
}
