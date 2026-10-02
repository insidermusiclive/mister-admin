-- Mister Admin database schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  last_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL DEFAULT '',
  schema_json     TEXT NOT NULL DEFAULT '{"collections":{}}',
  deploy_hook_url TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  published_at    TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (user_id, site_id)
);

-- Draft content. One row per collection (the whole collection is stored as JSON).
CREATE TABLE IF NOT EXISTS content (
  site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  PRIMARY KEY (site_id, collection)
);

-- Published content. Public websites read from this table only.
CREATE TABLE IF NOT EXISTS published (
  site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  collection   TEXT NOT NULL,
  data_json    TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (site_id, collection)
);

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL DEFAULT '',
  alt           TEXT NOT NULL DEFAULT '',
  width         INTEGER NOT NULL DEFAULT 0,
  height        INTEGER NOT NULL DEFAULT 0,
  variants_json TEXT NOT NULL DEFAULT '[]',
  placeholder   TEXT NOT NULL DEFAULT '',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    TEXT
);
CREATE INDEX IF NOT EXISTS media_site ON media(site_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    TEXT,
  user_id    TEXT,
  user_email TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS audit_site ON audit_log(site_id, created_at);
