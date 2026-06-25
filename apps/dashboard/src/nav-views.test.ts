import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_VIEWS, ADVANCED_VIEWS, parseAdvancedMode, serializeAdvancedMode } from './nav-views.ts';

const ALL_VIEWS = [
  'dashboard', 'servers', 'users', 'customers', 'connections', 'inbounds',
  'audit', 'backups', 'billing', 'reports', 'routes', 'outbounds',
  'microtiks', 'alerts', 'settings',
];

test('Main has the 8 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'outbounds', 'microtiks', 'alerts', 'users', 'settings',
  ]);
});

test('Advanced has the 7 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, [
    'servers', 'inbounds', 'connections', 'routes', 'audit', 'backups', 'reports',
  ]);
});

test('Main + Advanced cover every ActiveView exactly once', () => {
  const union = [...MAIN_VIEWS, ...ADVANCED_VIEWS];
  assert.equal(union.length, ALL_VIEWS.length, 'wrong total count');
  assert.equal(new Set(union).size, union.length, 'duplicate view across groups');
  assert.deepEqual([...union].sort(), [...ALL_VIEWS].sort(), 'union != all views');
});

test('parseAdvancedMode: only "enabled" is true; default false', () => {
  assert.equal(parseAdvancedMode('enabled'), true);
  assert.equal(parseAdvancedMode('disabled'), false);
  assert.equal(parseAdvancedMode(null), false);
  assert.equal(parseAdvancedMode(''), false);
});

test('serializeAdvancedMode round-trips through parseAdvancedMode', () => {
  assert.equal(parseAdvancedMode(serializeAdvancedMode(true)), true);
  assert.equal(parseAdvancedMode(serializeAdvancedMode(false)), false);
});
