// Mister Admin - Cloudflare Worker entry point.
// Serves the admin UI from static assets (public/), runs the API, serves photos from R2,
// and creates the database tables on first use so installation needs no manual steps.
import schemaSql from '../migrations/0001_init.sql';
import { onRequest as middleware } from '../functions/_middleware.js';
import { json } from '../functions/_lib/http.js';

import * as authSetup from '../functions/api/auth/setup.js';
import * as authLogin from '../functions/api/auth/login.js';
import * as authLogout from '../functions/api/auth/logout.js';
import * as authMe from '../functions/api/auth/me.js';
import * as authPassword from '../functions/api/auth/password.js';
import * as users from '../functions/api/users/index.js';
import * as user from '../functions/api/users/[userId].js';
import * as sites from '../functions/api/sites/index.js';
import * as site from '../functions/api/sites/[siteId]/index.js';
import * as members from '../functions/api/sites/[siteId]/members/index.js';
import * as member from '../functions/api/sites/[siteId]/members/[userId].js';
import * as content from '../functions/api/sites/[siteId]/content/index.js';
import * as collection from '../functions/api/sites/[siteId]/content/[collection].js';
import * as media from '../functions/api/sites/[siteId]/media/index.js';
import * as mediaItem from '../functions/api/sites/[siteId]/media/[mediaId].js';
import * as publish from '../functions/api/sites/[siteId]/publish.js';
import * as deploy from '../functions/api/sites/[siteId]/deploy.js';
import * as audit from '../functions/api/sites/[siteId]/audit.js';
import * as exportRoute from '../functions/api/sites/[siteId]/export.js';
import * as importRoute from '../functions/api/sites/[siteId]/import.js';
import * as publicContent from '../functions/api/public/[slug]/content.js';
import * as mediaFile from '../functions/media/[[path]].js';

// Same routes as the Pages file-based layout, written out explicitly.
const ROUTES = [
  ['/api/auth/setup', authSetup],
  ['/api/auth/login', authLogin],
  ['/api/auth/logout', authLogout],
  ['/api/auth/me', authMe],
  ['/api/auth/password', authPassword],
  ['/api/users', users],
  ['/api/users/:userId', user],
  ['/api/sites', sites],
  ['/api/sites/:siteId', site],
  ['/api/sites/:siteId/members', members],
  ['/api/sites/:siteId/members/:userId', member],
  ['/api/sites/:siteId/content', content],
  ['/api/sites/:siteId/content/:collection', collection],
  ['/api/sites/:siteId/media', media],
  ['/api/sites/:siteId/media/:mediaId', mediaItem],
  ['/api/sites/:siteId/publish', publish],
  ['/api/sites/:siteId/deploy', deploy],
  ['/api/sites/:siteId/audit', audit],
  ['/api/sites/:siteId/export', exportRoute],
  ['/api/sites/:siteId/import', importRoute],
  ['/api/public/:slug/content', publicContent],
  ['/media/*path', mediaFile],
].map(([pattern, mod]) => {
  const names = [];
  const re = new RegExp('^' + pattern.replace(/\*(\w+)/g, (_, n) => { names.push([n, true]); return '(.+)'; }).replace(/:(\w+)/g, (_, n) => { names.push([n, false]); return '([^/]+)'; }) + '/?$');
  return { re, names, mod };
});

function match(pathname) {
  for (const r of ROUTES) {
    const m = r.re.exec(pathname);
    if (!m) continue;
    const params = {};
    r.names.forEach(([n, splat], i) => { params[n] = splat ? decodeURIComponent(m[i + 1]).split('/') : decodeURIComponent(m[i + 1]); });
    return { mod: r.mod, params };
  }
  return null;
}

const METHOD_HANDLER = { GET: 'onRequestGet', HEAD: 'onRequestGet', POST: 'onRequestPost', PUT: 'onRequestPut', DELETE: 'onRequestDelete', OPTIONS: 'onRequestOptions' };

// ---- first-run database setup -----------------------------------------------
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
      if (row) return;
      const statements = schemaSql
        .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
        .split(';').map((s) => s.trim()).filter(Boolean);
      await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isApi = path.startsWith('/api/') || path.startsWith('/media/');

    if (!isApi) {
      // Static admin UI. Unknown paths fall back to the app shell.
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }

    if (!env.DB || !env.MEDIA) return json({ error: 'Server is not configured: D1 (DB) and R2 (MEDIA) bindings are required' }, 500);
    try { await ensureSchema(env); } catch (e) { console.error('Schema setup failed', e); return json({ error: 'Database setup failed: ' + (e.message || e) }, 500); }

    const found = match(path);
    const context = {
      request, env, params: found ? found.params : {}, data: {},
      waitUntil: (p) => ctx.waitUntil(p),
      next: async () => {
        if (!found) return json({ error: 'Not found' }, 404);
        const handler = found.mod[METHOD_HANDLER[request.method]] || found.mod.onRequest;
        if (!handler) return json({ error: 'Method not allowed' }, 405);
        return handler(context);
      },
    };
    return middleware(context);
  },
};
