/**
 * Loads a Nest @Injectable source file (decorators + constructor parameter
 * properties, which the strip-only `node --test` runner cannot parse) by bundling
 * it with esbuild into an in-memory CJS module, the same way
 * public-subscription.test.ts does. `bundledSkipReason` is a string (skip) when
 * esbuild is unresolvable locally; in CI that is a hard error.
 */
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..', '..');
const requireFromBackend = createRequire(path.join(backendRoot, 'package.json'));

function resolveSkipReason(): string | false {
  try {
    requireFromBackend.resolve('esbuild');
    return false;
  } catch {
    if (process.env.CI) throw new Error('esbuild must be resolvable from apps/backend in CI');
    return 'esbuild not resolvable from apps/backend';
  }
}

export const bundledSkipReason: string | false = resolveSkipReason();

/** Require a backend dependency (same module instance the bundle resolves). */
export function requireBackendDependency<T>(id: string): T {
  return requireFromBackend(id) as T;
}

/** Bundle `src/<relativeEntry>` and return its module exports. `quiet` mutes the Nest logger. */
export function loadBundled<T>(relativeEntry: string, options: { quiet?: boolean } = {}): T {
  requireFromBackend('reflect-metadata');
  if (options.quiet) {
    (requireFromBackend('@nestjs/common') as { Logger: { overrideLogger(level: false): void } }).Logger.overrideLogger(false);
  }
  const esbuild = requireFromBackend('esbuild') as typeof import('esbuild');
  const out = esbuild.buildSync({
    entryPoints: [path.join(backendRoot, 'src', relativeEntry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    tsconfig: path.join(backendRoot, 'tsconfig.json'),
    target: 'node20',
    logLevel: 'error',
  });
  const filename = path.join(backendRoot, 'test', `__${path.basename(relativeEntry, '.ts')}.bundle.cjs`);
  const mod = new Module(filename) as Module & { _compile(code: string, filename: string): void; paths: string[] };
  mod.filename = filename;
  mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(path.dirname(filename));
  mod._compile(out.outputFiles[0].text, filename);
  return mod.exports as T;
}
