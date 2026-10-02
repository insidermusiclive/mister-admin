// Small HTTP helpers shared by all API routes.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export async function readJson(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Expected application/json');
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function requireString(obj, key, { min = 1, max = 500, optional = false } = {}) {
  const v = obj?.[key];
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw new HttpError(400, `Field "${key}" is required`);
  }
  if (typeof v !== 'string') throw new HttpError(400, `Field "${key}" must be a string`);
  const t = v.trim();
  if (t.length < min) throw new HttpError(400, `Field "${key}" is too short`);
  if (t.length > max) throw new HttpError(400, `Field "${key}" is too long (max ${max})`);
  return t;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidSlug(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug);
}

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
