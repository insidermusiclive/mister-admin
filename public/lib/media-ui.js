// Media library screen + image picker modal + the upload queue.
import { h, clear, toast, modal, confirmDialog, bytes, formatDate } from './dom.js';
import { api, upload } from './api.js';
import { processImage, buildUploadForm, isSupportedImage } from './image.js';

const MAX_PARALLEL = 2;

/**
 * Uploads a list of File objects for a site. Calls onItem(mediaObject) per success.
 * Renders progress into `host`. Returns when all are done.
 */
export async function uploadFiles(siteId, files, host, onItem) {
  const list = [...files].filter((f) => f.size > 0);
  if (!list.length) return;
  const rows = list.map((f) => {
    const bar = h('div', {}, '');
    const status = h('span', { class: 'muted small' }, 'Waiting…');
    const el = h('div', { class: 'card compact' }, h('div', { class: 'row' }, h('strong', {}, f.name), h('span', { class: 'muted small' }, bytes(f.size)), h('span', { class: 'spacer' }), status), h('div', { class: 'progress' }, bar));
    host.append(el);
    return { f, el, bar, status };
  });
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      try {
        if (!isSupportedImage(r.f)) throw new Error('Not a supported image type');
        const processed = await processImage(r.f, { onStatus: (t) => { r.status.textContent = t; } });
        r.status.textContent = 'Uploading…';
        const fd = buildUploadForm(processed, '');
        const res = await upload(`/api/sites/${siteId}/media`, fd, (p) => { r.bar.style.width = `${Math.round(p * 100)}%`; });
        r.bar.style.width = '100%';
        const saved = processed.variants.reduce((a, v) => a + v.blob.size, 0);
        r.status.textContent = `Done (${bytes(r.f.size)} → ${bytes(saved)})`;
        r.status.className = 'small';
        r.status.style.color = 'var(--ok)';
        onItem?.(res.media);
        setTimeout(() => r.el.remove(), 4000);
      } catch (e) {
        r.status.textContent = `Failed: ${e.message}`;
        r.status.style.color = 'var(--danger)';
        r.bar.style.background = 'var(--danger)';
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, rows.length) }, worker));
}

export function dropzone(onFiles, label = 'Drop photos here, or click to choose') {
  const input = h('input', { type: 'file', accept: 'image/*,.heic,.heif', multiple: true, class: 'hidden', onChange: () => { onFiles(input.files); input.value = ''; } });
  const dz = h('div', { class: 'dropzone', tabindex: 0, role: 'button',
    onClick: () => input.click(),
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); },
    onDragover: (e) => { e.preventDefault(); dz.classList.add('over'); },
    onDragleave: () => dz.classList.remove('over'),
    onDrop: (e) => { e.preventDefault(); dz.classList.remove('over'); onFiles(e.dataTransfer.files); },
  }, h('div', {}, '📷 ', label), h('div', { class: 'small' }, 'JPG, PNG, HEIC (iPhone), WebP, GIF, TIFF. Photos are resized and converted in your browser before upload.'), input);
  return dz;
}

export function mediaTile(m, { selected = false, onClick } = {}) {
  const t = h('div', { class: `media-tile${selected ? ' selected' : ''}`, onClick, title: m.original_name },
    h('img', { src: m.src[480] || m.url, alt: m.alt, loading: 'lazy' }),
    h('div', { class: 'meta' }, m.alt || m.original_name)
  );
  return t;
}

