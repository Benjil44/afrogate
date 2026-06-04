import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Resolves the monorepo version once at module load by walking up from this
 * compiled file until it finds the root `afrows` package.json. Exposed on
 * /api/health so clients can detect a new deployment and refresh themselves.
 */
function resolveAppVersion(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (pkg.name === 'afrows' && typeof pkg.version === 'string') return pkg.version;
    } catch {
      // not here; keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'unknown';
}

const appVersion = resolveAppVersion();

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'afrows-backend',
      version: appVersion,
      timestamp: new Date().toISOString(),
    };
  }
}
