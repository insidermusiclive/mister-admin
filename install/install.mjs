#!/usr/bin/env node
// Mister Admin installer. Puts Mister Admin into YOUR OWN Cloudflare account.
// Run via install-mac.command, install-windows.bat, or:  node install/install.mjs
//
// What it does, step by step:
//   1. checks Node.js, installs the one dependency (wrangler)
//   2. logs you into Cloudflare (opens a browser window, you click Allow)
//   3. creates the database (D1) and the photo storage (R2) in your account
//   4. deploys Mister Admin and prints your personal admin address
// Running it again is safe: existing resources are reused.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';
const npm = isWin ? 'npm.cmd' : 'npm';

const log = (m) => console.log(`\n▶ ${m}`);
const fail = (m) => { console.error(`\n✘ ${m}\n`); pause(); process.exit(1); };
function pause() {
  if (!process.stdin.isTTY) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question('\nPress Enter to close this window… ', () => { rl.close(); r(); }));
}
function run(cmd, args, { capture = false, allowFail = false } = {}) {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  if (DRY) return { status: 0, stdout: '' };
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8', shell: isWin });
  if (r.status !== 0 && !allowFail) fail(`Command failed: ${cmd} ${args.join(' ')}\n${(r.stderr || '') + (r.stdout || '')}`);
  return { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
}

console.log('\n==============================\n   Mister Admin installer\n==============================');
console.log('This installs Mister Admin into your own Cloudflare account (free plan is enough).');

// 1. Node
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) fail(`Node.js 18 or newer is required (you have ${process.versions.node}). Download it from https://nodejs.org`);
log(`Node.js ${process.versions.node} found`);

if (!existsSync(join(ROOT, 'node_modules', 'wrangler'))) {
  log('Installing the Cloudflare tool (wrangler). This takes a minute…');
  run(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error']);
}

// 2. Login
log('Checking Cloudflare login…');
const who = run(npx, ['wrangler', 'whoami'], { capture: true, allowFail: true });
if (!/account/i.test(who.stdout) || /not authenticated|You are not logged in/i.test(who.stdout)) {
  log('A browser window will open. Log into Cloudflare and click "Allow".');
  run(npx, ['wrangler', 'login']);
}

// 3. Database
log('Creating the database (D1)…');
let dbId = null;
const list = run(npx, ['wrangler', 'd1', 'list', '--json'], { capture: true, allowFail: true });
try {
  const arr = JSON.parse(list.stdout.slice(list.stdout.indexOf('[')));
  const found = arr.find((d) => d.name === 'mister-admin');
  if (found) { dbId = found.uuid; console.log('  Database already exists, reusing it.'); }
} catch { /* fall through */ }
if (!dbId) {
  const created = run(npx, ['wrangler', 'd1', 'create', 'mister-admin'], { capture: true });
  console.log(created.stdout);
  const m = /database_id\s*=\s*"([0-9a-f-]{36})"|"database_id":\s*"([0-9a-f-]{36})"/.exec(created.stdout);
  dbId = m ? (m[1] || m[2]) : null;
  if (!dbId && !DRY) fail('Could not read the database id from wrangler output. Create it manually: see docs/03-setup-cloudflare.md');
}
const tomlPath = join(ROOT, 'wrangler.toml');
let toml = readFileSync(tomlPath, 'utf8');
if (dbId) {
  toml = toml.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${dbId}"`);
  if (!DRY) writeFileSync(tomlPath, toml);
  console.log(`  database_id = ${dbId}`);
}

// 4. Photo storage
log('Creating the photo storage (R2)…');
const r2 = run(npx, ['wrangler', 'r2', 'bucket', 'create', 'mister-admin-media'], { capture: true, allowFail: true });
if (r2.status !== 0) {
  if (/already exists/i.test(r2.stdout)) console.log('  Bucket already exists, reusing it.');
  else if (/enable R2|not enabled|10042/i.test(r2.stdout)) fail('R2 is not enabled on your Cloudflare account yet.\n  Open https://dash.cloudflare.com → R2 → "Purchase R2" (free up to 10 GB; Cloudflare may ask for a card but will not charge within the free limits).\n  Then run this installer again.');
  else fail(`Could not create the R2 bucket:\n${r2.stdout}`);
}

// 5. Deploy
log('Deploying Mister Admin…');
const dep = run(npx, ['wrangler', 'deploy'], { capture: true });
console.log(dep.stdout);
const urlMatch = /https:\/\/[a-z0-9.-]+\.workers\.dev/i.exec(dep.stdout);
const url = urlMatch ? urlMatch[0] : null;

console.log('\n==============================');
console.log('   Done!');
console.log('==============================');
if (url) {
  console.log(`\nYour Mister Admin: ${url}`);
  console.log('Open it in your browser and create your administrator account on the Welcome screen.');
  console.log('Bookmark that address. It is yours alone.');
  if (!DRY) {
    const open = isWin ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawnSync(open[0], open[1], { stdio: 'ignore', shell: isWin });
  }
} else {
  console.log('\nDeployed. Find the address in https://dash.cloudflare.com → Workers & Pages → mister-admin.');
}
console.log('\nTo update later: download the new version and run this installer again.');
await pause();
