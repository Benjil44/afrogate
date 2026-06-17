import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUserStats } from '../src/client/xray-usage.ts';

test('sums uplink+downlink per client_config id', () => {
  const json = JSON.stringify({
    stat: [
      { name: 'user>>>cc_5b69359d-214b-47f8-b46c-55f52ce57f27@afrows>>>traffic>>>uplink', value: '1000' },
      { name: 'user>>>cc_5b69359d-214b-47f8-b46c-55f52ce57f27@afrows>>>traffic>>>downlink', value: '9000' },
      { name: 'user>>>cc_other-id@afrows>>>traffic>>>uplink', value: '500' },
      { name: 'inbound>>>afrows-in>>>traffic>>>downlink', value: '12345' }, // ignored
    ],
  });
  const deltas = parseUserStats(json);
  const map = new Map(deltas.map((d) => [d.clientConfigId, d.bytes]));
  assert.equal(map.get('5b69359d-214b-47f8-b46c-55f52ce57f27'), 10000);
  assert.equal(map.get('other-id'), 500);
  assert.equal(map.size, 2);
});

test('ignores zero/invalid values and malformed json', () => {
  assert.deepEqual(parseUserStats('not json'), []);
  assert.deepEqual(parseUserStats(JSON.stringify({ stat: [] })), []);
  const json = JSON.stringify({ stat: [{ name: 'user>>>cc_x@afrows>>>traffic>>>uplink', value: '0' }] });
  assert.deepEqual(parseUserStats(json), []);
});
