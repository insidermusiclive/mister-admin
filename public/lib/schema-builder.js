// Visual editor for a site schema: sections and fields, no JSON needed.
import { h, clear, modal, confirmDialog, toast } from './dom.js';

export const FIELD_TYPE_LABELS = {
  text: 'Short text', textarea: 'Long text', markdown: 'Formatted text', number: 'Number', boolean: 'On / off switch',
  date: 'Date', link: 'Link', select: 'Choice list', color: 'Colour', image: 'Photo', gallery: 'Photo gallery',
};
const SECTION_TYPE_LABELS = { single: 'One block (e.g. About us)', list: 'A list of items (e.g. News, Events)', tree: 'A menu (nested links)' };

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '').slice(0, 40) || 'section';

function uniqueName(base, taken) {
  let n = base, i = 2;
  while (taken.has(n)) n = `${base}_${i++}`;
  return n;
}

/** Renders the builder for `schema` (mutated in place). Calls onChange() after every change. */
export function schemaBuilder(schema, { onChange = () => {} } = {}) {
  const root = h('div');
  const render = () => {
    clear(root);
    const names = Object.keys(schema.collections);
    if (!names.length) root.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🧩'), h('h3', {}, 'No sections yet'), h('p', { class: 'muted' }, 'A section is a part of your website you want to edit: About us, Events, Menu…')));
    names.forEach((name, idx) => root.append(sectionEl(name, idx, names)));
    root.append(h('button', { class: 'btn btn-primary', style: { marginTop: '.5rem' }, onClick: addSection }, '+ Add section'));
  };

  const sectionEl = (name, idx, names) => {
    const c = schema.collections[name];
    const open = c.__open;
    const el = h('div', { class: 'sb-section' },
      h('div', { class: 'sb-head' },
        h('button', { class: 'btn btn-ghost btn-sm btn-icon', onClick: () => { c.__open = !open; render(); }, 'aria-label': 'Expand' }, open ? '▾' : '▸'),
        h('span', { class: 'title' }, c.label, ' ', h('span', { class: 'badge' }, c.type === 'single' ? 'block' : c.type === 'list' ? 'list' : 'menu'), ' ', h('span', { class: 'mini muted small' }, `${c.fields.length} field${c.fields.length === 1 ? '' : 's'}`)),
        h('button', { class: 'btn btn-sm btn-icon', title: 'Move up', disabled: idx === 0, onClick: () => { reorder(names, idx, idx - 1); } }, '↑'),
        h('button', { class: 'btn btn-sm btn-icon', title: 'Move down', disabled: idx === names.length - 1, onClick: () => { reorder(names, idx, idx + 1); } }, '↓'),
        h('button', { class: 'btn btn-sm btn-icon', title: 'Rename', onClick: () => renameSection(name) }, '✎'),
        h('button', { class: 'btn btn-sm btn-icon btn-danger', title: 'Delete section', onClick: async () => { if (await confirmDialog(`Delete the section "${c.label}"? Its content will no longer be shown on the website.`, { okLabel: 'Delete', danger: true })) { delete schema.collections[name]; onChange(); render(); } } }, '✕')));
    if (open) {
      const fields = h('div', { class: 'sb-fields' });
      c.fields.forEach((f, i) => fields.append(fieldRow(c, f, i)));
      fields.append(h('div', { class: 'row', style: { marginTop: '.6rem' } },
        h('button', { class: 'btn btn-sm', onClick: () => addField(c) }, '+ Add field'),
        h('span', { class: 'small muted' }, `Website key: `, h('code', {}, name))));
      el.append(fields);
    }
    return el;
  };

  const fieldRow = (c, f, i) => h('div', { class: 'sb-field' },
    h('div', {}, h('strong', {}, f.label), f.required ? h('span', { class: 'req' }, ' *') : null, h('div', { class: 'mini' }, h('code', {}, f.name), f.type === 'select' && f.options ? ` · ${f.options.join(', ')}` : '')),
    h('div', { class: 'mini' }, FIELD_TYPE_LABELS[f.type] || f.type),
    h('div', { class: 'row', style: { gap: '.15rem' } },
      h('button', { class: 'btn btn-sm btn-icon', disabled: i === 0, title: 'Move up', onClick: () => { [c.fields[i - 1], c.fields[i]] = [c.fields[i], c.fields[i - 1]]; onChange(); render(); } }, '↑'),
      h('button', { class: 'btn btn-sm btn-icon', disabled: i === c.fields.length - 1, title: 'Move down', onClick: () => { [c.fields[i + 1], c.fields[i]] = [c.fields[i], c.fields[i + 1]]; onChange(); render(); } }, '↓')),
    h('div', { class: 'row', style: { gap: '.15rem' } },
      h('button', { class: 'btn btn-sm btn-icon', title: 'Edit', onClick: () => editField(c, f) }, '✎'),
      h('button', { class: 'btn btn-sm btn-icon btn-danger', title: 'Remove', onClick: async () => { if (await confirmDialog(`Remove the field "${f.label}"?`, { okLabel: 'Remove', danger: true })) { c.fields.splice(i, 1); onChange(); render(); } } }, '✕')));

  function reorder(names, from, to) {
    const arr = names.slice(); const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    const next = {}; for (const n of arr) next[n] = schema.collections[n];
    schema.collections = next; onChange(); render();
  }

  async function addSection() {
    const label = h('input', { type: 'text', placeholder: 'e.g. Events, About us, Team' });
    let type = 'list';
    const choices = h('div', { class: 'choices' });
    const drawChoices = () => { clear(choices); for (const [t, desc] of Object.entries(SECTION_TYPE_LABELS)) choices.append(h('button', { class: `choice${type === t ? ' selected' : ''}`, type: 'button', onClick: () => { type = t; drawChoices(); } }, h('strong', {}, t === 'single' ? 'Block' : t === 'list' ? 'List' : 'Menu'), h('span', {}, desc))); };
    drawChoices();
    const r = await modal({ title: 'New section', body: h('div', {}, h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Name'), label), h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'What kind of section?'), choices)),
      actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Add', class: 'btn-primary', onClick: () => { if (!label.value.trim()) { toast('Give the section a name', 'error'); return false; } return { label: label.value.trim() }; } }] });
    if (!r) return;
    const name = uniqueName(slugify(r.label), new Set(Object.keys(schema.collections)));
    const fields = type === 'tree' ? [{ name: 'label', type: 'text', label: 'Label', required: true }, { name: 'url', type: 'link', label: 'Link', required: true }]
      : type === 'list' ? [{ name: 'title', type: 'text', label: 'Title', required: true }] : [{ name: 'text', type: 'markdown', label: 'Text' }];
    schema.collections[name] = { label: r.label, type, fields, titleField: fields[0].name, __open: true };
    onChange(); render();
  }

  async function renameSection(name) {
    const c = schema.collections[name];
    const label = h('input', { type: 'text', value: c.label });
    const r = await modal({ title: 'Rename section', body: h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Name shown in the admin'), label, h('span', { class: 'help' }, 'The website key stays ', h('code', {}, name), ' so the website keeps working.')),
      actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Save', class: 'btn-primary', onClick: () => label.value.trim() ? label.value.trim() : false }] });
    if (r) { c.label = r; onChange(); render(); }
  }

  function fieldForm(f = {}) {
    const label = h('input', { type: 'text', value: f.label || '', placeholder: 'e.g. Title, Date, Photo' });
    const type = h('select', {}, Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => h('option', { value: v, selected: f.type === v }, l)));
    const required = h('input', { type: 'checkbox', checked: !!f.required });
    const options = h('input', { type: 'text', value: (f.options || []).join(', '), placeholder: 'Option 1, Option 2, Option 3' });
    const help = h('input', { type: 'text', value: f.help || '', placeholder: 'Optional hint shown under the field' });
    const optWrap = h('label', { class: `field${type.value === 'select' ? '' : ' hidden'}` }, h('span', { class: 'lbl' }, 'Choices (comma separated)'), options);
    type.addEventListener('change', () => optWrap.classList.toggle('hidden', type.value !== 'select'));
    const body = h('div', {},
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Label'), label),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Type'), type),
      optWrap,
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Hint'), help),
      h('label', { class: 'switch' }, h('span', { class: 'lbl' }, 'Required'), required, h('span', { class: 'knob' })));
    const read = () => {
      if (!label.value.trim()) { toast('Give the field a label', 'error'); return false; }
      const out = { label: label.value.trim(), type: type.value, required: required.checked };
      if (help.value.trim()) out.help = help.value.trim();
      if (type.value === 'select') {
        out.options = options.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!out.options.length) { toast('Add at least one choice', 'error'); return false; }
      }
      return out;
    };
    return { body, read };
  }

  async function addField(c) {
    const f = fieldForm({ type: 'text' });
    const r = await modal({ title: `New field in "${c.label}"`, body: f.body, actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Add', class: 'btn-primary', onClick: f.read }] });
    if (!r) return;
    r.name = uniqueName(slugify(r.label), new Set(c.fields.map((x) => x.name).concat(['id', 'children'])));
    c.fields.push(r); onChange(); render();
  }

  async function editField(c, field) {
    const f = fieldForm(field);
    const r = await modal({ title: `Edit "${field.label}"`, body: f.body, actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Save', class: 'btn-primary', onClick: f.read }] });
    if (!r) return;
    Object.assign(field, { label: r.label, type: r.type, required: r.required, help: r.help, options: r.options });
    if (field.type !== 'select') delete field.options;
    if (!field.help) delete field.help;
    onChange(); render();
  }

  render();
  return root;
}

/** Strips builder-only keys before saving. */
export function cleanSchema(schema) {
  const out = { collections: {} };
  for (const [n, c] of Object.entries(schema.collections)) {
    const { __open, ...rest } = c;
    out.collections[n] = rest;
  }
  return out;
}
