// Mister Admin - application shell and router.
import { h, clear, toast, modal, confirmDialog, formatDate } from './lib/dom.js';
import { api } from './lib/api.js';
import { collectionView } from './lib/editor.js';
import { mediaLibraryView } from './lib/media-ui.js';

const app = document.getElementById('app');
const state = { user: null, site: null, dirty: false, setDirty(v) { state.dirty = v; } };

window.addEventListener('ma:unauthorized', () => { state.user = null; go('/login'); });
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', route);

function go(path) { location.hash = '#' + path; }
function currentPath() { return (location.hash || '#/').slice(1) || '/'; }

async function route() {
  if (state.dirty && !confirm('You have unsaved changes. Leave without saving?')) {
    history.back();
    return;
  }
  state.dirty = false;
  const path = currentPath();
  const parts = path.split('/').filter(Boolean);

  if (!state.user) {
    try { state.user = (await api('GET', '/api/auth/me')).user; } catch { /* ignore */ }
  }
  if (!state.user) {
    const setup = await api('GET', '/api/auth/setup').catch(() => ({ needs_setup: false }));
    return render(setup.needs_setup ? setupView() : loginView());
  }

  if (parts[0] === 'login' || parts.length === 0) return go('/sites');
  if (parts[0] === 'sites') return render(await sitesView());
  if (parts[0] === 'users') return render(await usersView());
  if (parts[0] === 'account') return render(accountView());
  if (parts[0] === 'site' && parts[1]) {
    const siteId = parts[1];
    if (!state.site || state.site.id !== siteId) {
      try { state.site = (await api('GET', `/api/sites/${siteId}`)).site; } catch (e) { toast(e.message, 'error'); return go('/sites'); }
    }
    const section = parts[2] || 'content';
    let view;
    if (section === 'content') {
      const name = parts[3] || Object.keys(state.site.schema.collections)[0];
      view = name ? await collectionView(state.site, name, { setDirty: state.setDirty, onSaved: () => refreshSiteHeader(siteId) }) : h('div', { class: 'empty' }, 'This site has no sections yet. Add some in Settings → Schema.');
    } else if (section === 'media') view = await mediaLibraryView(state.site, ['owner', 'editor'].includes(state.site.role));
    else if (section === 'members') view = await membersView(state.site);
    else if (section === 'settings') view = await settingsView(state.site);
    else if (section === 'history') view = await historyView(state.site);
    else view = h('div', { class: 'empty' }, 'Not found');
    return render(siteShell(state.site, section, parts[3], view));
  }
  go('/sites');
}

function render(el) { clear(app).append(el); window.scrollTo(0, 0); }

async function refreshSiteHeader(siteId) {
  try { state.site = (await api('GET', `/api/sites/${siteId}`)).site; } catch { return; }
  const el = document.getElementById('publish-state');
  if (el) el.replaceWith(publishState(state.site));
}

// ---------- shell ----------
function topbar(extra) {
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/sites' }, h('span', { class: 'logo' }, 'M'), 'Mister Admin'),
    extra,
    h('span', { class: 'spacer' }),
    state.user?.is_admin ? h('a', { href: '#/users', class: 'btn btn-ghost btn-sm' }, 'Users') : null,
    h('a', { href: '#/account', class: 'btn btn-ghost btn-sm', title: state.user?.email }, state.user?.name || state.user?.email),
    h('button', { class: 'btn btn-ghost btn-sm', onClick: async () => { await api('POST', '/api/auth/logout'); state.user = null; state.site = null; go('/login'); } }, 'Sign out')
  );
}

function page(title, content) {
  return h('div', {}, topbar(), h('div', { class: 'main', style: { margin: '0 auto' } }, title ? h('div', { class: 'page-head' }, h('h1', {}, title)) : null, content));
}

function publishState(site) {
  const canPublish = ['owner', 'editor'].includes(site.role);
  const wrap = h('span', { id: 'publish-state', class: 'row' });
  wrap.append(site.has_unpublished_changes ? h('span', { class: 'badge badge-warn' }, 'Unpublished changes') : h('span', { class: 'badge badge-ok' }, site.published_at ? 'Live' : 'Never published'));
  if (canPublish) {
    wrap.append(h('button', { class: 'btn btn-primary btn-sm', onClick: async (e) => {
      if (state.dirty) { toast('Save your changes first', 'error'); return; }
      e.target.disabled = true;
      try {
        await api('POST', `/api/sites/${site.id}/publish`);
        if (site.deploy_hook_url) await api('POST', `/api/sites/${site.id}/deploy`).catch((err) => toast(`Published, but the rebuild could not start: ${err.message}`, 'error'));
        toast('Published! The website will show the changes within a minute.', 'success');
        await refreshSiteHeader(site.id);
      } catch (err) { toast(err.message, 'error'); } finally { e.target.disabled = false; }
    } }, 'Publish'));
  }
  if (site.url) wrap.append(h('a', { href: site.url, target: '_blank', class: 'btn btn-ghost btn-sm' }, 'View site ↗'));
  return wrap;
}

