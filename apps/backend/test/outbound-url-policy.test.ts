import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAllowedOutboundUrl } from '../src/outbound/outbound-url-policy.ts';

describe('assertAllowedOutboundUrl (SSRF policy)', () => {
  it('allows ordinary http and https targets and returns a URL', () => {
    assert.equal(assertAllowedOutboundUrl('https://api.telegram.org/bot/sendMessage').hostname, 'api.telegram.org');
    assert.equal(assertAllowedOutboundUrl('http://127.0.0.1:7777/health').protocol, 'http:');
  });

  it('rejects non-http(s) schemes (file/ftp/gopher/data)', () => {
    for (const url of ['file:///etc/passwd', 'ftp://x/y', 'gopher://x', 'data:text/plain,hi']) {
      assert.throws(() => assertAllowedOutboundUrl(url), /must use http or https/);
    }
  });

  it('rejects malformed URLs', () => {
    assert.throws(() => assertAllowedOutboundUrl('not a url'), /not a valid URL/);
    assert.throws(() => assertAllowedOutboundUrl(''), /not a valid URL/);
  });

  it('blocks cloud metadata endpoints (SSRF hardening)', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'https://metadata.google.internal/computeMetadata/v1/',
      'http://metadata.goog/',
      'http://[fd00:ec2::254]/latest/',
    ]) {
      assert.throws(() => assertAllowedOutboundUrl(url), /metadata endpoint/);
    }
  });
});
