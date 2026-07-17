import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceNetworkKey, countDistinctNetworks } from '../src/billing/device-sharing.ts';

test('IPv4 collapses to /16', () => {
  assert.equal(sourceNetworkKey('151.238.178.95'), '151.238.0.0/16');
  assert.equal(sourceNetworkKey('151.238.176.118'), '151.238.0.0/16');
});

test('the Irelandcell mobile-rotation case counts as ONE network', () => {
  // Erfan 2026-06-27: two 151.238.x = same phone rotating, two others = real.
  const ips = ['151.238.178.95', '151.238.176.118', '5.125.35.52', '113.203.43.106'];
  assert.equal(ips.length, 4); // naive distinct-IP count
  assert.equal(countDistinctNetworks(ips), 3); // honest network count
});

test('IPv6 collapses to a /32 prefix', () => {
  assert.equal(sourceNetworkKey('2a01:4f8:1:2::3'), '2a01:4f8::/32');
  assert.equal(countDistinctNetworks(['2a01:4f8:1:2::3', '2a01:4f8:9:9::9']), 1);
});

test('empty + single', () => {
  assert.equal(countDistinctNetworks([]), 0);
  assert.equal(countDistinctNetworks(['8.8.8.8']), 1);
});
