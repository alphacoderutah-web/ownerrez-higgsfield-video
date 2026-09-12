/**
 * Shared helpers: argument parsing, .env loading, and locating the Higgsfield CLI, ffmpeg and
 * the OwnerRez API. No dependencies beyond Node 18+.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

export function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

export const flag = (name) => process.argv.includes(name);

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'property';

/** Where every property's working files and finished video go. */
export const OUTPUT_ROOT = path.resolve(process.env.VIDEO_OUTPUT_DIR || 'videos');

/**
 * Read KEY=value pairs from .env in the current directory. Values already in the environment
 * win, so a shell export always overrides the file. Nothing read here is ever printed.
 */
export function loadEnv(file = path.join(process.cwd(), '.env')) {
  if (!existsSync(file)) return false;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Higgsfield CLI
// ---------------------------------------------------------------------------------------------

/**
 * Locate the real Higgsfield binary rather than the npm shim.
 *
 * On Windows the shim is a .cmd, which Node refuses to spawn without `shell: true`, and running
 * video prompts through a shell mangles their quotes and parentheses. Calling the vendored binary
 * directly passes every argument verbatim on every platform.
 */
export function findHiggsfield() {
  if (process.env.HIGGSFIELD_BIN) {
    return existsSync(process.env.HIGGSFIELD_BIN) ? process.env.HIGGSFIELD_BIN : null;
  }
  const exe = process.platform === 'win32' ? 'hf.exe' : 'hf';
  const roots = [];
  try {
    roots.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {}
  if (process.platform === 'win32' && process.env.APPDATA) {
    roots.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
  }
  for (const root of roots) {
    const bin = path.join(root, '@higgsfield', 'cli', 'vendor', exe);
    if (existsSync(bin)) return bin;
  }
  // macOS/Linux: the npm shim is a plain executable script, so PATH lookup is safe there.
  if (process.platform !== 'win32') {
    try {
      execFileSync('higgsfield', ['version'], { stdio: 'ignore' });
      return 'higgsfield';
    } catch {}
  }
  return null;
}

export function higgsfield() {
  const bin = findHiggsfield();
  if (!bin) {
    throw new Error('Higgsfield CLI not found. Install it with:  npm install -g @higgsfield/cli');
  }
  const run = (...a) =>
    execFileSync(bin, [...a, '--no-color'], {
      encoding: 'utf8',
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  return { bin, run, json: (...a) => JSON.parse(run(...a, '--json')) };
}

/** The CLI prints ids as the last UUID of its output; take that rather than trusting line layout. */
export function lastUuid(text) {
  const all = String(text).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  if (!all) throw new Error(`no id found in Higgsfield output: ${String(text).slice(0, 200)}`);
  return all[all.length - 1];
}

// ---------------------------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------------------------

export function findFfmpeg() {
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
  const ffprobe = process.env.FFPROBE_BIN
    || (process.env.FFMPEG_BIN ? ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1') : 'ffprobe');
  const works = (bin) => {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  return { ffmpeg, ffprobe, ok: works(ffmpeg) && works(ffprobe) };
}

// ---------------------------------------------------------------------------------------------
// OwnerRez
// ---------------------------------------------------------------------------------------------

export const OWNERREZ_API = 'https://api.ownerrez.com';

export const hasOwnerRezCreds = () => Boolean(process.env.OWNERREZ_USERNAME && process.env.OWNERREZ_TOKEN);

/** GET an OwnerRez v2 endpoint with HTTP Basic auth (login email + personal access token). */
export async function ownerrez(pathname) {
  if (!hasOwnerRezCreds()) {
    throw Object.assign(
      new Error('OwnerRez credentials missing: set OWNERREZ_USERNAME and OWNERREZ_TOKEN in .env'),
      { code: 'NO_CREDS' }
    );
  }
  const auth = Buffer.from(`${process.env.OWNERREZ_USERNAME}:${process.env.OWNERREZ_TOKEN}`).toString('base64');
  const res = await fetch(OWNERREZ_API + pathname, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'User-Agent': 'ownerrez-higgsfield-video/1.0'
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`OwnerRez ${pathname} -> HTTP ${res.status} ${body.slice(0, 200)}`), {
      status: res.status,
      body
    });
  }
  return res.json();
}

/** Every OwnerRez photo has a 32-hex id; `/f/<id>` is the untouched full-resolution original. */
export const OREZ_GUID = /[0-9a-f]{32}/i;
export const originalUrl = (guid) => `https://uc.orez.io/f/${guid}`;

/** Fetch with retries: pulling a whole gallery of originals reliably drops a connection or two. */
export async function download(url, attempts = 4) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      last = error;
      if (i < attempts) await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
  throw new Error(`download failed for ${url}: ${last.message}`);
}