/** The Media library page. */
export async function mediaLibraryView(site, canEdit) {
  const root = h('div');
  const grid = h('div', { class: 'media-grid' });
  const queue = h('div');
  let media = [];

  const render = () => {
    clear(grid);
    if (!media.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'No photos yet.'));
    for (const m of media) grid.append(mediaTile(m, { onClick: () => openDetails(m) }));
  };

  const openDetails = async (m) => {
    const alt = h('input', { type: 'text', value: m.alt, placeholder: 'Describe the photo (used for accessibility and SEO)', disabled: !canEdit });
    const body = h('div', {},
      h('img', { src: m.src[1200] || m.url, alt: m.alt, style: { width: '100%', borderRadius: '8px', marginBottom: '.75rem' } }),
      h('p', { class: 'small muted' }, `${m.original_name} · ${m.width}×${m.height} · ${bytes(m.size_bytes)} total · ${formatDate(m.created_at)}`),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alt text'), alt),
      h('p', { class: 'small muted' }, 'Sizes: ', Object.keys(m.src).map((w) => h('a', { href: m.src[w], target: '_blank', style: { marginRight: '.5rem' } }, `${w}px`)))
    );
    const actions = [{ label: 'Close', value: null, class: 'btn-ghost' }];
    if (canEdit) {
      actions.unshift({ label: 'Delete', class: 'btn-danger', onClick: async () => {
        if (!(await confirmDialog('Delete this photo? Pages that use it will lose the image.', { okLabel: 'Delete', danger: true }))) return false;
        try {
          await api('DELETE', `/api/sites/${site.id}/media/${m.media_id}`);
        } catch (e) {
          if (e.status === 409) {
            const force = await confirmDialog(`${e.message}. Delete anyway? Those places will show no image.`, { okLabel: 'Delete anyway', danger: true });
            if (!force) return false;
            await api('DELETE', `/api/sites/${site.id}/media/${m.media_id}?force=1`);
          } else { toast(e.message, 'error'); return false; }
        }
        media = media.filter((x) => x.media_id !== m.media_id);
        render();
        toast('Photo deleted', 'success');
        return true;
      } });
      actions.push({ label: 'Save', class: 'btn-primary', onClick: async () => {
        try {
          const r = await api('PUT', `/api/sites/${site.id}/media/${m.media_id}`, { alt: alt.value });
          Object.assign(m, r.media);
          render();
          toast('Saved', 'success');
          return true;
        } catch (e) { toast(e.message, 'error'); return false; }
      } });
    }
    await modal({ title: 'Photo', body, actions });
  };

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Photos'), h('span', { class: 'badge' }, `${media.length}`)));
  if (canEdit) root.append(dropzone((files) => uploadFiles(site.id, files, queue, (m) => { media.unshift(m); render(); })), queue);
  root.append(grid);

  try {
    media = (await api('GET', `/api/sites/${site.id}/media`)).media;
    root.querySelector('.badge').textContent = String(media.length);
  } catch (e) { toast(e.message, 'error'); }
  render();
  return root;
}

/** Opens a picker. Resolves with a media object, or null. */
export function pickImage(site, { multiple = false } = {}) {
  return new Promise(async (resolve) => {
    const grid = h('div', { class: 'media-grid' });
    const queue = h('div');
    const selected = new Map();
    let media = [];
    const render = () => {
      clear(grid);
      if (!media.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'No photos yet. Upload one above.'));
      for (const m of media) {
        grid.append(mediaTile(m, { selected: selected.has(m.media_id), onClick: () => {
          if (!multiple) { overlayResolve(m); return; }
          if (selected.has(m.media_id)) selected.delete(m.media_id); else selected.set(m.media_id, m);
          render();
        } }));
      }
    };
    let overlayResolve = () => {};
    const body = h('div', {}, dropzone((files) => uploadFiles(site.id, files, queue, (m) => { media.unshift(m); if (multiple) selected.set(m.media_id, m); render(); })), queue, grid);
    const p = modal({ title: multiple ? 'Choose photos' : 'Choose a photo', body, wide: true, actions: multiple ? [
      { label: 'Cancel', value: null, class: 'btn-ghost' },
      { label: 'Add selected', value: 'ok', class: 'btn-primary' },
    ] : [{ label: 'Cancel', value: null, class: 'btn-ghost' }] });
    const overlay = document.querySelector('.overlay:last-of-type');
    overlayResolve = (m) => { overlay.close(m); };
    try { media = (await api('GET', `/api/sites/${site.id}/media`)).media; } catch (e) { toast(e.message, 'error'); }
    render();
    const r = await p;
    if (multiple) resolve(r === 'ok' ? [...selected.values()] : null);
    else resolve(r && r.media_id ? r : null);
  });
}
