// Site schema validation and content validation.
// The schema is the contract between Mister Admin and a website.
// See docs/04-schema-format.md for the human explanation.
import { HttpError } from './http.js';

export const FIELD_TYPES = [
  'text', 'textarea', 'markdown', 'number', 'boolean', 'date',
  'link', 'select', 'color', 'image', 'gallery',
];
export const COLLECTION_TYPES = ['single', 'list', 'tree'];

const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_TREE_DEPTH = 3;
const MAX_LIST_ITEMS = 2000;

/** Throws HttpError(400) if the schema is invalid. Returns a normalized schema. */
export function validateSchema(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Schema must be an object');
  const collections = input.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    throw new HttpError(400, 'Schema must have a "collections" object');
  }
  const out = { collections: {} };
  const names = Object.keys(collections);
  if (names.length > 100) throw new HttpError(400, 'Too many collections (max 100)');
  for (const name of names) {
    if (!NAME_RE.test(name)) throw new HttpError(400, `Collection name "${name}" must be lowercase letters, numbers and underscores`);
    const c = collections[name];
    if (!c || typeof c !== 'object') throw new HttpError(400, `Collection "${name}" must be an object`);
    const type = c.type || 'single';
    if (!COLLECTION_TYPES.includes(type)) throw new HttpError(400, `Collection "${name}": unknown type "${type}"`);
    if (!Array.isArray(c.fields) || c.fields.length === 0) throw new HttpError(400, `Collection "${name}" needs a non-empty "fields" array`);
    if (c.fields.length > 60) throw new HttpError(400, `Collection "${name}" has too many fields (max 60)`);
    const fields = [];
    const seen = new Set();
    for (const f of c.fields) {
      if (!f || typeof f !== 'object') throw new HttpError(400, `Collection "${name}": each field must be an object`);
      if (!NAME_RE.test(f.name || '')) throw new HttpError(400, `Collection "${name}": field name "${f.name}" is invalid`);
      if (f.name === 'id' || f.name === 'children') throw new HttpError(400, `Collection "${name}": "${f.name}" is a reserved field name`);
      if (seen.has(f.name)) throw new HttpError(400, `Collection "${name}": duplicate field "${f.name}"`);
      seen.add(f.name);
      if (!FIELD_TYPES.includes(f.type)) throw new HttpError(400, `Collection "${name}": field "${f.name}" has unknown type "${f.type}"`);
      const nf = {
        name: f.name,
        type: f.type,
        label: typeof f.label === 'string' && f.label ? f.label.slice(0, 80) : prettify(f.name),
        required: !!f.required,
      };
      if (typeof f.help === 'string') nf.help = f.help.slice(0, 300);
      if (f.type === 'select') {
        if (!Array.isArray(f.options) || f.options.length === 0) throw new HttpError(400, `Collection "${name}": select field "${f.name}" needs "options"`);
        nf.options = f.options.map((o) => String(o).slice(0, 100));
      }
      if (f.type === 'number') {
        if (f.min !== undefined) nf.min = Number(f.min);
        if (f.max !== undefined) nf.max = Number(f.max);
      }
      if (f.type === 'text' || f.type === 'textarea' || f.type === 'markdown') {
        nf.maxLength = Math.min(Number(f.maxLength) || (f.type === 'text' ? 500 : 20000), 100000);
      }
      fields.push(nf);
    }
    const nc = {
      type,
      label: typeof c.label === 'string' && c.label ? c.label.slice(0, 80) : prettify(name),
      fields,
    };
    if (typeof c.help === 'string') nc.help = c.help.slice(0, 300);
    if (type !== 'single') {
      const tf = c.titleField && seen.has(c.titleField) ? c.titleField : fields[0].name;
      nc.titleField = tf;
    }
    out.collections[name] = nc;
  }
  return out;
}

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function parseSchema(site) {
  try {
    return JSON.parse(site.schema_json || '{"collections":{}}');
  } catch {
    return { collections: {} };
  }
}

// ---- Content validation -------------------------------------------------------

/**
 * Validates and normalizes the data for one collection.
 * - single  -> object of fields
 * - list    -> array of { id, ...fields }
 * - tree    -> array of { id, ...fields, children: [...] }
 * `mediaIds` is a Set of media ids that exist for the site (image references must be in it).
 */
