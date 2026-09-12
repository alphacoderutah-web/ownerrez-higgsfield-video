/**
 * Stitch the approved clips into the finished walkthrough video.
 *
 *   node stitch.mjs --plan videos/<property>/plan.json          # approved clips only
 *   node stitch.mjs --plan videos/<property>/plan.json --draft  # include unreviewed clips, DRAFT name
 *
 *  - normalise every clip to 1920x1080 (1080x1920 for 9:16), 24 fps, yuv420p, trimmed to its
 *    beat length (Seedance returns a few hundredths of a second over)
 *  - chain 0.5s crossfades so separate clips read as one continuous move
 *  - final encode H.264 + faststart, silent, then prove the result with ffprobe
 *
 * Normalisation and the crossfade chain are separate ffmpeg runs: one graph over ~10 clips can
 * outlast a shell timeout, and separate passes pin a failure to the clip that caused it.
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { arg, flag, slugify, findFfmpeg } from './lib.mjs';

const planPath = arg('--plan');
if (!planPath || !existsSync(planPath)) {
  console.error('usage: --plan videos/<property>/plan.json [--draft]');
  process.exit(1);
}
const draft = flag('--draft');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const planDir = path.dirname(path.resolve(planPath));
const recordPath = path.join(planDir, 'clips', 'generated.json');
const records = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : {};

const { ffmpeg, ffprobe, ok } = findFfmpeg();
if (!ok) {
  console.error('ffmpeg/ffprobe not found; run check-setup.mjs.');
  process.exit(1);
}

const vertical = (plan.aspectRatio || '16:9') === '9:16';
const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
const XFADE = 0.5;
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,` +
  'setsar=1,fps=24,format=yuv420p';

const run = (a) => execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const probe = (file, entries, extra = []) =>
  execFileSync(ffprobe, ['-v', 'error', ...extra, '-show_entries', entries,
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' }).trim();

// Resolve clips in plan order. A beat with no clip is left out; an unreviewed clip blocks the
// final video, because roughly every other AI clip invents something that is not in the house.
const beats = [];
const unapproved = [];
for (const b of plan.beats) {
  const r = records[b.slug];
  if (!r || !existsSync(path.join(planDir, r.clip))) {
    console.log(`  - ${b.slug}: no clip, left out`);
    continue;
  }
  if (!r.approved) unapproved.push(b.slug);
  beats.push({ ...b, file: path.join(planDir, r.clip), duration: Number(b.duration) });
}
if (unapproved.length && !draft) {
  console.error(`Refusing to build the final video: not yet reviewed: ${unapproved.join(', ')}.`);
  console.error('Review them (review.mjs), approve or reject, or pass --draft for a preview.');
  process.exit(1);
}
if (beats.length === 0) {
  console.error('No clips to stitch.');
  process.exit(1);
}

const work = path.join(planDir, '_stitch');
mkdirSync(work, { recursive: true });

console.log(`normalising ${beats.length} clip(s)...`);
for (const [i, b] of beats.entries()) {
  b.norm = path.join(work, `n${String(i).padStart(2, '0')}.mp4`);
  run(['-i', b.file, '-t', String(b.duration), '-vf', NORM, '-an',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', b.norm]);
  console.log(`  ${b.slug}`);
}

// xfade offsets accumulate: each transition starts XFADE before the running total ends.
const inputs = beats.flatMap((b) => ['-i', b.norm]);
let filter = '';
let last = '0:v';
let acc = beats[0].duration;
for (let k = 1; k < beats.length; k++) {
  const offset = (acc - XFADE).toFixed(3);
  const label = k === beats.length - 1 ? 'out' : `x${k}`;
  // format has to sit inside the chain that feeds [out], not after a labelled pad.
  const tail = k === beats.length - 1 ? ',format=yuv420p' : '';
  filter += `${filter ? ';' : ''}[${last}][${k}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset}${tail}[${label}]`;
  last = label;
  acc += beats[k].duration - XFADE;
}
if (beats.length === 1) filter = '[0:v]format=yuv420p[out]';

const base = `${slugify(plan.property || path.basename(planDir))}-walkthrough-${vertical ? '1080x1920' : '1080p'}`;
const video = path.join(planDir, `${base}${draft ? '-DRAFT' : ''}.mp4`);
console.log(beats.length > 1 ? '\ncrossfading...' : '\nencoding...');
run([...inputs, '-filter_complex', filter, '-map', '[out]',
  '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video]);

const poster = video.replace(/\.mp4$/, '-poster.jpg');
run(['-ss', '1.0', '-i', video, '-frames:v', '1', '-q:v', '2', poster]);

// Prove the file rather than trusting that ffmpeg exited cleanly.
const expected = beats.reduce((s, b) => s + b.duration, 0) - (beats.length - 1) * XFADE;
const actual = Number(probe(video, 'format=duration'));
// ffprobe ends lines with \r\n on Windows; split on either so "h264\r" never fails to equal "h264".
const [codec, width, height] = probe(video, 'stream=codec_name,width,height', ['-select_streams', 'v:0'])
  .split(/\r?\n/).map((s) => s.trim());
const audio = probe(video, 'stream=codec_name', ['-select_streams', 'a']);
const problems = [];
if (codec !== 'h264') problems.push(`codec ${codec}, expected h264`);
if (Number(width) !== W || Number(height) !== H) problems.push(`size ${width}x${height}, expected ${W}x${H}`);
if (!(Math.abs(actual - expected) < 0.25)) problems.push(`duration ${actual}s, expected ${expected.toFixed(2)}s`);

console.log(`\nvideo:  ${video}`);
console.log(`poster: ${poster}`);
console.log(`  ${codec} ${width}x${height}, ${actual.toFixed(2)}s (expected ${expected.toFixed(2)}s), ` +
            `${audio ? 'audio ' + audio : 'silent'}, ${beats.length} clip(s)${draft ? ', DRAFT' : ''}`);
if (problems.length) {
  console.error('VERIFY FAILED: ' + problems.join('; '));
  process.exit(1);
}
console.log('verified');
