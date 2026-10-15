#!/usr/bin/env node
/**
 * Build the local dev deck manifest (`tracks.json`) for apps/web/public/Podcast/ (`--local-only`).
 * The VPS upload mode below is RETIRED (0.120.1): mixes are served by https://media.borjino.com/music/.
 *
 *   node scripts/media/sync-mixes.mjs              # build manifest, upload new/changed files + manifest
 *   node scripts/media/sync-mixes.mjs --dry-run    # show what would happen, change nothing
 *   node scripts/media/sync-mixes.mjs --local-only # only (re)write the local tracks.json for `vite dev`
 *   node scripts/media/sync-mixes.mjs --prune      # also delete VPS mixes that are no longer in the folder
 *
 * Source folder: apps/web/public/Podcast/ (git-ignored). The folder IS the playlist:
 *   - order    = natural filename order ("Vibes 2" before "Vibes 10"); prefix "01 ", "02 " to force an order
 *   - title    = "Artist - Title.mp3" -> artist "Artist", title "Title" (a leading "01 " is dropped);
 *                otherwise the whole name is the title
 * Target: the first SSH destination in scripts/deploy/deploy.env (AFROWS_DEPLOY_TARGETS), or --target <ssh-dest>.
 * Key-based SSH only (BatchMode), like the deploy engine. Remote dir: /opt/afrows/media/podcast (owner afrows).
 *
 * Stop-gap until the parent app's DJ manager serves this same manifest format (see apps/web/src/lib/tracks.ts).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_DIR = join(ROOT, 'apps', 'web', 'public', 'Podcast');
const REMOTE_DIR = '/opt/afrows/media/podcast';
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav']);
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30'];

/** Lowercase ASCII slug for a stable, URL-safe track id (max 64 chars). */
export function slug(name) {
  const s = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
  return s || 'mix';
}

/** "01 DJ X - Night Drive.mp3" -> { artist: "DJ X", title: "Night Drive" }. */
export function describe(file) {
  const stem = basename(file, extname(file)).replace(/^\d{1,3}[\s._-]+/, '').trim();
  const dash = stem.indexOf(' - ');
  if (dash > 0) return { artist: stem.slice(0, dash).trim().slice(0, 120), title: stem.slice(dash + 3).trim().slice(0, 120) || stem.slice(0, 120) };
  return { artist: '', title: stem.slice(0, 120) };
}

/** A name the landing accepts as `file` (no separators, no "..", no ":"). */
export function isPublishableName(file) {
  return file.length <= 255 && !/[/\\:]/.test(file) && !file.includes('..');
}

