/**
 * Generate one video clip per beat of a walkthrough plan with Higgsfield (Seedance 2.0).
 *
 *   node generate-clips.mjs --plan videos/<property>/plan.json --estimate
 *   node generate-clips.mjs --plan videos/<property>/plan.json --budget 150 --only living
 *   node generate-clips.mjs --plan videos/<property>/plan.json --budget 400
 *
 *  - Seedance 2.0, std mode (fast mode cannot do 1080p), silent, 4s normal / 5s hero beats.
 *  - Every prompt is the camera move written against that exact photo, plus a fixed
 *    preservation clause and the beat's own negatives. The negatives matter: a clip that asks
 *    the camera to reveal geometry the photo does not contain will invent it.
 *  - --budget is a hard ceiling checked against the live account balance before every
 *    submission, so a loop cannot spend past what the owner approved.
 *  - Submissions are staggered rather than fired together, to stay clear of rate limits.
 *  - One failed beat is recorded and skipped; it never takes the rest of the run down with it.
 *
 * Results are recorded per beat in <plan dir>/clips/generated.json, keyed by the Higgsfield job id.
 * A new clip always starts unapproved; see review.mjs.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { arg, flag, higgsfield, lastUuid, download } from './lib.mjs';

const planPath = arg('--plan');
if (!planPath || !existsSync(planPath)) {
  console.error('usage: --plan videos/<property>/plan.json (--estimate | --budget <credits>) [--only slug,slug]');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const planDir = path.dirname(path.resolve(planPath));
const clipsDir = path.join(planDir, 'clips');
const recordPath = path.join(clipsDir, 'generated.json');
mkdirSync(clipsDir, { recursive: true });

const MODEL = 'seedance_2_0';
const resolution = plan.resolution || '1080p';
const aspectRatio = plan.aspectRatio || '16:9';
const only = (arg('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const estimateOnly = flag('--estimate');
const budget = Number(arg('--budget'));

if (!estimateOnly && !(budget > 0)) {
  console.error('Refusing to generate without an approved --budget (in credits). Run --estimate first.');
  process.exit(1);
}

const hf = higgsfield();
const balance = () => Number(hf.json('account', 'status').credits);

const PRESERVE =
  'Slow steady luxury pace, eye level, realistic depth and parallax. Bright natural daylight, ' +
  'photorealistic. Preserve the exact furniture, architecture, colors and materials exactly as shown. ' +
  'Do not add, remove or alter any fixtures, appliances, cabinetry, windows, doors or architecture. ' +
  'Do not reveal or invent anything outside the original photograph. ' +
  'No camera shake, no people, no text, no added objects, no distortion, no morphing.';

const promptFor = (beat) =>
  'First-person real estate walkthrough on a professional stabilized gimbal. ' +
  `${beat.cameraMove.trim()} ${PRESERVE}` +
  (beat.negatives ? ` ${beat.negatives.trim()}` : '');

const genParams = (beat) => [
  '--duration', String(beat.duration),
  '--resolution', resolution,
  '--aspect-ratio', aspectRatio,
  '--mode', 'std',
  '--generate-audio=false'
];

// Price per duration, asked of Higgsfield itself rather than hardcoded.
const costCache = new Map();
const costOf = (beat) => {
  if (!costCache.has(beat.duration)) {
    const { credits } = hf.json('generate', 'cost', MODEL, '--prompt', 'price check', ...genParams(beat));
    costCache.set(beat.duration, Number(credits));
  }
  return costCache.get(beat.duration);
};

const records = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : {};
const save = () => writeFileSync(recordPath, JSON.stringify(records, null, 1));

const clipName = (beat, i) => `${String(i + 1).padStart(2, '0')}-${beat.slug}.mp4`;

// Validate the plan up front so a typo does not surface half way through a paid run.
const problems = [];
for (const [i, b] of plan.beats.entries()) {
  if (!b.slug || !/^[a-z0-9-]+$/.test(b.slug)) problems.push(`beat ${i + 1}: slug must be lowercase letters, digits, dashes`);
  if (!b.photo || !existsSync(path.join(planDir, b.photo))) problems.push(`beat ${b.slug}: photo not found (${b.photo})`);
  if (!b.cameraMove) problems.push(`beat ${b.slug}: missing cameraMove`);
  if (![4, 5].includes(Number(b.duration))) problems.push(`beat ${b.slug}: duration should be 4 or 5`);
}
for (const s of only) if (!plan.beats.some((b) => b.slug === s)) problems.push(`--only: no beat named "${s}"`);
if (problems.length) {
  console.error('Plan problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const todo = plan.beats
  .map((beat, i) => ({ beat, i }))
  .filter(({ beat }) => only.length === 0 || only.includes(beat.slug));

// ---- estimate ----------------------------------------------------------------------------------
if (estimateOnly) {
  let total = 0;
  for (const { beat, i } of todo) {
    const done = records[beat.slug] && existsSync(path.join(clipsDir, clipName(beat, i)));
    const c = done ? 0 : costOf(beat);
    total += c;
    console.log(`  ${clipName(beat, i).padEnd(28)} ${beat.duration}s  ${done ? 'already generated' : c + ' credits'}`);
  }
  console.log(`\nestimated: ${total} credits for ${todo.length} beat(s); balance ${balance()} credits.`);
  console.log('Budget 2-3 re-rolls on tricky rooms on top of this.');
  process.exit(0);
}

// ---- generate ----------------------------------------------------------------------------------
const start = balance();
console.log(`balance ${start} credits, approved spend this run: ${budget}\n`);

const failures = [];
let generated = 0;
for (const [k, { beat, i }] of todo.entries()) {
  const name = clipName(beat, i);
  const clipPath = path.join(clipsDir, name);

  // A file on disk is not proof this beat was generated; only a recorded job is.
  if (existsSync(clipPath)) {
    if (records[beat.slug]?.jobId) {
      console.log(`${beat.slug}: already generated, skipping`);
      continue;
    }
    console.log(`${beat.slug}: SKIPPED - ${name} exists but has no generation record. Move it aside to generate this beat.`);
    failures.push({ slug: beat.slug, detail: 'target path occupied by a file this script did not generate' });
    continue;
  }

  // A top-up mid-run raises the balance; clamp so it never reads as negative spend.
  const spent = Math.max(0, start - balance());
  const cost = costOf(beat);
  if (spent + cost > budget) {
    console.log(`\nSTOPPING: next clip costs ${cost}, already spent ${spent} of the approved ${budget}.`);
    break;
  }

  process.stdout.write(`${beat.slug} (${beat.duration}s, ${cost} credits) `);
  try {
    const src = path.join(planDir, beat.photo);
    const mediaId = lastUuid(hf.run('upload', 'create', src));
    process.stdout.write('uploaded ');

    const prompt = promptFor(beat);
    const jobId = lastUuid(hf.run('generate', 'create', MODEL, '--prompt', prompt, '--start-image', mediaId, ...genParams(beat)));
    process.stdout.write(`job ${jobId.slice(0, 8)} `);

    hf.run('generate', 'wait', jobId, '--timeout', '20m', '--quiet');
    const job = hf.json('generate', 'get', jobId);
    if (job.status !== 'completed' || !job.result_url) throw new Error(`job ended with status "${job.status}"`);

    writeFileSync(clipPath, await download(job.result_url));
    console.log(`-> ${name}`);

    records[beat.slug] = {
      slug: beat.slug,
      clip: `clips/${name}`,
      photo: beat.photo,
      duration: beat.duration,
      jobId,
      mediaId,
      url: job.result_url,
      prompt,
      credits: cost,
      createdAt: new Date().toISOString(),
      approved: false
    };
    save();
    generated++;
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split('\n')[0];
    console.log(`FAILED (${detail.slice(0, 120)})`);
    failures.push({ slug: beat.slug, detail });
  }

  if (k < todo.length - 1) await new Promise((r) => setTimeout(r, 20000));
}

const end = balance();
console.log(`\n${generated} clip(s) generated. Spent ${Math.max(0, start - end)} credits, balance ${end}.`);
console.log('Next: review every new clip against its source photo before stitching (review.mjs).');

// Non-zero so anything chained behind this stops instead of stitching whatever is on disk.
if (failures.length) {
  console.log('failed beats:');
  for (const f of failures) console.log(`  ${f.slug}: ${f.detail}`);
  process.exit(1);
}
