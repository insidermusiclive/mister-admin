// Unit tests for the pure logic (schema + content validation, media resolution).
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema, validateCollectionData, collectMediaIds } from '../functions/_lib/schema.js';
import { resolveImages, mediaRowToObject } from '../functions/_lib/media.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { templateById, promotionsSection } from '../public/lib/templates.js';

const example = JSON.parse(readFileSync(new URL('../examples/site.schema.json', import.meta.url)));

test('example schema validates', () => {
  const s = validateSchema(example);
  assert.equal(Object.keys(s.collections).length, 5);
  assert.equal(s.collections.navigation.type, 'tree');
  assert.equal(s.collections.events.titleField, 'name');
});

test('schema rejects bad names and types', () => {
  assert.throws(() => validateSchema({ collections: { 'Bad-Name': { fields: [{ name: 'a', type: 'text' }] } } }), /lowercase/);
  assert.throws(() => validateSchema({ collections: { ok: { fields: [{ name: 'id', type: 'text' }] } } }), /reserved/);
  assert.throws(() => validateSchema({ collections: { ok: { fields: [{ name: 'a', type: 'magic' }] } } }), /unknown type/);
  assert.throws(() => validateSchema({ collections: { ok: { fields: [{ name: 'a', type: 'select' }] } } }), /options/);
  assert.throws(() => validateSchema({ collections: { ok: { fields: [] } } }), /non-empty/);
});

test('single collection validation', () => {
  const s = validateSchema(example);
  const media = new Set(['m1']);
  const out = validateCollectionData(s.collections.settings, { title: ' Hi\nthere ', logo: { media_id: 'm1', alt: 'x', url: 'ignored' }, accent_color: '#FF8800', junk: 1 }, media);
  assert.equal(out.title, 'Hi there');
  assert.deepEqual(out.logo, { media_id: 'm1', alt: 'x' });
  assert.equal(out.accent_color, '#ff8800');
  assert.equal('junk' in out, false);
});

test('required and type errors are collected', () => {
  const s = validateSchema(example);
  try {
    validateCollectionData(s.collections.events, [{ name: '', date: 'yesterday', price: -1, category: 'Nope', photo: { media_id: 'missing' } }], new Set());
    assert.fail('should throw');
  } catch (e) {
    assert.equal(e.status, 400);
    assert.equal(e.details.length, 5);
  }
});

test('list keeps ids and assigns new ones', () => {
  const s = validateSchema(example);
  const out = validateCollectionData(s.collections.events, [{ id: 'keep', name: 'A', date: '2026-01-01' }, { name: 'B', date: '2026-01-02' }], new Set());
  assert.equal(out[0].id, 'keep');
  assert.match(out[1].id, /^[0-9a-f-]{36}$/);
  assert.equal(out[0].published, false);
  assert.equal(out[0].price, null);
});

test('tree depth limit', () => {
  const s = validateSchema(example);
  const deep = [{ label: 'a', url: '/', children: [{ label: 'b', url: '/', children: [{ label: 'c', url: '/', children: [{ label: 'd', url: '/' }] }] }] }];
  assert.throws(() => validateCollectionData(s.collections.navigation, deep, new Set()), /too deep/);
  const ok = validateCollectionData(s.collections.navigation, deep[0].children, new Set());
  assert.equal(ok[0].children[0].children.length, 1);
});

test('javascript: links rejected', () => {
  const s = validateSchema(example);
  assert.throws(() => validateCollectionData(s.collections.navigation, [{ label: 'x', url: 'javascript:alert(1)' }], new Set()), /errors/);
});

