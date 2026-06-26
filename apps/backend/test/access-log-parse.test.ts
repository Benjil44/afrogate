import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAccessLogLine } from '../src/client/access-log-parse.ts';

test('extracts {configId, ip} from a real afrows-in line', () => {
  const line = '2026/06/26 15:21:55.200222 from 203.0.113.7:42744 accepted tcp:34.120.33.51:443 [afrows-in -> via-germany] email: cc_fc78481a-d9fe-4d17-a89b-3c493f1152e0@afrows';
  assert.deepEqual(parseAccessLogLine(line), { configId: 'fc78481a-d9fe-4d17-a89b-3c493f1152e0', ip: '203.0.113.7' });
});

test('ignores localhost + non-matching lines', () => {
  assert.equal(parseAccessLogLine('x from 127.0.0.1:5 accepted tcp:y [afrows-in -> z] email: cc_abc@afrows'), null);
  assert.equal(parseAccessLogLine('random log line'), null);
  assert.equal(parseAccessLogLine('x from [::1]:5 accepted tcp:y [afrows-in -> z] email: cc_abc@afrows'), null);
});

test('handles IPv6 source', () => {
  const line = '2026/.. from [2a01:4f8:1:2::3]:51000 accepted tcp:y:443 [afrows-in -> z] email: cc_dead-beef@afrows';
  assert.deepEqual(parseAccessLogLine(line), { configId: 'dead-beef', ip: '2a01:4f8:1:2::3' });
});
