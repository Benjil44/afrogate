#!/usr/bin/env node
// Build a deterministic knowledge-artifact manifest that records ACTUAL repo
// metadata (never invented) for the Graphify outputs the knowledge layer is
// derived from. This is the provenance anchor used by build-mocs.mjs to compute
// a deterministic FRESH/STALE/UNKNOWN freshness state.
//
//   node scripts/knowledge/build-manifest.mjs
//
// Output: graphify-out/knowledge-manifest.json  (gitignored / regenerable)
//
// Determinism: every field is a pure function of the repo state EXCEPT
// `generated_at` (wall-clock provenance) and artifact `mtime`s (filesystem
// provenance). Running twice on the same HEAD + same artifact bytes yields an
// identical manifest apart from those explicitly-provenance fields.
//
// Local-only: `git` is invoked via child_process with no network access. If the
// repo is not a git checkout (or git is unavailable) the git fields record
// `null` plus a machine-readable reason rather than failing.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const GO = path.join(ROOT, 'graphify-out');
const OUT = path.join(GO, 'knowledge-manifest.json');

// A small, stable generator version string. Bump only on a schema/behaviour
// change so downstream consumers can reason about the manifest shape.
const MANIFEST_SCHEMA = 'afrows-knowledge-manifest/v1';
const MOCS_GENERATOR = 'afrows-mocs/1';

// Fail loudly ONLY if graphify-out/ is missing — there is nothing to describe.
if (!fs.existsSync(GO) || !fs.statSync(GO).isDirectory()) {
  console.error(`FATAL: graphify-out/ not found at ${GO} — nothing to manifest. Run Graphify first.`);
  process.exit(1);
}

// ---- git metadata (local, no network) --------------------------------------
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
let head_sha = null; // live HEAD at manifest-generation time (informational only)
let branch = null;
let git_reason = null;
try {
  head_sha = git(['rev-parse', 'HEAD']);
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    branch = null;
  }
} catch (e) {
  head_sha = null;
  branch = null;
  git_reason = `git rev-parse HEAD failed (not a git repo or git unavailable): ${e && e.message ? e.message : String(e)}`;
}

// source_git_sha = the revision the knowledge ARTIFACTS were built from = Graphify's
// `built_at_commit` stamp in graph.json, NOT the manifest-generation HEAD. Using the
// build commit is what makes the freshness check able to DETECT a stale graph
// (recording live HEAD would always report FRESH). Fall back to HEAD only if graph.json
// has no stamp, and flag that via sha_source.
let source_git_sha = null;
let sha_source = null;
try {
  const gj = fs.readFileSync(path.join(ROOT, 'graphify-out', 'graph.json'), 'utf8');
  const m = gj.match(/"built_at_commit"\s*:\s*"([0-9a-f]{7,40})"/);
  if (m) {
    source_git_sha = m[1];
    sha_source = 'graph.json:built_at_commit';
  }
} catch {
  // graph.json unreadable — handled by the HEAD fallback below
}
if (!source_git_sha) {
  source_git_sha = head_sha;
  sha_source = head_sha ? 'HEAD-fallback (graph.json has no built_at_commit)' : 'unknown';
}
const source_git_short = source_git_sha ? source_git_sha.slice(0, 12) : null;

// ---- artifact identities ---------------------------------------------------
// Content hash + mtime for each Graphify artifact the knowledge layer reads.
const ARTIFACT_FILES = ['graph.json', 'bridges.json', 'test_links.json', 'service_links.json'];
function artifactIdentity(rel) {
  const p = path.join(GO, rel);
  if (!fs.existsSync(p)) return null;
  const st = fs.statSync(p);
  const bytes = fs.readFileSync(p);
  return {
    mtime: st.mtime.toISOString(),
    bytes: st.size,
    sha1: crypto.createHash('sha1').update(bytes).digest('hex'),
  };
}
const artifacts = {};
for (const rel of ARTIFACT_FILES) artifacts[rel] = artifactIdentity(rel);

// ---- assemble manifest -----------------------------------------------------
// Key order is fixed so the serialized JSON is deterministic modulo the
// explicitly-provenance fields (generated_at, artifact mtimes).
const manifest = {
  schema: MANIFEST_SCHEMA,
  generated_at: new Date().toISOString(), // the ONE run-varying provenance field
  source_git_sha,
  source_git_short,
  sha_source, // where source_git_sha came from (graph.json build stamp vs HEAD fallback)
  manifest_head_sha: head_sha, // live HEAD when this manifest was written (informational)
  branch,
  ...(git_reason ? { git_reason } : {}),
  mocs_generator: MOCS_GENERATOR,
  artifacts,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Wrote ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
console.log(`  schema:      ${MANIFEST_SCHEMA}`);
console.log(`  source SHA:  ${source_git_short || '(null — ' + (git_reason || 'unknown') + ')'}`);
console.log(`  branch:      ${branch || '(null)'}`);
for (const rel of ARTIFACT_FILES) {
  const a = artifacts[rel];
  console.log(`  ${rel.padEnd(20)} ${a ? a.sha1.slice(0, 12) + '  ' + a.mtime : '(absent)'}`);
}
