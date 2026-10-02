// Full backup of a site: schema, draft content, media index. Images themselves stay in R2.
import { json } from '../../../_lib/http.js';
import { requireSiteRole } from '../../../_lib/auth.js';
import { parseSchema } from '../../../_lib/schema.js';

export async function onRequestGet({ env, data, params }) {
  const { site } = await requireSiteRole(env, data, params.siteId, 'viewer');
  const content = {};
  for (const r of (await env.DB.prepare('SELECT collection, data_json FROM content WHERE site_id = ?').bind(site.id).all()).results) {
    content[r.collection] = JSON.parse(r.data_json);
  }
  const media = (await env.DB.prepare('SELECT * FROM media WHERE site_id = ?').bind(site.id).all()).results
    .map((m) => ({ ...m, variants: JSON.parse(m.variants_json), variants_json: undefined }));
  return json({
    format: 'mister-admin-export/1',
    exported_at: new Date().toISOString(),
    site: { slug: site.slug, name: site.name, url: site.url },
    schema: parseSchema(site),
    content,
    media,
  }, 200, { 'content-disposition': `attachment; filename="${site.slug}-export.json"` });
}
