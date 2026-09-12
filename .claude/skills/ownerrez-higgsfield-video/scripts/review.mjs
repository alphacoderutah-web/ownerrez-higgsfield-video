/**
 * Review generated clips against the photo each one was made from, then approve or reject them.
 *
 *   node review.mjs --plan videos/<property>/plan.json                 # stage every unapproved clip
 *   node review.mjs --plan videos/<property>/plan.json --clips living  # stage just these
 *   node review.mjs --plan videos/<property>/plan.json --approve living,kitchen
 *   node review.mjs --plan videos/<property>/plan.json --reject kitchen --reason "added a range hood"
 *   node review.mjs --plan videos/<property>/plan.json --status
 *
 * Staging writes review/<clip>/compare.jpg: a 2x2 grid of
 *     top-left  SOURCE photo       top-right    frame at 5%
 *     bottom-left frame at 50%     bottom-right frame at 96%
 * Frames are sampled in proportion to the clip's real length. The end of a push-in is where a
 * widened field of view invents the most, so the last frame sits at 96%, not a fixed second.
 *
 * Approval is stored against the Higgsfield job id in clips/generated.json. Rejecting moves the
 * clip to clips/rejected/ and clears its record, so a regenerated clip starts unapproved.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { arg, flag, findFfmpeg } from './lib.mjs';

const planPath = arg('--plan');
if (!planPath || !existsSync(planPath)) {
  console.error('usage: --plan videos/<property>/plan.json [--clips a,b | --approve a,b | --reject a --reason "..." | --status]');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const planDir = path.dirname(path.resolve(planPath));
const recordPath = path.join(planDir, 'clips', 'generated.json');
const records = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : {};
const save = () => writeFileSync(recordPath, JSON.stringify(records, null, 1));
const list = (name) => (arg(name) || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Check every named clip before touching any of them. Approving or rejecting half a list and then
 * exiting would lose the decisions already made, or move a clip without updating its record.
 */
const requireRecords = (slugs) => {
  const missing = slugs.filter((s) => !records[s] || !existsSync(path.join(planDir, records[s].clip)));
  if (slugs.length === 0 || missing.length) {
    console.error(missing.length ? `No generated clip on record for: ${missing.join(', ')}. Nothing changed.`
      : 'Name at least one clip.');
    process.exit(1);
  }
  return slugs.map((s) => records[s]);
};

// ---- status ------------------------------------------------------------------------------------
if (flag('--status')) {
  for (const b of plan.beats) {
    const r = records[b.slug];
    const state = !r ? 'not generated' : r.approved ? `approved (job ${r.jobId.slice(0, 8)})` : 'awaiting review';
    console.log(`  ${b.slug.padEnd(20)} ${state}`);
  }
  process.exit(0);
}

// ---- approve -----------------------------------------------------------------------------------
if (arg('--approve')) {
  for (const r of requireRecords(list('--approve'))) {
    r.approved = true;
    r.approvedAt = new Date().toISOString();
    console.log(`  ${r.slug}: approved (job ${r.jobId.slice(0, 8)})`);
  }
  save();
  process.exit(0);
}

// ---- reject ------------------------------------------------------------------------------------
if (arg('--reject')) {
  const rejectedDir = path.join(planDir, 'clips', 'rejected');
  mkdirSync(rejectedDir, { recursive: true });
  const logPath = path.join(rejectedDir, 'rejected.json');
  const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : [];
  for (const r of requireRecords(list('--reject'))) {
    const moved = path.join(rejectedDir, `${path.basename(r.clip, '.mp4')}-${r.jobId.slice(0, 8)}.mp4`);
    renameSync(path.join(planDir, r.clip), moved);
    log.push({ ...r, rejectedAt: new Date().toISOString(), reason: arg('--reason') || '' });
    delete records[r.slug];
    // Save after each move so the record never points at a clip that is no longer there.
    writeFileSync(logPath, JSON.stringify(log, null, 1));
    save();
    console.log(`  ${r.slug}: rejected, moved to clips/rejected/${path.basename(moved)}`);
  }
  writeFileSync(logPath, JSON.stringify(log, null, 1));
  save();
  process.exit(0);
}

// ---- stage -------------------------------------------------------------------------------------
const { ffmpeg, ffprobe, ok } = findFfmpeg();
if (!ok) {
  console.error('ffmpeg/ffprobe not found; run check-setup.mjs.');
  process.exit(1);
}

const wanted = list('--clips');
const slugs = wanted.length ? wanted : plan.beats.map((b) => b.slug).filter((s) => records[s] && !records[s].approved);
if (slugs.length === 0) {
  console.log('Nothing awaiting review.');
  process.exit(0);
}

const vertical = (plan.aspectRatio || '16:9') === '9:16';
const [TW, TH] = vertical ? [540, 960] : [960, 540];
const tile = `scale=${TW}:${TH}:force_original_aspect_ratio=decrease,pad=${TW}:${TH}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
const ff = (a) => execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...a]);

let failed = 0;
for (const slug of slugs) {
  const r = records[slug];
  const clip = r && path.join(planDir, r.clip);
  const src = r && path.join(planDir, r.photo);
  if (!r || !existsSync(clip)) { console.error(`  ${slug}: no generated clip`); failed++; continue; }
  if (!existsSync(src)) { console.error(`  ${slug}: source photo ${r.photo} is missing`); failed++; continue; }

  const duration = Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', clip], { encoding: 'utf8' }).trim());
  if (!(duration > 0)) { console.error(`  ${slug}: could not read clip duration`); failed++; continue; }

  const out = path.join(planDir, 'review', path.basename(r.clip, '.mp4'));
  mkdirSync(out, { recursive: true });
  const frames = [0.05, 0.5, 0.96].map((f) => {
    const t = (duration * f).toFixed(2);
    const file = path.join(out, `frame-${Math.round(f * 100)}pct.jpg`);
    ff(['-ss', t, '-i', clip, '-frames:v', '1', '-q:v', '3', file]);
    return file;
  });
  const source = path.join(out, 'SOURCE.jpg');
  ff(['-i', src, '-vf', "scale='min(1600,iw)':-2", '-q:v', '3', source]);

  const compare = path.join(out, 'compare.jpg');
  ff(['-i', source, ...frames.flatMap((f) => ['-i', f]), '-filter_complex',
    `[0]${tile}[a];[1]${tile}[b];[2]${tile}[c];[3]${tile}[d];` +
    '[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0', '-frames:v', '1', '-q:v', '3', compare]);

  const shown = path.relative(process.cwd(), compare);
  console.log(`  ${slug}: ${shown.startsWith('..') ? compare : shown}  (${duration.toFixed(2)}s, job ${r.jobId.slice(0, 8)})`);
}

console.log('\nLayout: top-left SOURCE photo, then frames at 5% / 50% / 96% of the clip.');
process.exit(failed ? 1 : 0);
