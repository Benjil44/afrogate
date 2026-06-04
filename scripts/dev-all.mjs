#!/usr/bin/env node
// Dependency-free dev orchestrator: runs the whole AfroGate stack with hot reload.
//   - @afrogate/shared in tsc --watch (so cross-package edits propagate live)
//   - backend (nest start --watch), dashboard + client (vite HMR)
// Output from each process is line-prefixed and color-tagged. Ctrl+C stops all.
import { spawn, spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [
  { name: 'shared', color: '\x1b[35m', args: ['--workspace', '@afrogate/shared', 'run', 'dev'] },
  // --ignore-scripts skips each app's `predev` (one-off shared build) so we don't
  // race four concurrent tsc writes into shared/dist; we build shared once below.
  { name: 'backend', color: '\x1b[36m', args: ['--workspace', '@afrogate/backend', 'run', 'dev', '--ignore-scripts'] },
  { name: 'dashboard', color: '\x1b[32m', args: ['--workspace', '@afrogate/dashboard', 'run', 'dev', '--ignore-scripts'] },
  { name: 'client', color: '\x1b[33m', args: ['--workspace', '@afrogate/client', 'run', 'dev', '--ignore-scripts'] },
];
const RESET = '\x1b[0m';
const width = Math.max(...procs.map((p) => p.name.length));

function log(name, color, chunk) {
  const tag = `${color}[${name.padEnd(width)}]${RESET}`;
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.length) process.stdout.write(`${tag} ${line}\n`);
  }
}

console.log('Building @afrogate/shared once before starting watchers...');
const built = spawnSync(npm, ['--workspace', '@afrogate/shared', 'run', 'build'], { stdio: 'inherit' });
if (built.status !== 0) {
  console.error('Initial shared build failed; aborting.');
  process.exit(built.status ?? 1);
}

const children = [];
for (const { name, color, args } of procs) {
  const child = spawn(npm, args, { env: process.env });
  child.stdout.on('data', (d) => log(name, color, d));
  child.stderr.on('data', (d) => log(name, color, d));
  child.on('exit', (code) => log(name, color, `exited with code ${code}`));
  children.push(child);
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping all dev processes...');
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
