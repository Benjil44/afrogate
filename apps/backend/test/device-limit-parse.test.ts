import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOnlineIpList } from '../src/client/device-limit.util.ts';

test('no ips field (offline user) → empty', () => {
  assert.deepEqual(parseOnlineIpList('{"name":"user>>>cc_abc@afrows>>>online"}'), []);
});

test('ips as object keyed by IP → keys', () => {
  const out = parseOnlineIpList('{"name":"x","ips":{"203.0.113.7":1693,"198.51.100.9":1694}}');
  assert.deepEqual(out.sort(), ['198.51.100.9', '203.0.113.7']);
});

test('ips as array of strings', () => {
  assert.deepEqual(parseOnlineIpList('{"ips":["203.0.113.7","203.0.113.8"]}').sort(), [
    '203.0.113.7',
    '203.0.113.8',
  ]);
});

test('ips as array of {ip} objects', () => {
  const out = parseOnlineIpList('{"ips":[{"ip":"203.0.113.7","time":"t"},{"ip":"203.0.113.7"}]}');
  assert.deepEqual(out, ['203.0.113.7']); // de-duped
});

test('IPv6 addresses parsed', () => {
  const out = parseOnlineIpList('{"ips":{"2a01:4f8:1:2::3":1}}');
  assert.deepEqual(out, ['2a01:4f8:1:2::3']);
});

test('malformed JSON → regex fallback picks up IP literals', () => {
  const out = parseOnlineIpList('garbage 203.0.113.7 more 198.51.100.9 text');
  assert.deepEqual(out.sort(), ['198.51.100.9', '203.0.113.7']);
});

test('name field never yields a false-positive IP', () => {
  assert.deepEqual(parseOnlineIpList('{"name":"user>>>cc_fc78481a-d9fe-4d17@afrows>>>online","ips":{}}'), []);
});
