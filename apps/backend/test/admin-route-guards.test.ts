import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

function listControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listControllerFiles(full));
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

const HTTP_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete)\(/;
const ROLES_DECORATOR = /^\s*@Roles\(/;
const PUBLIC_DECORATOR = /^\s*@Public\(/;

/**
 * Finds, for each controller class decorated `@Controller('admin')`, every HTTP
 * route handler and the decorators that immediately precede it.
 */
function adminRouteHandlers(file: string): { line: number; decorators: string[] }[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const isAdminController = lines.some((l) => /@Controller\(\s*['"]admin['"]\s*\)/.test(l));
  if (!isAdminController) return [];

  const handlers: { line: number; decorators: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!HTTP_DECORATOR.test(lines[i])) continue;
    // collect the contiguous decorator block this route belongs to (scan up and down)
    const decorators: string[] = [];
    let j = i;
    while (j < lines.length && (/^\s*@/.test(lines[j]) || lines[j].trim() === '')) {
      if (/^\s*@/.test(lines[j])) decorators.push(lines[j].trim());
      j++;
    }
    handlers.push({ line: i + 1, decorators });
  }
  return handlers;
}

describe('admin controller route guards (security regression)', () => {
  const files = listControllerFiles(srcDir);

  it('discovers admin controller files', () => {
    const adminFiles = files.filter((f) => adminRouteHandlers(f).length > 0);
    assert.ok(adminFiles.length >= 2, `expected admin controllers, found ${adminFiles.length}`);
  });

  it('every @Controller("admin") route handler declares @Roles (or is explicitly @Public)', () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const handler of adminRouteHandlers(file)) {
        const hasRoles = handler.decorators.some((d) => ROLES_DECORATOR.test(d));
        const isPublic = handler.decorators.some((d) => PUBLIC_DECORATOR.test(d));
        if (!hasRoles && !isPublic) {
          violations.push(`${file}:${handler.line} -> ${handler.decorators.join(' ')}`);
        }
      }
    }
    assert.deepEqual(violations, [], `admin routes missing @Roles:\n${violations.join('\n')}`);
  });
});
