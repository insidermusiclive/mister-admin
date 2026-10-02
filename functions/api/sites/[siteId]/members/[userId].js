import { json, HttpError } from '../../../../_lib/http.js';
import { requireSiteRole, audit } from '../../../../_lib/auth.js';

export async function onRequestDelete({ env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'owner');
  if (params.userId === user.id && !user.is_admin) throw new HttpError(400, 'You cannot remove yourself from a site');
  await env.DB.prepare('DELETE FROM memberships WHERE site_id = ? AND user_id = ?').bind(site.id, params.userId).run();
  await audit(env, { site_id: site.id, user, action: 'member.remove', target: params.userId });
  return json({ ok: true });
}