export function buildManifest(files) {
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const used = new Map();
  return [...files].sort(collator.compare).map((file) => {
    const { artist, title } = describe(file);
    const base = slug(basename(file, extname(file)));
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base.slice(0, 60)}-${n}`;
    return { id, title, artist, file };
  });
}

/** POSIX single-quote a value for the remote shell. */
const q = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function sshTarget(args) {
  const i = args.indexOf('--target');
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const envFile = join(ROOT, 'scripts', 'deploy', 'deploy.env');
  const fromEnv = existsSync(envFile) && readFileSync(envFile, 'utf8').match(/^\s*AFROWS_DEPLOY_TARGETS\s*=\s*"?([^"\n]+)"?/m);
  const target = fromEnv ? fromEnv[1].trim().split(/\s+/)[0] : '';
  if (!target) throw new Error('No SSH target: pass --target <ssh-dest> or set AFROWS_DEPLOY_TARGETS in scripts/deploy/deploy.env');
  return target;
}

const ssh = (target, script) => execFileSync('ssh', [...SSH_OPTS, target, 'bash -s'], { input: script, encoding: 'utf8' });

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const localOnly = args.includes('--local-only');
  const prune = args.includes('--prune');
  if (!existsSync(SOURCE_DIR)) throw new Error(`Missing ${SOURCE_DIR}`);

  const all = readdirSync(SOURCE_DIR).filter((f) => AUDIO_EXT.has(extname(f).toLowerCase()) && statSync(join(SOURCE_DIR, f)).isFile());
  const skipped = all.filter((f) => !isPublishableName(f));
  for (const f of skipped) console.warn(`  skip (rename it: no "/", "\\", ":" or ".."): ${f}`);
  const files = all.filter(isPublishableName);
  const manifest = buildManifest(files);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;

  console.log(`Playlist (${manifest.length}):`);
  manifest.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.title}${t.artist ? ` — ${t.artist}` : ''}   [${t.file}]`));

  const localManifest = join(SOURCE_DIR, 'tracks.json');
  if (!dryRun) {
    writeFileSync(`${localManifest}.tmp`, json);
    renameSync(`${localManifest}.tmp`, localManifest);
    console.log(`Wrote ${localManifest}`);
  }
  if (localOnly) return;
  // Retired 2026-10-15 (0.120.1): mixes are served by the Borjino share (media.borjino.com) and the Afrows
  // /Podcast/ path returns 410. Never upload media to the Afrows VPS again (it streams through the web tunnel).
  throw new Error('Upload to the Afrows VPS is retired; mixes live on https://media.borjino.com/music/ (Borjino deploy/media-share.sh upload). Use --local-only for the dev manifest.');

  const target = sshTarget(args);
  console.log(`\nVPS: ${target}:${REMOTE_DIR}`);
  const listing = ssh(target, `set -e\nmkdir -p ${q(REMOTE_DIR)}\ncd ${q(REMOTE_DIR)}\nfind . -maxdepth 1 -type f ! -name 'tracks.json' ! -name '.*' -printf '%s\\t%f\\n'\nprintf 'FREE\\t%s\\n' "$(df -B1 --output=avail . | tail -1 | tr -d ' ')"\n`);
  const remote = new Map();
  let free = 0;
  for (const line of listing.split('\n').filter(Boolean)) {
    const [size, name] = line.split('\t');
    if (size === 'FREE') free = Number(name);
    else remote.set(name, Number(size));
  }

  const toUpload = files.filter((f) => remote.get(f) !== statSync(join(SOURCE_DIR, f)).size);
  const extra = [...remote.keys()].filter((f) => !files.includes(f));
  const needed = toUpload.reduce((sum, f) => sum + statSync(join(SOURCE_DIR, f)).size, 0);
  console.log(`  free on VPS: ${(free / 1024 ** 3).toFixed(1)} GB`);
  console.log(`  upload: ${toUpload.length ? toUpload.join(', ') : 'nothing new'} (${(needed / 1024 ** 2).toFixed(1)} MB)`);
  if (extra.length) console.log(`  on VPS but not in the folder: ${extra.join(', ')}${prune ? ' -> will delete' : ' (kept; use --prune to delete)'}`);
  if (!Number.isFinite(free) || free <= 0) throw new Error('Could not read free disk space on the VPS');
  if (free - needed < MIN_FREE_BYTES) throw new Error(`Not enough disk on the VPS: ${(free / 1024 ** 3).toFixed(1)} GB free, ${(needed / 1024 ** 3).toFixed(1)} GB to upload, 2 GB must stay free`);
  if (dryRun) {
    console.log('\nDry run: nothing changed.');
    return;
  }

  // Upload under a temp name without spaces, then rename on the box (never a half-written mix at its public URL).
  toUpload.forEach((file, i) => {
    const tmp = `.incoming-${process.pid}-${i}.part`;
    console.log(`  -> ${file}`);
    execFileSync('scp', [...SSH_OPTS, '-q', join(SOURCE_DIR, file), `${target}:${REMOTE_DIR}/${tmp}`], { stdio: 'inherit' });
    ssh(target, `set -e\ncd ${q(REMOTE_DIR)}\nmv -f -- ${q(tmp)} ${q(file)}\nchown afrows:afrows -- ${q(file)} 2>/dev/null || true\nchmod 644 -- ${q(file)}\n`);
  });

  const manifestTmp = `.tracks-${process.pid}.json`;
  execFileSync('scp', [...SSH_OPTS, '-q', localManifest, `${target}:${REMOTE_DIR}/${manifestTmp}`], { stdio: 'inherit' });
  const pruneCmds = prune ? extra.map((f) => `rm -f -- ${q(f)}`).join('\n') : '';
  ssh(target, `set -e\ncd ${q(REMOTE_DIR)}\nchmod 644 ${q(manifestTmp)}\nchown afrows:afrows ${q(manifestTmp)} 2>/dev/null || true\nmv -f ${q(manifestTmp)} tracks.json\n${pruneCmds}\n`);
  console.log(`\nPublished ${manifest.length} mix(es). afrows.com shows them within a minute (manifest cache 60 s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
