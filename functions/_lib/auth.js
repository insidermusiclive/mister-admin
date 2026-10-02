// Authentication: password hashing (PBKDF2 via WebCrypto), sessions, role checks.
import { HttpError, nowIso } from './http.js';

const PBKDF2_ITERATIONS = 100000;
const COOKIE_NAME = 'ma_session';

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
}

export function randomId() {
  return crypto.randomUUID();
}

export function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return toHex(b);
}

async function derive(password, saltBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt);
  return { salt: toHex(salt), hash };
}

export async function verifyPassword(password, salt, expectedHash) {
  const hash = await derive(password, fromHex(salt));
  if (hash.length !== expectedHash.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw new HttpError(400, 'Password must be at least 10 characters');
  }
  if (password.length > 200) throw new HttpError(400, 'Password is too long');
}

// ---- Sessions -------------------------------------------------------------

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(sessionId, maxAgeSeconds, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(request) {
  return sessionCookie('', 0, request);
}

export async function createSession(env, userId) {
  const days = Number(env.SESSION_DAYS || 30);
  const id = randomToken(32);
  const expires = new Date(Date.now() + days * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(id, userId, expires).run();
  return { id, maxAge: days * 86400 };
}

export async function destroySession(env, request) {
  const id = parseCookies(request)[COOKIE_NAME];
  if (id) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

export async function getSessionUser(env, request) {
  const id = parseCookies(request)[COOKIE_NAME];
  if (!id) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.is_admin, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
  ).bind(id).first();
  if (!row) return null;
  if (row.expires_at < nowIso()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, is_admin: !!row.is_admin };
}

// ---- Login rate limiting ----------------------------------------------------

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

export async function checkLoginAllowed(env, key) {
  const row = await env.DB.prepare('SELECT count, last_at FROM login_attempts WHERE key = ?').bind(key).first();
  if (!row) return;
  const ageMs = Date.now() - new Date(row.last_at.replace(' ', 'T') + 'Z').getTime();
  if (row.count >= MAX_ATTEMPTS && ageMs < WINDOW_MINUTES * 60 * 1000) {
    throw new HttpError(429, `Too many failed logins. Try again in ${WINDOW_MINUTES} minutes.`);
  }
}

export async function recordLoginFailure(env, key) {
  await env.DB.prepare(
    `INSERT INTO login_attempts (key, count, last_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN (strftime('%s','now') - strftime('%s', last_at)) > ? THEN 1 ELSE count + 1 END,
       last_at = excluded.last_at`
  ).bind(key, nowIso(), WINDOW_MINUTES * 60).run();
}

export async function clearLoginFailures(env, key) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}

// ---- Authorization ----------------------------------------------------------

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

export function requireUser(data) {
  if (!data.user) throw new HttpError(401, 'Not signed in');
  return data.user;
}

export function requireAdmin(data) {
  const user = requireUser(data);
  if (!user.is_admin) throw new HttpError(403, 'Administrator access required');
  return user;
}

/**
 * Loads the site and checks the user has at least `minRole` on it.
 * Administrators have owner rights on every site.
 */
export async function requireSiteRole(env, data, siteId, minRole = 'viewer') {
  const user = requireUser(data);
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
  if (!site) throw new HttpError(404, 'Site not found');
  let role = 'owner';
  if (!user.is_admin) {
    const m = await env.DB.prepare('SELECT role FROM memberships WHERE user_id = ? AND site_id = ?').bind(user.id, siteId).first();
    if (!m) throw new HttpError(403, 'You do not have access to this site');
    role = m.role;
  }
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new HttpError(403, `This action requires the "${minRole}" role`);
  }
  return { user, site, role };
}

export async function audit(env, { site_id = null, user, action, target = '' }) {
  await env.DB.prepare(
    'INSERT INTO audit_log (site_id, user_id, user_email, action, target) VALUES (?, ?, ?, ?, ?)'
  ).bind(site_id, user?.id || null, user?.email || '', action, String(target).slice(0, 300)).run();
}
