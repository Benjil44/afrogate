import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

describe('XSS sink guard (dashboard + client)', () => {
  const sink = /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=|\beval\s*\(|\bnew Function\s*\(/;
  const files = [
    ...listFiles(join(repoRoot, 'apps', 'dashboard', 'src'), ['.ts', '.tsx']),
    ...listFiles(join(repoRoot, 'apps', 'client', 'src'), ['.ts', '.tsx']),
  ];

  it('scans frontend source files', () => {
    assert.ok(files.length > 0, 'expected frontend source files to scan');
  });

  it('contains no raw HTML injection or dynamic-eval sinks', () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (sink.test(line)) violations.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(violations, [], `XSS-prone sinks found:\n${violations.join('\n')}`);
  });
});

describe('SQL injection guard (backend services)', () => {
  // On any line that contains a positional SQL placeholder ($1, $2, ...) we only
  // allow ${...} interpolations that build placeholder indices or reference
  // developer-controlled literal identifiers — never raw values.
  const safeInterpolation = /^\$\{[^}]*\b(values|params|placeholders|index|idx|i|offset|column|fieldName|field|key|setClauses|clauses|where|sortColumn|orderBy|direction)\b/;
  const files = listFiles(join(repoRoot, 'apps', 'backend', 'src'), ['.ts']);

  it('scans backend source files', () => {
    assert.ok(files.length > 0, 'expected backend source files to scan');
  });

  it('never interpolates raw values into parameterized SQL lines', () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/\$\d/.test(line)) return; // only inspect lines that carry SQL placeholders
        const interpolations = line.match(/\$\{[^}]+\}/g);
        if (!interpolations) return;
        for (const expr of interpolations) {
          // Allow no-argument SQL-fragment builders, e.g. ${this.paymentOrderSelectSql()}
          // (developer-controlled static column lists, never user input).
          const isSqlFragmentBuilder = /^\$\{this\.[A-Za-z]+Sql\(\)\}$/.test(expr);
          if (!safeInterpolation.test(expr) && !isSqlFragmentBuilder) {
            violations.push(`${file}:${i + 1}: ${expr} in: ${line.trim()}`);
          }
        }
      });
    }
    assert.deepEqual(violations, [], `Unsafe SQL interpolation(s):\n${violations.join('\n')}`);
  });

  it('never builds SQL by string concatenation with user input', () => {
    const sqlKeyword = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WHERE|VALUES)\b/i;
    const concat = /['"]\s*\+\s*\w|\w\s*\+\s*['"]/;
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (sqlKeyword.test(line) && concat.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    assert.deepEqual(violations, [], `Possible string-concatenated SQL:\n${violations.join('\n')}`);
  });
});

describe('insecure-temp-file guard (predictable os.tmpdir() filenames)', () => {
  // Strips block comments outright, and strips `//` line comments unless they're
  // part of a `://` URL (these two files interpolate `https://...` literals, so a
  // naive `//`-anywhere stripper would corrupt those lines and produce false
  // positives/negatives).
  function stripComments(source: string): string {
    const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return noBlock
      .split(/\r?\n/)
      .map((line) => {
        for (let i = 0; i < line.length - 1; i++) {
          if (line[i] === '/' && line[i + 1] === '/' && line[i - 1] !== ':') {
            return line.slice(0, i);
          }
        }
        return line;
      })
      .join('\n');
  }

  // Matches the predictable-filename race this guard exists to prevent:
  // path.join(os.tmpdir(), `...${...}...`) — an interpolated (attacker/PID/port
  // -guessable) basename written directly into the shared, world-writable
  // os.tmpdir(), instead of a private fs.mkdtemp()'d directory.
  const predictableTmpFileWrite =
    /path\s*\.\s*join\s*\(\s*os\s*\.\s*tmpdir\s*\(\s*\)\s*,\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/;

  const targets = [
    join(repoRoot, 'apps', 'backend', 'src', 'outbound', 'outbound-speed-test.service.ts'),
    join(repoRoot, 'apps', 'backend', 'src', 'client', 'xray-provisioning.service.ts'),
  ];

  it('resolves both guarded target files', () => {
    for (const file of targets) {
      assert.ok(readFileSync(file, 'utf8').length > 0, `expected ${file} to exist and be non-empty`);
    }
  });

  it('never writes a predictable, interpolated filename straight into os.tmpdir()', () => {
    const violations: string[] = [];
    for (const file of targets) {
      const stripped = stripComments(readFileSync(file, 'utf8'));
      stripped.split('\n').forEach((line, i) => {
        if (predictableTmpFileWrite.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    assert.deepEqual(
      violations,
      [],
      `Predictable os.tmpdir() filename write(s) found (use createSecureTempFile() from ` +
        `src/common/secure-temp-file.ts instead — a private fs.mkdtemp()'d directory closes ` +
        `the local pre-create/symlink race):\n${violations.join('\n')}`,
    );
  });
});
