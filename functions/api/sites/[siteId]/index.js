import { json, readJson, requireString, HttpError } from '../../../_lib/http.js';
import { requireSiteRole, requireAdmin, audit } from '../../../_lib/auth.js';
import { validateSchema, parseSchema } from '../../../_lib/schema.js';

export async function onRequestGet({ env, data, params }) {
  const { site, role } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const upd = await env.DB.prepare('SELECT MAX(updated_at) AS updated_at FROM content WHERE site_id = ?').bind(site.id).first();
  return json({
    site: {
      id: site.id, slug: site.slug, name: site.name, url: site.url,
      deploy_hook_url: site.deploy_hook_url ? '(set)' : '',
      schema: parseSchema(site),
      published_at: site.published_at,
      updated_at: upd.updated_at,
      has_unpublished_changes: !!upd.updated_at && (!site.published_at || upd.updated_at > site.published_at),
      role,
    },
  });
}

export async function onRequestPut({ request, env, data, params }) {
  const { user, site } = await requireSiteRole(env, data, params.siteId, 'owner');
  const body = await readJson(request);
  const name = body.name !== undefined ? requireString(body, 'name', { max: 100 }) : site.name;
  const url = body.url !== undefined ? requireString(body, 'url', { max: 500, optional: true }) : site.url;
  let hook = site.deploy_hook_url;
  if (body.deploy_hook_url !== undefined) {
    hook = requireString(body, 'deploy_hook_url', { max: 500, optional: true });
    if (hook && !/^https:\/\/api\.cloudflare\.com\/client\/v4\/pages\/webhooks\/deploy_hooks\//.test(hook)) {
      throw new HttpError(400, 'Deploy hook must be a Cloudflare Pages deploy hook URL');
    }
  }
  let schemaJson = site.schema_json;
  if (body.schema !== undefined) {
    schemaJson = JSON.stringify(validateSchema(body.schema));
    await audit(env, { site_id: site.id, user, action: 'site.update_schema' });
  }
  await env.DB.prepare('UPDATE sites SET name = ?, url = ?, deploy_hook_url = ?, schema_json = ? WHERE id = ?')
    .bind(name, url, hook, schemaJson, site.id).run();
  await audit(env, { site_id: site.id, user, action: 'site.update' });
  return json({ ok: true });
}

export async function onRequestDelete({ env, data, params }) {
  const admin = requireAdmin(data);
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(params.siteId).first();
  if (!site) throw new HttpError(404, 'Site not found');
  // Remove media objects from R2 first.
  const { results } = await env.DB.prepare('SELECT variants_json FROM media WHERE site_id = ?').bind(site.id).all();
  const keys = [];
  for (const r of results) { try { for (const v of JSON.parse(r.variants_json)) keys.push(v.key); } catch { /* ignore */ } }
  for (let i = 0; i < keys.length; i += 100) await env.MEDIA.delete(keys.slice(i, i + 100));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM media WHERE site_id = ?').bind(site.id),
    env.DB.prepare('DELETE FROM content WHERE site_id = ?').bind(site.id),
    env.DB.prepare('DELETE FROM published WHERE site_id = ?').bind(site.id),
    env.DB.prepare('DELETE FROM memberships WHERE site_id = ?').bind(site.id),
    env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(site.id),
  ]);
  await audit(env, { user: admin, action: 'site.delete', target: site.slug });
  return json({ ok: true });
}
