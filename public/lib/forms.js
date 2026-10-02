// Renders editing fields from a schema definition. Mutates `value` in place on input.
import { h } from './dom.js';
import { pickImage } from './media-ui.js';

export function renderFields(fields, value, { site, readOnly = false, onChange = () => {} } = {}) {
  const wrap = h('div');
  for (const f of fields) wrap.append(renderField(f, value, { site, readOnly, onChange }));
  return wrap;
}

function labelEl(f) {
  return h('span', { class: 'lbl' }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null);
}
function helpEl(f) { return f.help ? h('span', { class: 'help' }, f.help) : null; }

export function renderField(f, value, ctx) {
  const { readOnly, onChange } = ctx;
  const set = (v) => { value[f.name] = v; onChange(f.name); };
  const cur = value[f.name];
  const common = { disabled: readOnly };

  switch (f.type) {
    case 'text':
    case 'link':
      return h('label', { class: 'field' }, labelEl(f),
        h('input', { ...common, type: 'text', value: cur ?? '', maxlength: f.maxLength || 2000, placeholder: f.type === 'link' ? 'https://… or /page' : '', onInput: (e) => set(e.target.value) }), helpEl(f));
    case 'textarea':
    case 'markdown':
      return h('label', { class: 'field' }, labelEl(f),
        h('textarea', { ...common, maxlength: f.maxLength, onInput: (e) => set(e.target.value) }, cur ?? ''),
        f.type === 'markdown' ? h('span', { class: 'help' }, 'Markdown is allowed: **bold**, *italic*, [link](https://…), - list') : null, helpEl(f));
    case 'number':
      return h('label', { class: 'field' }, labelEl(f),
        h('input', { ...common, type: 'number', value: cur ?? '', min: f.min, max: f.max, step: 'any', onInput: (e) => set(e.target.value === '' ? null : Number(e.target.value)) }), helpEl(f));
    case 'boolean':
      return h('div', { class: 'field' }, h('label', { class: 'switch' },
        h('span', {}, h('span', { class: 'lbl' }, f.label), f.help ? h('span', { class: 'help', style: { marginTop: 0 } }, f.help) : null),
        h('input', { ...common, type: 'checkbox', checked: !!cur, onChange: (e) => set(e.target.checked) }), h('span', { class: 'knob' })));
    case 'date':
      return h('label', { class: 'field' }, labelEl(f),
        h('input', { ...common, type: 'date', value: cur ?? '', onInput: (e) => set(e.target.value) }), helpEl(f));
    case 'select':
      return h('label', { class: 'field' }, labelEl(f),
        h('select', { ...common, onChange: (e) => set(e.target.value) },
          h('option', { value: '' }, '— choose —'),
          f.options.map((o) => h('option', { value: o, selected: o === cur }, o))), helpEl(f));
    case 'color': {
      const text = h('input', { ...common, type: 'text', value: cur ?? '', placeholder: '#ff8800', maxlength: 7, style: { width: '120px' }, onInput: (e) => { set(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) picker.value = e.target.value; } });
      const picker = h('input', { ...common, type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#000000', onInput: (e) => { set(e.target.value); text.value = e.target.value; } });
      return h('div', { class: 'field' }, labelEl(f), h('div', { class: 'row color-row' }, picker, text), helpEl(f));
    }
    case 'image':
      return imageField(f, value, ctx);
    case 'gallery':
      return galleryField(f, value, ctx);
    default:
      return h('p', { class: 'muted' }, `Unknown field type: ${f.type}`);
  }
}

function imageField(f, value, ctx) {
  const { site, readOnly, onChange } = ctx;
  const box = h('div', { class: 'field' });
  const render = () => {
    box.replaceChildren();
    const img = value[f.name];
    box.append(labelEl(f));
    const alt = h('input', { type: 'text', placeholder: 'Alt text (describe the photo)', value: img?.alt || '', disabled: readOnly || !img, onInput: (e) => { if (img) { img.alt = e.target.value; onChange(f.name); } } });
    box.append(h('div', { class: 'img-field' },
      img ? h('img', { class: 'thumb', src: img.src?.[480] || img.url }) : h('div', { class: 'thumb placeholder' }, 'No image'),
      h('div', { style: { flex: 1 } },
        h('div', { class: 'row', style: { marginBottom: '.4rem' } },
          !readOnly ? h('button', { type: 'button', class: 'btn btn-sm', onClick: async () => { const m = await pickImage(site); if (m) { value[f.name] = { ...m, alt: img?.alt || m.alt }; onChange(f.name); render(); } } }, img ? 'Change' : 'Choose photo') : null,
          img && !readOnly ? h('button', { type: 'button', class: 'btn btn-sm btn-danger', onClick: () => { value[f.name] = null; onChange(f.name); render(); } }, 'Remove') : null),
        alt)));
    if (f.help) box.append(helpEl(f));
  };
  render();
  return box;
}

function galleryField(f, value, ctx) {
  const { site, readOnly, onChange } = ctx;
  const box = h('div', { class: 'field' });
  if (!Array.isArray(value[f.name])) value[f.name] = [];
  const render = () => {
    box.replaceChildren();
    const list = value[f.name];
    box.append(labelEl(f));
    const g = h('div', { class: 'gallery' });
    list.forEach((img, i) => {
      g.append(h('div', { class: 'g-item' },
        h('img', { class: 'thumb', src: img.src?.[480] || img.url, alt: img.alt || '', title: img.alt || '' }),
        !readOnly ? h('div', { class: 'g-tools' },
          h('button', { type: 'button', class: 'btn btn-sm btn-icon', title: 'Move left', disabled: i === 0, onClick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; onChange(f.name); render(); } }, '◀'),
          h('button', { type: 'button', class: 'btn btn-sm btn-icon', title: 'Alt text', onClick: () => { const a = prompt('Alt text for this photo', img.alt || ''); if (a !== null) { img.alt = a; onChange(f.name); render(); } } }, 'Aa'),
          h('button', { type: 'button', class: 'btn btn-sm btn-icon btn-danger', title: 'Remove', onClick: () => { list.splice(i, 1); onChange(f.name); render(); } }, '✕'),
          h('button', { type: 'button', class: 'btn btn-sm btn-icon', title: 'Move right', disabled: i === list.length - 1, onClick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; onChange(f.name); render(); } }, '▶')) : null));
    });
    box.append(g);
    if (!readOnly) box.append(h('div', { style: { marginTop: '.5rem' } }, h('button', { type: 'button', class: 'btn btn-sm', onClick: async () => { const ms = await pickImage(site, { multiple: true }); if (ms?.length) { list.push(...ms.map((m) => ({ ...m }))); onChange(f.name); render(); } } }, '+ Add photos')));
    if (f.help) box.append(helpEl(f));
  };
  render();
  return box;
}
