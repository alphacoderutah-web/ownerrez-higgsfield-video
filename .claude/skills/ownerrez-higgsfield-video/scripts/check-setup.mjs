/**
 * Check everything the video workflow needs, and say exactly what to do about anything missing.
 *
 *   node check-setup.mjs
 *
 * Read-only: it spends no credits and never prints a token. The last line is READY or NOT READY.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnv, findHiggsfield, findFfmpeg, hasOwnerRezCreds, ownerrez } from './lib.mjs';

const haveEnvFile = loadEnv();
let ready = true;
const ok = (label, detail = '') => console.log(`  [ok]   ${label}${detail ? ' - ' + detail : ''}`);
const bad = (label, fix, required = true) => {
  if (required) ready = false;
  console.log(`  [${required ? 'MISSING' : 'optional'}] ${label}\n           -> ${fix.split('\n').join('\n              ')}`);
};

console.log('\nSetup check\n');

// Node
const major = Number(process.versions.node.split('.')[0]);
if (major >= 18) ok('Node.js', process.versions.node);
else bad('Node.js 18 or newer', `You have ${process.versions.node}. Install the LTS release from https://nodejs.org`);

// Higgsfield CLI
const hf = findHiggsfield();
if (!hf) {
  bad('Higgsfield CLI', 'Install it:  npm install -g @higgsfield/cli');
} else {
  ok('Higgsfield CLI', hf);
  try {
    const out = execFileSync(hf, ['account', 'status', '--json', '--no-color'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const acct = JSON.parse(out);
    ok('Higgsfield account', `${acct.email} (${acct.subscription_plan_type ?? 'plan unknown'}), ${acct.credits} credits`);
    if (Number(acct.credits) < 36) {
      bad('Higgsfield credits', 'One 4-second 1080p clip costs about 36 credits. Add credits at https://higgsfield.ai');
    }
  } catch {
    bad('Higgsfield login',
      'Sign in (opens your browser):  higgsfield auth login\n' +
      'In Claude Code you can run it from the prompt with:  ! higgsfield auth login');
  }
}

// ffmpeg
const ff = findFfmpeg();
if (ff.ok) ok('ffmpeg + ffprobe');
else {
  bad('ffmpeg + ffprobe',
    'Windows:  winget install Gyan.FFmpeg   (then open a new terminal)\n' +
    'macOS:    brew install ffmpeg\n' +
    'Linux:    sudo apt install ffmpeg   (or your distro\'s package)\n' +
    'Or set FFMPEG_BIN / FFPROBE_BIN in .env to the full paths.');
}

// OwnerRez
if (!haveEnvFile && !existsSync('.env.example')) {
  // Running outside the repo (personal skill install): .env is looked up in the current folder.
  console.log('  note: no .env in this folder; OwnerRez credentials are read from .env in the current directory.');
}
if (!hasOwnerRezCreds()) {
  bad('OwnerRez API credentials',
    'Copy .env.example to .env and fill in OWNERREZ_USERNAME (your OwnerRez login email)\n' +
    'and OWNERREZ_TOKEN (a Personal Access Token from OwnerRez > Settings > API).\n' +
    'Optional: without them you can still pull a gallery from a public listing page with --url.',
    false);
} else {
  try {
    const data = await ownerrez('/v2/properties?limit=100');
    ok('OwnerRez API', `${(data.items ?? []).length}${data.next_page_url ? '+' : ''} properties visible`);
  } catch (error) {
    bad('OwnerRez API',
      error.status === 401 || error.status === 403
        ? 'OwnerRez rejected the credentials. Check OWNERREZ_USERNAME is your login email and\n' +
          'OWNERREZ_TOKEN is a current Personal Access Token.'
        : `OwnerRez request failed: ${error.message}`,
      false);
  }
}

console.log(`\n${ready ? 'READY' : 'NOT READY'}\n`);
process.exit(ready ? 0 : 1);