function siteShell(site, section, sub, view) {
  const cols = Object.entries(site.schema.collections);
  const link = (href, label, active) => h('a', { href, class: active ? 'active' : '' }, label);
  const sidebar = h('nav', { class: 'sidebar' },
    h('h4', {}, 'Content'),
    cols.length ? cols.map(([name, c]) => link(`#/site/${site.id}/content/${name}`, c.label, section === 'content' && (sub === name || (!sub && name === cols[0][0])))) : h('p', { class: 'muted small', style: { padding: '0 .6rem' } }, 'No sections yet'),
    h('h4', {}, 'Site'),
    link(`#/site/${site.id}/media`, 'Photos', section === 'media'),
    link(`#/site/${site.id}/members`, 'People', section === 'members'),
    link(`#/site/${site.id}/history`, 'History', section === 'history'),
    site.role === 'owner' ? link(`#/site/${site.id}/settings`, 'Settings', section === 'settings') : null,
    h('h4', {}, ''),
    link('#/sites', '← All sites', false)
  );
  return h('div', {},
    topbar(h('span', { class: 'row' }, h('strong', {}, site.name), publishState(site))),
    h('div', { class: 'shell' }, sidebar, h('main', { class: 'main' }, view))
  );
}

// ---------- auth views ----------
function authCard(title, form) {
  return h('div', { class: 'centered' }, h('div', { class: 'card auth-card' }, h('div', { class: 'brand', style: { marginBottom: '1rem' } }, h('span', { class: 'logo' }, 'M'), 'Mister Admin'), h('h2', {}, title), form));
}

function loginView() {
  const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
  const pass = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Sign in');
  const form = h('form', { onSubmit: async (e) => {
    e.preventDefault(); btn.disabled = true;
    try { state.user = (await api('POST', '/api/auth/login', { email: email.value, password: pass.value })).user; go('/sites'); }
    catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
  } },
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), email),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Password'), pass),
    btn);
  return authCard('Sign in', form);
}

function setupView() {
  const name = h('input', { type: 'text', autocomplete: 'name' });
  const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
  const pass = h('input', { type: 'password', required: true, minlength: 10, autocomplete: 'new-password' });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create administrator');
  const form = h('form', { onSubmit: async (e) => {
    e.preventDefault(); btn.disabled = true;
    try { state.user = (await api('POST', '/api/auth/setup', { name: name.value, email: email.value, password: pass.value })).user; toast('Welcome! Create your first site.', 'success'); go('/sites'); }
    catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
  } },
    h('p', { class: 'muted' }, 'This is a fresh installation. Create the first administrator account.'),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Your name'), name),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), email),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Password (10+ characters)'), pass),
    btn);
  return authCard('Welcome to Mister Admin', form);
}

// ---------- sites ----------
async function sitesView() {
  state.site = null;
  const grid = h('div', { class: 'grid' });
  let sites = [];
  try { sites = (await api('GET', '/api/sites')).sites; } catch (e) { toast(e.message, 'error'); }
  if (!sites.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, state.user.is_admin ? 'No sites yet. Create your first one.' : 'You have not been given access to any site yet. Ask your administrator.'));
  for (const s of sites) {
    grid.append(h('a', { class: 'card site-card', href: `#/site/${s.id}` },
      h('h3', {}, s.name),
      h('p', { class: 'muted small' }, s.url || s.slug),
      h('div', { class: 'row' }, h('span', { class: 'badge badge-primary' }, s.role), s.has_unpublished_changes ? h('span', { class: 'badge badge-warn' }, 'Unpublished changes') : s.published_at ? h('span', { class: 'badge badge-ok' }, 'Live') : h('span', { class: 'badge' }, 'Never published'))));
  }
  const head = h('div', { class: 'page-head' }, h('h1', {}, 'Your sites'),
    state.user.is_admin ? h('button', { class: 'btn btn-primary', onClick: createSiteDialog }, '+ New site') : null);
  return h('div', {}, topbar(), h('div', { class: 'main', style: { margin: '0 auto' } }, head, grid));
}