export function validateCollectionData(collection, data, mediaIds) {
  const problems = [];
  let out;
  if (collection.type === 'single') {
    out = validateItem(collection.fields, data || {}, mediaIds, problems, 'item');
  } else if (collection.type === 'list') {
    if (!Array.isArray(data)) throw new HttpError(400, 'List content must be an array');
    if (data.length > MAX_LIST_ITEMS) throw new HttpError(400, `Too many items (max ${MAX_LIST_ITEMS})`);
    out = data.map((it, i) => ({ id: itemId(it), ...validateItem(collection.fields, it || {}, mediaIds, problems, `item ${i + 1}`) }));
  } else {
    if (!Array.isArray(data)) throw new HttpError(400, 'Tree content must be an array');
    let count = 0;
    const walk = (items, depth, path) => {
      if (depth > MAX_TREE_DEPTH) throw new HttpError(400, `Menu is nested too deep (max ${MAX_TREE_DEPTH} levels)`);
      return items.map((it, i) => {
        if (++count > MAX_LIST_ITEMS) throw new HttpError(400, `Too many items (max ${MAX_LIST_ITEMS})`);
        const label = `${path}${i + 1}`;
        const node = { id: itemId(it), ...validateItem(collection.fields, it || {}, mediaIds, problems, `item ${label}`) };
        node.children = Array.isArray(it?.children) ? walk(it.children, depth + 1, `${label}.`) : [];
        return node;
      });
    };
    out = walk(data, 1, '');
  }
  if (problems.length) throw new HttpError(400, 'Content has errors', problems);
  return out;
}

function itemId(it) {
  const id = it && typeof it.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(it.id) ? it.id : null;
  return id || crypto.randomUUID();
}

function validateItem(fields, item, mediaIds, problems, where) {
  const out = {};
  for (const f of fields) {
    const v = item[f.name];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) problems.push(`${where}: "${f.label}" is required`);
      out[f.name] = emptyValue(f);
      continue;
    }
    switch (f.type) {
      case 'text':
      case 'textarea':
      case 'markdown':
        if (typeof v !== 'string') problems.push(`${where}: "${f.label}" must be text`);
        else if (v.length > f.maxLength) problems.push(`${where}: "${f.label}" is longer than ${f.maxLength} characters`);
        else out[f.name] = f.type === 'text' ? v.replace(/[\r\n]+/g, ' ').trim() : v;
        break;
      case 'link':
        if (typeof v !== 'string' || v.length > 2000) problems.push(`${where}: "${f.label}" must be a link`);
        else if (/^\s*javascript:/i.test(v)) problems.push(`${where}: "${f.label}" is not an allowed link`);
        else out[f.name] = v.trim();
        break;
      case 'color':
        if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) problems.push(`${where}: "${f.label}" must be a colour like #ff8800`);
        else out[f.name] = v.toLowerCase();
        break;
      case 'select':
        if (!f.options.includes(v)) problems.push(`${where}: "${f.label}" must be one of ${f.options.join(', ')}`);
        else out[f.name] = v;
        break;
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) problems.push(`${where}: "${f.label}" must be a number`);
        else if (f.min !== undefined && n < f.min) problems.push(`${where}: "${f.label}" must be at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) problems.push(`${where}: "${f.label}" must be at most ${f.max}`);
        else out[f.name] = n;
        break;
      }
      case 'boolean':
        out[f.name] = v === true || v === 'true' || v === 1;
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) problems.push(`${where}: "${f.label}" must be a date (YYYY-MM-DD)`);
        else out[f.name] = v;
        break;
      case 'image': {
        const img = normalizeImageRef(v, mediaIds);
        if (!img) problems.push(`${where}: "${f.label}" refers to an image that no longer exists`);
        else out[f.name] = img;
        break;
      }
      case 'gallery': {
        if (!Array.isArray(v)) { problems.push(`${where}: "${f.label}" must be a list of images`); break; }
        if (v.length > 200) { problems.push(`${where}: "${f.label}" has too many images (max 200)`); break; }
        const list = [];
        for (const g of v) {
          const img = normalizeImageRef(g, mediaIds);
          if (!img) problems.push(`${where}: "${f.label}" contains an image that no longer exists`);
          else list.push(img);
        }
        out[f.name] = list;
        break;
      }
    }
  }
  return out;
}

function emptyValue(f) {
  if (f.type === 'boolean') return false;
  if (f.type === 'number') return null;
  if (f.type === 'image') return null;
  if (f.type === 'gallery') return [];
  return '';
}

function normalizeImageRef(v, mediaIds) {
  if (!v || typeof v !== 'object' || typeof v.media_id !== 'string') return null;
  if (!mediaIds.has(v.media_id)) return null;
  return { media_id: v.media_id, alt: typeof v.alt === 'string' ? v.alt.slice(0, 300) : '' };
}

/** Returns the set of media ids referenced anywhere in a value. */
export function collectMediaIds(value, acc = new Set()) {
  if (!value || typeof value !== 'object') return acc;
  if (typeof value.media_id === 'string') acc.add(value.media_id);
  for (const k of Object.keys(value)) collectMediaIds(value[k], acc);
  return acc;
}
