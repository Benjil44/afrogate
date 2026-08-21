import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface SecureTempFile {
  /** Absolute path to the temp file inside a private, unguessable directory. */
  path: string;
  /** Removes the private directory (and the file within it) recursively. */
  cleanup: () => Promise<void>;
}

/**
 * Create a temp file at an unpredictable location, immune to the local
 * pre-create / symlink race that a fixed name in the shared os.tmpdir() invites.
 *
 * Mirrors the in-repo precedent in operations.service.ts (protocol-apply):
 * fs.mkdtemp() yields a freshly created, mode-0700, unguessable directory owned
 * by us, so an attacker cannot have pre-created the file the child binary reads.
 * The caller writes to `path` (with mode 0o600) and MUST call `cleanup()` in a
 * finally block. `basename` preserves the extension the child binary needs
 * (e.g. config.json / upload.bin / adu.json).
 */
export async function createSecureTempFile(basename: string): Promise<SecureTempFile> {
  const dir = await mkdtemp(join(tmpdir(), 'afrows-'));
  return {
    path: join(dir, basename),
    cleanup: () => rm(dir, { recursive: true, force: true }).catch(() => undefined),
  };
}