async function createSiteDialog() {
  const name = h('input', { type: 'text', placeholder: 'My Bakery' });
  const slug = h('input', { type: 'text', placeholder: 'my-bakery', pattern: '[a-z0-9-]+' });
  const url = h('input', { type: 'url', placeholder: 'https://my-bakery.pages.dev' });
  name.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; });
  const r = await modal({ title: 'New site', body: h('div', {},
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Site name'), name),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Slug (used in the public content URL)'), slug, h('span', { class: 'help' }, 'Lowercase letters, numbers and dashes. Cannot be changed later.')),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Website address (optional)'), url),
    h('p', { class: 'small muted' }, 'The site starts with a basic example schema that you can change in Settings.')),
    actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Create', class: 'btn-primary', onClick: async () => {
      try { const res = await api('POST', '/api/sites', { name: name.value, slug: slug.value, url: url.value, schema: STARTER_SCHEMA }); go(`/site/${res.site.id}`); return true; }
      catch (e) { toast(e.message, 'error'); return false; }
    } }] });
  return r;
}

export const STARTER_SCHEMA = {
  collections: {
    settings: { label: 'Site settings', type: 'single', fields: [
      { name: 'title', type: 'text', label: 'Site title', required: true },
      { name: 'tagline', type: 'text', label: 'Tagline' },
      { name: 'logo', type: 'image', label: 'Logo' },
      { name: 'phone', type: 'text', label: 'Phone' },
      { name: 'email', type: 'text', label: 'Email' },
      { name: 'address', type: 'textarea', label: 'Address' },
    ] },
    navigation: { label: 'Menu', type: 'tree', titleField: 'label', fields: [
      { name: 'label', type: 'text', label: 'Label', required: true },
      { name: 'url', type: 'link', label: 'Link', required: true },
    ] },
    hero: { label: 'Home page banner', type: 'single', fields: [
      { name: 'heading', type: 'text', label: 'Heading', required: true },
      { name: 'text', type: 'markdown', label: 'Text' },
      { name: 'image', type: 'image', label: 'Background photo' },
      { name: 'button_label', type: 'text', label: 'Button label' },
      { name: 'button_url', type: 'link', label: 'Button link' },
    ] },
    gallery: { label: 'Photo gallery', type: 'single', fields: [
      { name: 'photos', type: 'gallery', label: 'Photos' },
    ] },
    news: { label: 'News', type: 'list', titleField: 'title', fields: [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'date', type: 'date', label: 'Date', required: true },
      { name: 'body', type: 'markdown', label: 'Text' },
      { name: 'image', type: 'image', label: 'Photo' },
      { name: 'published', type: 'boolean', label: 'Show on website' },
    ] },
  },
};

// ---------- members ----------
async function membersView(site) {
  const isOwner = site.role === 'owner';
  const table = h('table');
  const render = async () => {
    const { members } = await api('GET', `/api/sites/${site.id}/members`);
    clear(table).append(h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Email'), h('th', {}, 'Role'), h('th', {}, ''))),
      h('tbody', {}, members.map((m) => h('tr', {}, h('td', {}, m.name || '—'), h('td', {}, m.email), h('td', {}, h('span', { class: 'badge badge-primary' }, m.role)),
        h('td', { style: { textAlign: 'right' } }, isOwner ? h('button', { class: 'btn btn-sm btn-danger', onClick: async () => { if (await confirmDialog(`Remove ${m.email} from this site?`, { okLabel: 'Remove', danger: true })) { try { await api('DELETE', `/api/sites/${site.id}/members/${m.id}`); render(); } catch (e) { toast(e.message, 'error'); } } } }, 'Remove') : null)))));
  };
  await render();
  const email = h('input', { type: 'email', placeholder: 'person@example.com' });
  const role = h('select', {}, ['editor', 'owner', 'viewer'].map((r) => h('option', { value: r }, r)));
  const add = isOwner ? h('div', { class: 'card' }, h('h3', {}, 'Give someone access'),
    h('p', { class: 'small muted' }, 'The person must already have a Mister Admin account. Administrators create accounts under "Users".'),
    h('div', { class: 'row' }, email, role, h('button', { class: 'btn btn-primary', onClick: async () => { try { await api('POST', `/api/sites/${site.id}/members`, { email: email.value, role: role.value }); email.value = ''; toast('Access granted', 'success'); render(); } catch (e) { toast(e.message, 'error'); } } }, 'Add'))) : null;
  return h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'People')),
    h('div', { class: 'card' }, table),
    add,
    h('div', { class: 'card small muted' }, h('strong', {}, 'Roles: '), 'Viewer can look. Editor can change content, upload photos and publish. Owner can also change settings, the schema and who has access.'));
}

