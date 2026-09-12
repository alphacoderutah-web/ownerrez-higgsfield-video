/**
 * Download one property's OwnerRez photo gallery at full resolution.
 *
 *   node fetch-photos.mjs --list                               # list your OwnerRez properties
 *   node fetch-photos.mjs --property 123456                    # gallery via the OwnerRez API
 *   node fetch-photos.mjs --url https://<your-site>/<listing>  # gallery from a public OwnerRez page
 *   node fetch-photos.mjs --folder ./photos --name "Beach House"  # photos you exported yourself
 *
 * Writes videos/<property>/photos/ (originals), videos/<property>/previews/ (800px copies for
 * quick viewing, when ffmpeg is installed) and videos/<property>/photos.json.
 *
 * Always downloads the untouched original from uc.orez.io/f/<id>, never a thumbnail: OwnerRez's
 * sized variants are missing for a sizeable share of photos, and the video model needs every
 * pixel of the start frame it is given.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  arg, flag, slugify, loadEnv, ownerrez, OUTPUT_ROOT, OREZ_GUID, originalUrl, download, findFfmpeg
} from './lib.mjs';

loadEnv();

async function listProperties() {
  const out = [];
  for (let offset = 0, page = 0; page < 50; page++, offset += 100) {
    const data = await ownerrez(`/v2/properties?limit=100&offset=${offset}`);
    const items = data.items ?? [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

/** Photos from the OwnerRez listings API. Some accounts get HTTP 402 here; see the message below. */
async function fromApi(propertyId) {
  let listing;
  try {
    listing = await ownerrez(`/v2/listings/${propertyId}`);
  } catch (error) {
    if (error.status === 402) {
      console.error(
        `OwnerRez returned HTTP 402 for the listings API (${error.body?.slice(0, 120) ?? ''}).\n` +
        'Your account does not expose listing photos through the API. Use your property\'s public\n' +
        'OwnerRez-hosted page instead:\n\n' +
        '  node fetch-photos.mjs --url https://<your-ownerrez-site>/<property-page>\n'
      );
      process.exit(2);
    }
    throw error;
  }
  const props = await listProperties().catch(() => []);
  const name = props.find((p) => p.id === Number(propertyId))?.name || listing.name || `property-${propertyId}`;
  const photos = (listing.photos ?? [])
    .filter((p) => typeof p.url === 'string')
    .map((p) => ({ url: p.url, caption: (p.caption ?? '').replace(/\s+/g, ' ').trim() }));
  return { name, photos, source: { type: 'ownerrez-api', propertyId: Number(propertyId) } };
}

/**
 * Photos from a public OwnerRez-hosted property page. The page's JSON-LD `image` array is the
 * gallery in order; a raw scan of the HTML is the fallback, and can pick up photos of other
 * properties shown on the same page, so it is reported as such.
 */
async function fromPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ownerrez-higgsfield-video/1.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const html = await res.text();

  let name = null;
  let images = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of [data, ...(Array.isArray(data['@graph']) ? data['@graph'] : [])].flat()) {
        if (Array.isArray(node?.image) && node.image.some((u) => OREZ_GUID.test(String(u)))) {
          images = node.image.map((u) => (typeof u === 'string' ? u : u?.url)).filter(Boolean);
          name = node.name ?? name;
        }
      }
    } catch {}
  }

  let exact = true;
  if (images.length === 0) {
    exact = false;
    images = [...html.matchAll(/https?:\/\/uc\.orez\.io\/[a-z]+\/[0-9a-f]{32}[^"'\s)]*/gi)].map((m) => m[0]);
  }
  if (!name) name = (/<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? 'property').split('|')[0].trim();

  const seen = new Set();
  const photos = [];
  for (const u of images) {
    const guid = OREZ_GUID.exec(u)?.[0]?.toLowerCase();
    if (!guid || seen.has(guid)) continue;
    seen.add(guid);
    photos.push({ url: u, caption: '' });
  }
  if (!exact) console.log('note: no gallery metadata on this page; scanned it for OwnerRez photos instead, ' +
                          'so some may belong to other properties shown on the page.');
  return { name, photos, source: { type: 'ownerrez-page', url } };
}

function fromFolder(dir, name) {
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  return {
    name: name || path.basename(path.resolve(dir)),
    photos: files.map((f) => ({ file: path.join(dir, f), caption: '' })),
    source: { type: 'folder', path: path.resolve(dir) }
  };
}

const extFor = (buf) =>
  buf[0] === 0x89 && buf[1] === 0x50 ? 'png'
    : buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP' ? 'webp'
      : 'jpg';

// ---------------------------------------------------------------------------------------------

if (flag('--list')) {
  const props = await listProperties();
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('id', 10) + pad('active', 8) + 'name');
  for (const p of props) console.log(pad(p.id, 10) + pad(p.active ? 'yes' : 'no', 8) + p.name);
  console.log(`\n${props.length} properties`);
  process.exit(0);
}

const gallery = arg('--property') ? await fromApi(arg('--property'))
  : arg('--url') ? await fromPage(arg('--url'))
    : arg('--folder') ? fromFolder(arg('--folder'), arg('--name'))
      : null;

if (!gallery) {
  console.error('usage: --list | --property <ownerrez id> | --url <public listing page> | --folder <dir> [--name "..."]');
  process.exit(1);
}
if (gallery.photos.length === 0) {
  console.error(`No photos found for "${gallery.name}".`);
  process.exit(1);
}

const name = arg('--name') || gallery.name;
const dir = path.join(OUTPUT_ROOT, slugify(name));
mkdirSync(path.join(dir, 'photos'), { recursive: true });

const { ffmpeg, ok: haveFfmpeg } = findFfmpeg();
if (haveFfmpeg) mkdirSync(path.join(dir, 'previews'), { recursive: true });

console.log(`${name}: ${gallery.photos.length} photos -> ${dir}`);

const records = [];
let failed = 0;
for (const [i, photo] of gallery.photos.entries()) {
  const n = String(i + 1).padStart(2, '0');
  const guid = photo.url ? OREZ_GUID.exec(photo.url)?.[0]?.toLowerCase() ?? null : null;
  try {
    let buf;
    if (photo.file) buf = readFileSync(photo.file);
    else buf = await download(guid ? originalUrl(guid) : photo.url);

    const file = `photos/${n}${guid ? '-' + guid.slice(0, 8) : ''}.${extFor(buf)}`;
    if (photo.file) copyFileSync(photo.file, path.join(dir, file));
    else writeFileSync(path.join(dir, file), buf);

    let preview = null;
    if (haveFfmpeg) {
      preview = `previews/${n}.jpg`;
      execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(dir, file),
        '-vf', "scale='min(800,iw)':-2", '-q:v', '4', path.join(dir, preview)]);
    }
    records.push({ n: i + 1, file, preview, guid, caption: photo.caption });
    process.stdout.write(`\r  ${i + 1}/${gallery.photos.length}`);
  } catch (error) {
    failed++;
    console.log(`\n  photo ${n} failed: ${error.message}`);
  }
}

writeFileSync(path.join(dir, 'photos.json'), JSON.stringify({ name, source: gallery.source, photos: records }, null, 1));
console.log(`\n\n${records.length} photos saved, ${failed} failed.`);
console.log(`gallery index: ${path.join(dir, 'photos.json')}`);
if (!haveFfmpeg) console.log('ffmpeg not found, so no previews were made; view the originals in photos/.');
process.exit(failed && records.length === 0 ? 1 : 0);
