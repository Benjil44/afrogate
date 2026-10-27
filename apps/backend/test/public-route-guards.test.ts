/**
 * Security regression: every HTTP route that is reachable WITHOUT an auth guard
 * (no class-level @UseGuards and no token guard on the handler) must be on an
 * explicit, reviewed allowlist, and the credential-accepting public routes must
 * be rate limited. A new unauthenticated endpoint fails this test until it is
 * reviewed and added here.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

const HTTP_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete)\((?:\s*'([^']*)')?/;
const AUTH_GUARD = /@UseGuards\([^)]*(AdminTokenGuard|AgentTokenGuard|ClientTokenGuard|EdgeTokenGuard)/;

function listControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listControllerFiles(full));
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

interface RouteInfo {
  route: string;
  decorators: string[];
}

/** Unguarded routes as `METHOD /prefix/path`, with the decorators of each handler. */
function unguardedRoutes(file: string): RouteInfo[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const controllerIndex = lines.findIndex((l) => /^\s*@Controller\(/.test(l));
  if (controllerIndex < 0) return [];
  const prefix = /@Controller\(\s*'([^']*)'/.exec(lines[controllerIndex])?.[1] ?? '';
  // class-level decorators sit between @Controller and the `export class` line
  let classLevelGuarded = false;
  for (let i = controllerIndex; i < lines.length && !/^\s*export class/.test(lines[i]); i++) {
    if (AUTH_GUARD.test(lines[i])) classLevelGuarded = true;
  }
  if (classLevelGuarded) return [];

  const out: RouteInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = HTTP_DECORATOR.exec(lines[i]);
    if (!match) continue;
    let start = i;
    while (start > 0 && /^\s*@/.test(lines[start - 1])) start--;
    let end = i;
    while (end + 1 < lines.length && /^\s*(@|\/\/)/.test(lines[end + 1])) end++;
    const decorators = lines.slice(start, end + 1).map((l) => l.trim());
    if (decorators.some((d) => AUTH_GUARD.test(d))) continue;
    const path = [prefix, match[2] ?? ''].filter(Boolean).join('/');
    out.push({ route: `${match[1].toUpperCase()} /${path}`, decorators });
  }
  return out;
}

/** Reviewed public routes. Keep in sync with docs/security-performance-policy.md. */
const REVIEWED_PUBLIC_ROUTES = new Set([
  'POST /auth/login', // rate limited
  'POST /client/login', // rate limited
  'GET /sub/:token', // rate limited, token-shape + HMAC checked
  'POST /payments/paypal/webhook', // rate limited, PayPal signature verified
  'POST /rewarded-ads/webhook', // rate limited, HMAC verified
  'GET /health',
  // KNOWN GAP (reported, not fixed here): read-only server metrics are public
  // because the dashboard fetches them without a bearer token.
  'GET /metrics/latest',
  'GET /metrics/timeseries',
]);

/** Public routes that accept credentials or signed payloads must carry the rate-limit guard. */
const MUST_BE_RATE_LIMITED = [
  'POST /auth/login',
  'POST /client/login',
  'GET /sub/:token',
  'POST /payments/paypal/webhook',
  'POST /rewarded-ads/webhook',
];

describe('public route guards (security regression)', () => {
  const routes = listControllerFiles(srcDir)
    .filter((file) => !relative(srcDir, file).startsWith('telegram'))
    .flatMap((file) => unguardedRoutes(file));
  const byRoute = new Map(routes.map((r) => [r.route, r]));

  it('every unauthenticated route is on the reviewed allowlist', () => {
    const unexpected = routes.map((r) => r.route).filter((route) => !REVIEWED_PUBLIC_ROUTES.has(route));
    assert.deepEqual(unexpected, [], `unreviewed public routes:\n${unexpected.join('\n')}`);
  });

  it('credential-accepting public routes use RateLimitGuard with a @RateLimit budget', () => {
    for (const route of MUST_BE_RATE_LIMITED) {
      const info = byRoute.get(route);
      assert.ok(info, `${route} not found among public routes`);
      assert.ok(info.decorators.some((d) => /@UseGuards\(.*RateLimitGuard/.test(d)), `${route} lacks RateLimitGuard`);
      assert.ok(info.decorators.some((d) => /^@RateLimit\(\{/.test(d)), `${route} lacks @RateLimit options`);
    }
  });
});