// ---------- history ----------
async function historyView(site) {
  const { entries } = await api('GET', `/api/sites/${site.id}/audit`);
  return h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'History')),
    h('div', { class: 'card' }, entries.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Who'), h('th', {}, 'What'), h('th', {}, 'Target'))),
      h('tbody', {}, entries.map((e) => h('tr', {}, h('td', { class: 'small' }, formatDate(e.created_at)), h('td', {}, e.user_email), h('td', {}, e.action), h('td', { class: 'small muted' }, e.target))))) : h('p', { class: 'muted' }, 'Nothing yet.')));
}

// ---------- settings ----------
async function settingsView(site) {
  const name = h('input', { type: 'text', value: site.name });
  const url = h('input', { type: 'url', value: site.url });
  const hook = h('input', { type: 'url', placeholder: 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/…', value: site.deploy_hook_url === '(set)' ? '' : '' });
  const schema = h('textarea', { class: 'code', spellcheck: false }, JSON.stringify(site.schema, null, 2));
  const schemaErr = h('p', { class: 'small', style: { color: 'var(--danger)' } });
  const publicUrl = `${location.origin}/api/public/${site.slug}/content`;

  const saveGeneral = async () => {
    try {
      const body = { name: name.value, url: url.value };
      if (hook.value) body.deploy_hook_url = hook.value;
      await api('PUT', `/api/sites/${site.id}`, body);
      toast('Saved', 'success'); state.site = null; route();
    } catch (e) { toast(e.message, 'error'); }
  };
  const saveSchema = async () => {
    schemaErr.textContent = '';
    let parsed;
    try { parsed = JSON.parse(schema.value); } catch (e) { schemaErr.textContent = `Not valid JSON: ${e.message}`; return; }
    if (!(await confirmDialog('Changing the schema can hide content whose fields were removed. Continue?'))) return;
    try { await api('PUT', `/api/sites/${site.id}`, { schema: parsed }); toast('Schema saved', 'success'); state.site = null; route(); }
    catch (e) { schemaErr.textContent = e.message; toast(e.message, 'error'); }
  };

  const importInput = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onChange: async () => {
    const f = importInput.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await confirmDialog('Importing replaces the draft content of this site with the file. Continue?', { okLabel: 'Import', danger: true }))) return;
      await api('POST', `/api/sites/${site.id}/import`, data);
      toast('Imported. Review the content and publish.', 'success'); state.site = null; route();
    } catch (e) { toast(e.message, 'error'); } finally { importInput.value = ''; }
  } });

  return h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('div', { class: 'card' }, h('h3', {}, 'General'),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Site name'), name),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Website address'), url),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Cloudflare Pages deploy hook (optional)'), hook,
        h('span', { class: 'help' }, site.deploy_hook_url === '(set)' ? 'A deploy hook is set. Enter a new one to replace it. ' : '', 'Only needed if your site bakes content in at build time. Publishing will then also trigger a rebuild.')),
      h('button', { class: 'btn btn-primary', onClick: saveGeneral }, 'Save')),
    h('div', { class: 'card' }, h('h3', {}, 'Connect your website'),
      h('p', { class: 'small' }, 'Your website reads its published content from this address:'),
      h('p', {}, h('code', {}, publicUrl)),
      h('p', { class: 'small muted' }, 'See docs/05-connecting-a-site.md in the Mister Admin repository for the one-line script that fills your pages.')),
    h('div', { class: 'card' }, h('h3', {}, 'Schema'),
      h('p', { class: 'small muted' }, 'The schema defines which sections and fields this site has. See docs/04-schema-format.md.'),
      schema, schemaErr,
      h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn btn-primary', onClick: saveSchema }, 'Save schema'),
        h('button', { class: 'btn', onClick: () => { schema.value = JSON.stringify(STARTER_SCHEMA, null, 2); } }, 'Reset to starter example'))),
    h('div', { class: 'card' }, h('h3', {}, 'Backup'),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: `/api/sites/${site.id}/export`, download: `${site.slug}-export.json` }, 'Download backup (JSON)'),
        h('button', { class: 'btn', onClick: () => importInput.click() }, 'Restore from backup…'), importInput)),
    state.user.is_admin ? h('div', { class: 'card' }, h('h3', {}, 'Danger zone'),
      h('button', { class: 'btn btn-danger', onClick: async () => {
        if (!(await confirmDialog(`Delete "${site.name}" and ALL its content and photos? This cannot be undone.`, { okLabel: 'Delete site', danger: true }))) return;
        const typed = prompt(`Type the slug "${site.slug}" to confirm`);
        if (typed !== site.slug) return;
        try { await api('DELETE', `/api/sites/${site.id}`); toast('Site deleted'); go('/sites'); } catch (e) { toast(e.message, 'error'); }
      } }, 'Delete this site')) : null);
}

