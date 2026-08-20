import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { assertAllowedOutboundUrl } from '../src/outbound/outbound-url-policy.ts';

// Regression guards for CodeQL js/request-forgery (alert #7): the admin-set
// outbound_subscriptions.url was fetched with a raw global fetch(redirect:'follow'),
// letting a 302 reach cloud-metadata / internal hosts. The fix routes the fetch
// through OutboundHttpService, whose sanitizer boundary is assertAllowedOutboundUrl
// and which does not follow redirects. All tests below are deterministic - no
// network, no sockets, no probabilistic sampling.

const here = dirname(fileURLToPath(import.meta.url));
const operationsServiceSrc = join(here, '..', 'src', 'operations', 'operations.service.ts');

describe('subscription fetch SSRF hardening — no-raw-fetch static guard', () => {
  it('operations.service.ts makes no raw global fetch() call', () => {
    const src = readFileSync(operationsServiceSrc, 'utf8');
    // Strip block/JSDoc comments then line comments, so prose like "re-fetch"
    // or the fix's own explanatory comment cannot mask (or fake) a regression;
    // then look for an actual call.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    // A raw call is `fetch(` NOT preceded by `.` (which would be this.outboundHttp
    // .request / a method named *fetch* on an object). The global sink is bare fetch(.
    const rawFetch = /(^|[^.\w])fetch\s*\(/;
    assert.doesNotMatch(
      code,
      rawFetch,
      'operations.service.ts must not call the raw global fetch() - route outbound HTTP through OutboundHttpService (SSRF boundary + no redirect follow).',
    );
  });

  it('routes the subscription fetch through OutboundHttpService', () => {
    const src = readFileSync(operationsServiceSrc, 'utf8');
    assert.match(src, /this\.outboundHttp\.request\(/, 'expected the subscription fetch to use OutboundHttpService.request()');
    assert.match(src, /private readonly outboundHttp: OutboundHttpService/, 'expected OutboundHttpService injected via constructor DI');
  });
});

describe('subscription fetch SSRF hardening — policy boundary (assertAllowedOutboundUrl)', () => {
  it('rejects the cloud-metadata endpoint an SSRF would target', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://[fd00:ec2::254]/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
    ]) {
      assert.throws(() => assertAllowedOutboundUrl(url), /metadata endpoint/, `expected ${url} to be blocked`);
    }
  });

  it('rejects non-http(s) schemes that a subscription URL must never use', () => {
    for (const url of ['file:///etc/passwd', 'gopher://127.0.0.1:6379/_INFO', 'ftp://internal/host', 'data:text/plain,hi']) {
      assert.throws(() => assertAllowedOutboundUrl(url), /must use http or https/, `expected ${url} to be rejected`);
    }
  });

  it('rejects malformed URLs', () => {
    assert.throws(() => assertAllowedOutboundUrl('not a url'), /not a valid URL/);
    assert.throws(() => assertAllowedOutboundUrl(''), /not a valid URL/);
  });

  it('still allows a legitimate external subscription URL (no over-blocking)', () => {
    const ok = assertAllowedOutboundUrl('https://sub.example.com/link?token=abc');
    assert.equal(ok.protocol, 'https:');
    assert.equal(ok.hostname, 'sub.example.com');
  });
});
