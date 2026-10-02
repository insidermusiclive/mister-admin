// Triggers the site's Cloudflare Pages deploy hook (only needed for sites that bake content at build time).
import { json, HttpError } from '../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../_lib/auth.js';

export async function onRequestPost({ env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'editor');
  if (!site.deploy_hook_url) throw new HttpError(400, 'No deploy hook configured for this site');
  const res = await fetch(site.deploy_hook_url, { method: 'POST' });
  if (!res.ok) throw new HttpError(502, `Deploy hook failed (${res.status})`);
  await audit(env, { site_id: site.id, user, action: 'site.deploy' });
  return json({ ok: true });
}