// ---------- users (admin) ----------
async function usersView() {
  if (!state.user.is_admin) return go('/sites');
  const table = h('table');
  const render = async () => {
    const { users } = await api('GET', '/api/users');
    clear(table).append(h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Email'), h('th', {}, 'Admin'), h('th', {}, 'Sites'), h('th', {}, ''))),
      h('tbody', {}, users.map((u) => h('tr', {}, h('td', {}, u.name || '—'), h('td', {}, u.email), h('td', {}, u.is_admin ? h('span', { class: 'badge badge-primary' }, 'admin') : ''), h('td', {}, String(u.site_count)),
        h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
          h('button', { class: 'btn btn-sm', onClick: () => editUser(u).then(render) }, 'Edit'),
          ' ',
          u.id !== state.user.id ? h('button', { class: 'btn btn-sm btn-danger', onClick: async () => { if (await confirmDialog(`Delete user ${u.email}?`, { okLabel: 'Delete', danger: true })) { try { await api('DELETE', `/api/users/${u.id}`); render(); } catch (e) { toast(e.message, 'error'); } } } }, 'Delete') : null)))));
  };
  await render();
  return page('Users', h('div', {},
    h('div', { class: 'row', style: { marginBottom: '1rem' } }, h('button', { class: 'btn btn-primary', onClick: () => createUser().then(render) }, '+ New user')),
    h('div', { class: 'card' }, table),
    h('div', { class: 'card small muted' }, 'After creating a user, open a site → People to give them access to that site. Administrators automatically have access to every site.')));
}

function userForm(u = {}) {
  const name = h('input', { type: 'text', value: u.name || '', autocomplete: 'off' });
  const email = h('input', { type: 'email', value: u.email || '', disabled: !!u.id, autocomplete: 'off' });
  const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: u.id ? 'Leave empty to keep the current password' : 'At least 10 characters' });
  const admin = h('input', { type: 'checkbox', checked: !!u.is_admin, disabled: u.id === state.user.id });
  const body = h('div', {},
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Name'), name),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), email),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, u.id ? 'New password' : 'Password'), pass),
    h('label', { class: 'check' }, admin, h('span', {}, 'Administrator (can manage all sites and users)')));
  return { body, values: () => ({ name: name.value, email: email.value, password: pass.value, is_admin: admin.checked }) };
}

async function createUser() {
  const f = userForm();
  await modal({ title: 'New user', body: f.body, actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Create', class: 'btn-primary', onClick: async () => {
    try { await api('POST', '/api/users', f.values()); toast('User created. Tell them their email and password.', 'success'); return true; } catch (e) { toast(e.message, 'error'); return false; }
  } }] });
}

async function editUser(u) {
  const f = userForm(u);
  await modal({ title: `Edit ${u.email}`, body: f.body, actions: [{ label: 'Cancel', value: null, class: 'btn-ghost' }, { label: 'Save', class: 'btn-primary', onClick: async () => {
    const v = f.values();
    const body = { name: v.name, is_admin: v.is_admin };
    if (v.password) body.password = v.password;
    try { await api('PUT', `/api/users/${u.id}`, body); toast('Saved', 'success'); return true; } catch (e) { toast(e.message, 'error'); return false; }
  } }] });
}

// ---------- account ----------
function accountView() {
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', minlength: 10 });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Change password');
  return page('Your account', h('div', { class: 'card', style: { maxWidth: '480px' } },
    h('p', {}, h('strong', {}, state.user.name || ''), ' ', h('span', { class: 'muted' }, state.user.email)),
    h('form', { onSubmit: async (e) => { e.preventDefault(); btn.disabled = true; try { await api('PUT', '/api/auth/password', { current_password: cur.value, new_password: nw.value }); toast('Password changed', 'success'); cur.value = nw.value = ''; } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; } } },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Current password'), cur),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'New password (10+ characters)'), nw),
      btn)));
}

route();
