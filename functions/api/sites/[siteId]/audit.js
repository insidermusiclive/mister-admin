import { json } from '../../../_lib/http.js';
import { requireSiteRole } from '../../../_lib/auth.js';

export async function onRequestGet({ env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const { results } = await env.DB.prepare(
    'SELECT user_email, action, target, created_at FROM audit_log WHERE site_id = ? ORDER BY id DESC LIMIT 200'
  ).bind(site.id).all();
  return json({ entries: results });
}