test('media resolution', () => {
  const row = { id: 'm1', alt: 'Alt', width: 4000, height: 3000, variants_json: JSON.stringify([{ width: 480, key: 'sites/s/m1/480.webp' }, { width: 2000, key: 'sites/s/m1/2000.webp' }]), placeholder: '', original_name: 'a.jpg', created_at: '', size_bytes: 1 };
  const obj = mediaRowToObject(row, 'https://x/media');
  assert.equal(obj.url, 'https://x/media/sites/s/m1/2000.webp');
  assert.equal(obj.srcset, 'https://x/media/sites/s/m1/480.webp 480w, https://x/media/sites/s/m1/2000.webp 2000w');
  const map = new Map([['m1', obj]]);
  const resolved = resolveImages({ hero: { image: { media_id: 'm1', alt: 'Custom' }, gone: { media_id: 'zz', alt: '' } }, list: [{ media_id: 'm1', alt: '' }] }, map);
  assert.equal(resolved.hero.image.alt, 'Custom');
  assert.equal(resolved.hero.image.url, obj.url);
  assert.equal(resolved.hero.gone, null);
  assert.equal(resolved.list[0].alt, 'Alt');
  assert.deepEqual([...collectMediaIds({ a: [{ media_id: 'm1' }], b: { c: { media_id: 'm2' } } })], ['m1', 'm2']);
});

// ---- Promotions: ready-made section + site client renderer -------------------------------------
function loadClient() {
  const sandbox = { window: {}, document: { currentScript: null, readyState: 'complete' }, navigator: { language: 'en' } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../site-client/mister-admin.js', import.meta.url), 'utf8'), sandbox);
  return sandbox.window.MisterAdmin;
}
const client = loadClient();

test('promotions section is a valid schema and a fresh copy each time', () => {
  const schema = { collections: { promotions: promotionsSection() } };
  const s = validateSchema(schema);
  assert.equal(s.collections.promotions.type, 'list');
  assert.notEqual(promotionsSection(), promotionsSection());
  assert.ok(templateById('business').schema.collections.promotions);
  validateSchema(templateById('business').schema);
});

test('promotion content validates (prices, dates, switch)', () => {
  const s = validateSchema({ collections: { promotions: promotionsSection() } });
  const ok = validateCollectionData(s.collections.promotions, [{ title: 'Facial', old_price: 70, price: 63, duration: '60 min', start_date: '2026-09-28', end_date: '2026-10-03', published: true }], new Set());
  assert.equal(ok[0].price, 63);
  assert.equal(ok[0].published, true);
  assert.throws(() => validateCollectionData(s.collections.promotions, [{ title: 'x', price: -5 }], new Set()), /errors/);
  assert.throws(() => validateCollectionData(s.collections.promotions, [{ title: 'x', end_date: 'soon' }], new Set()), /errors/);
});

test('client: an offer runs only inside its dates and when published', () => {
  const p = client.promos;
  const item = { published: true, start_date: '2026-09-28', end_date: '2026-10-03' };
  assert.equal(p.isRunning(item, '2026-09-27'), false);
  assert.equal(p.isRunning(item, '2026-09-28'), true);
  assert.equal(p.isRunning(item, '2026-10-03'), true);
  assert.equal(p.isRunning(item, '2026-10-04'), false);
  assert.equal(p.isRunning({ ...item, published: false }, '2026-09-30'), false);
  assert.equal(p.isRunning({ published: true }, '2030-01-01'), true);
});

test('client: price, discount badge and dates are formatted for the visitor', () => {
  const m = client.promos.model({ title: 'Facial', old_price: 70, price: 63, duration: '60 min', start_date: '2026-09-28', end_date: '2026-10-03', button_url: 'https://x.test/book' }, { locale: 'fr-BE' });
  assert.equal(m.price.replace(/\s/g, ' '), '63 €');
  assert.equal(m.oldPrice.replace(/\s/g, ' '), '70 €');
  assert.equal(m.badge, '-10%');
  assert.equal(m.validity, 'Du 28/09/2026 au 03/10/2026');
  assert.equal(m.buttonLabel, 'Réserver');
  const own = client.promos.model({ title: 'Box', price: 49.5, discount_label: '-20 %', end_date: '2026-10-03' }, { locale: 'en', currency: 'EUR' });
  assert.equal(own.badge, '-20 %');
  assert.match(own.validity, /^Until /);
  assert.match(own.price, /49\.50/);
});

test('client: card html escapes content', () => {
  const html = client.promos.html({ title: '<img src=x onerror=alert(1)>', price: 10, button_url: 'https://x.test', button_label: '"><b>' }, { locale: 'en', variant: 'cards' });
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('"><b>'), false);
  assert.match(html, /ma-promo__now/);
});
