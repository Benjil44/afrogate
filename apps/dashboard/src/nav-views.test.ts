import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_VIEWS, ADVANCED_VIEWS, parseAdvancedMode, serializeAdvancedMode } from './nav-views.ts';

// Views shown in the sidebar after D1 (outbounds/routes/microtiks routable but hidden).
const SIDEBAR_VIEWS = [
  'dashboard', 'customers', 'billing', 'resellers', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  'network', 'servers', 'audit', 'backups', 'reports',
];

test('Main has the 9 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'resellers', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  ]);
});

test('Advanced has the 5 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, ['network', 'servers', 'audit', 'backups', 'reports']);
});

test('sidebar groups: no duplicates, and outbounds/routes/microtiks are hidden', () => {
  const union = [...MAIN_VIEWS, ...ADVANCED_VIEWS];
  assert.equal(new Set(union).size, union.length, 'duplicate view across groups');
  assert.deepEqual([...union].sort(), [...SIDEBAR_VIEWS].sort(), 'union != expected sidebar set');
  assert.ok(!union.includes('outbounds'), 'outbounds must not be a sidebar item');
  assert.ok(!union.includes('routes'), 'routes must not be a sidebar item');
  assert.ok(!union.includes('inbounds'), 'inbounds must not be a sidebar item');
  assert.ok(!union.includes('connections'), 'connections must not be a sidebar item');
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
