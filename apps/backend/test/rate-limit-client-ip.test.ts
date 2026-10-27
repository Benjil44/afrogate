/**
 * Rate-limit keying behind Cloudflare → nginx (`$proxy_add_x_forwarded_for`):
 * the FIRST X-Forwarded-For entry is client-chosen, so keying on it let a random
 * value per request bypass every per-IP limit (and let a spoofed CGNAT IP lock
 * real customers out). Plus the per-identifier budget on POST /client/login.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveClientIp } from '../src/security/client-ip.ts';
import { bundledSkipReason, loadBundled, requireBackendDependency } from './helpers/load-bundled.ts';

describe('resolveClientIp', () => {
  it('uses the TCP peer when proxy headers are not trusted', () => {
    assert.equal(resolveClientIp({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }, '10.0.0.5', false), '10.0.0.5');
  });

  it('prefers cf-connecting-ip, then x-real-ip, then the LAST x-forwarded-for hop', () => {
    const xff = '6.6.6.6, 203.0.113.9';
    assert.equal(resolveClientIp({ 'cf-connecting-ip': '198.51.100.7', 'x-real-ip': '192.0.2.1', 'x-forwarded-for': xff }, '127.0.0.1', true), '198.51.100.7');
    assert.equal(resolveClientIp({ 'x-real-ip': '192.0.2.1', 'x-forwarded-for': xff }, '127.0.0.1', true), '192.0.2.1');
    assert.equal(resolveClientIp({ 'x-forwarded-for': xff }, '127.0.0.1', true), '203.0.113.9');
    assert.equal(resolveClientIp({}, '127.0.0.1', true), '127.0.0.1');
  });

  it('never keys on the client-chosen first x-forwarded-for entry', () => {
    for (let i = 0; i < 20; i++) {
      const spoofed = `10.${i}.${i}.${i}`;
      assert.equal(resolveClientIp({ 'x-forwarded-for': `${spoofed}, 203.0.113.9` }, '127.0.0.1', true), '203.0.113.9');
    }
  });

  it('ignores non-IP and duplicated single-value headers', () => {
    assert.equal(resolveClientIp({ 'cf-connecting-ip': 'evil', 'x-real-ip': '192.0.2.1' }, 'p', true), '192.0.2.1');
    assert.equal(resolveClientIp({ 'cf-connecting-ip': ['1.1.1.1', '2.2.2.2'], 'x-real-ip': '192.0.2.1' }, 'p', true), '192.0.2.1');
    assert.equal(resolveClientIp({ 'x-forwarded-for': ['9.9.9.9', '203.0.113.9'] }, 'p', true), '203.0.113.9');
    assert.equal(resolveClientIp({ 'cf-connecting-ip': '2001:db8::1' }, 'p', true), '2001:db8::1');
  });
});

type RateLimitServiceCtor = new (config: { get(name: string): string | undefined }) => {
  enforce(key: string, options: { key: string; max: number; windowMs: number }): void;
};

describe('RateLimitGuard with trusted proxy headers', { skip: bundledSkipReason }, () => {
  const { RateLimitGuard } = loadBundled<{ RateLimitGuard: new (reflector: unknown, service: unknown) => { canActivate(ctx: unknown): boolean } }>(
    'security/rate-limit.guard.ts',
  );
  const { RateLimitService } = loadBundled<{ RateLimitService: RateLimitServiceCtor }>('security/rate-limit.service.ts');
  const { HttpException } = requireBackendDependency<typeof import('@nestjs/common')>('@nestjs/common');

  function guardFor(max: number) {
    const config = { get: (name: string) => (name === 'AFROWS_RATE_LIMIT_TRUST_PROXY_HEADERS' ? 'true' : undefined) };
    const reflector = { getAllAndOverride: () => ({ key: 'auth-login', max, windowMs: 60_000 }) };
    return new RateLimitGuard(reflector, new RateLimitService(config));
  }
  function ctx(headers: Record<string, string>) {
    const request = { headers, ip: '127.0.0.1' };
    const response = { setHeader: () => undefined };
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    };
  }

  it('a random spoofed first XFF entry per request does not escape the limit', () => {
    const guard = guardFor(3);
    for (let i = 0; i < 3; i++) {
      assert.equal(guard.canActivate(ctx({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.9` })), true);
    }
    assert.throws(() => guard.canActivate(ctx({ 'x-forwarded-for': '10.9.9.9, 203.0.113.9' })), HttpException);
  });

  it('distinct real clients (cf-connecting-ip set by our proxy) keep separate buckets', () => {
    const guard = guardFor(1);
    assert.equal(guard.canActivate(ctx({ 'cf-connecting-ip': '198.51.100.1' })), true);
    assert.equal(guard.canActivate(ctx({ 'cf-connecting-ip': '198.51.100.2' })), true);
    assert.throws(() => guard.canActivate(ctx({ 'cf-connecting-ip': '198.51.100.1' })), HttpException);
  });
});

describe('POST /client/login per-identifier budget', { skip: bundledSkipReason }, () => {
  const { ClientAuthController, CLIENT_LOGIN_IDENTIFIER_LIMIT } = loadBundled<{
    ClientAuthController: new (billing: unknown, rateLimit: unknown) => {
      login(body: { identifier: string; password: string }): Promise<unknown>;
    };
    CLIENT_LOGIN_IDENTIFIER_LIMIT: { max: number; windowMs: number };
  }>('client/client-auth.controller.ts', { quiet: true });
  const { RateLimitService } = loadBundled<{ RateLimitService: RateLimitServiceCtor }>('security/rate-limit.service.ts');
  const { HttpException } = requireBackendDependency<typeof import('@nestjs/common')>('@nestjs/common');

  function build(enabled = true) {
    let lookups = 0;
    const billing = {
      loginClientByPassword: async () => {
        lookups += 1;
        return { token: 't' };
      },
    };
    const config = { get: (name: string) => (name === 'AFROWS_RATE_LIMIT_ENABLED' && !enabled ? 'false' : undefined) };
    const controller = new ClientAuthController(billing, new RateLimitService(config));
    return { controller, lookups: () => lookups };
  }

  it('allows 10/min per identifier (case/space-insensitive), then 429 before any password check', async () => {
    assert.equal(CLIENT_LOGIN_IDENTIFIER_LIMIT.max, 10);
    const { controller, lookups } = build();
    for (let i = 0; i < 10; i++) {
      await controller.login({ identifier: i % 2 ? ' Ali@Example.com ' : 'ali@example.com', password: 'x' });
    }
    assert.throws(() => controller.login({ identifier: 'ALI@example.com', password: 'x' }), HttpException);
    assert.equal(lookups(), 10);
    await controller.login({ identifier: 'other@example.com', password: 'x' });
    assert.equal(lookups(), 11, 'other identifiers are unaffected');
  });

  it('is a no-op when rate limiting is disabled', async () => {
    const { controller, lookups } = build(false);
    for (let i = 0; i < 15; i++) await controller.login({ identifier: 'a@b.c', password: 'x' });
    assert.equal(lookups(), 15);
  });
});
