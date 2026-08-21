import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { createSecureTempFile } from '../src/common/secure-temp-file.ts';

// Resolve os.tmpdir() the same way fs.mkdtemp will end up rooted (handles
// platforms/CI images where tmpdir() itself is a symlink, e.g. macOS /tmp -> /private/tmp).
const realTmpdir = (() => {
  try {
    return realpathSync(tmpdir());
  } catch {
    return tmpdir();
  }
})();

function isUnderTmpdir(p: string): boolean {
  const resolved = resolve(p);
  let real = resolved;
  try {
    real = realpathSync(resolved);
  } catch {
    // path (or an ancestor) may not exist yet in some edge case; fall back to the raw resolution
  }
  const prefix = realTmpdir.endsWith(sep) ? realTmpdir : realTmpdir + sep;
  return real === realTmpdir || real.startsWith(prefix) || resolved.startsWith(tmpdir());
}

describe('createSecureTempFile', () => {
  it('returns a path rooted under os.tmpdir()', async () => {
    const { path, cleanup } = await createSecureTempFile('config.json');
    try {
      assert.ok(isUnderTmpdir(path), `expected ${path} to live under ${tmpdir()}`);
    } finally {
      await cleanup();
    }
  });

  it('keeps the requested basename (extension the child binary needs)', async () => {
    const { path, cleanup } = await createSecureTempFile('upload.bin');
    try {
      assert.equal(path.split(/[\\/]/).pop(), 'upload.bin');
    } finally {
      await cleanup();
    }
  });

  it('creates a private, newly-created containing directory', async () => {
    const { path, cleanup } = await createSecureTempFile('adu.json');
    try {
      const dir = dirname(path);
      const info = await stat(dir);
      assert.ok(info.isDirectory(), 'containing directory should exist');
      // POSIX permission bits are not meaningfully enforced on Windows, so only
      // assert the private-mode invariant on platforms where it actually applies.
      if (process.platform !== 'win32') {
        assert.equal(info.mode & 0o777, 0o700, `expected dir mode 0700, got ${(info.mode & 0o777).toString(8)}`);
      }
    } finally {
      await cleanup();
    }
  });

  it('returns distinct, non-colliding paths/dirs across calls', async () => {
    const a = await createSecureTempFile('config.json');
    const b = await createSecureTempFile('config.json');
    try {
      assert.notEqual(a.path, b.path);
      assert.notEqual(dirname(a.path), dirname(b.path));
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  it('cleanup() removes the containing directory', async () => {
    const { path, cleanup } = await createSecureTempFile('config.json');
    const dir = dirname(path);
    await cleanup();
    await assert.rejects(() => stat(dir), /ENOENT/);
  });

  it('cleanup() is safe to call when nothing was ever written to path', async () => {
    const { cleanup } = await createSecureTempFile('config.json');
    await cleanup();
    // Calling cleanup again (e.g. a finally block after an earlier explicit
    // cleanup) must not throw — mirrors the existing rm({force:true}) sites.
    await cleanup();
  });
});
