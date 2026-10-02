// Runs before every function: session lookup, CSRF guard, CORS for the public API,
// and uniform error responses.
import { HttpError, json } from './_lib/http.js';
import { getSessionUser } from './_lib/auth.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path.startsWith('/api/public/') || path.startsWith('/media/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const res = await context.next();
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
      return out;
    }

    if (path.startsWith('/api/')) {
      if (!env.DB || !env.MEDIA) throw new HttpError(500, 'Server is not configured: D1 (DB) and R2 (MEDIA) bindings are required');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        // The admin UI always sends this header; plain HTML forms from other sites cannot.
        if (request.headers.get('x-requested-with') !== 'MisterAdmin') throw new HttpError(403, 'Missing request header');
      }
      context.data.user = await getSessionUser(env, request);
      const res = await context.next();
      res.headers.set('cache-control', 'no-store');
      return res;
    }

    return await context.next();
  } catch (e) {
    if (e instanceof HttpError) {
      return json({ error: e.message, details: e.details }, e.status, { 'cache-control': 'no-store' });
    }
    console.error('Unhandled error', e && e.stack ? e.stack : e);
    return json({ error: 'Internal server error' }, 500, { 'cache-control': 'no-store' });
  }
}
