import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_GROUPS,
  ORPHAN_VIEW_REDIRECTS,
  RESELLER_NAV_GROUPS,
  activeNavEntryId,
  parseCollapsedGroups,
  serializeCollapsedGroups,
} from './nav-views.ts';

const GROUP_ORDER = ['overview', 'customers', 'revenue', 'infrastructure', 'observability', 'automation', 'settings'];

test('admin sidebar has the 7 CTO-plan groups in order', () => {
  assert.deepEqual(NAV_GROUPS.map((group) => group.id), GROUP_ORDER);
});

test('every sidebar entry id is unique (one nav item per feature)', () => {
  const ids = NAV_GROUPS.flatMap((group) => group.entries.map((entry) => entry.id));
  assert.equal(new Set(ids).size, ids.length, 'duplicate entry id across groups');
});

test('no two entries address the same view+tab (one URL per feature)', () => {
  const addresses = NAV_GROUPS.flatMap((group) => group.entries.map((entry) => `${entry.view}?tab=${entry.tab ?? ''}`));
  assert.equal(new Set(addresses).size, addresses.length, 'duplicate view+tab address');
});

test('orphan views are redirected, never sidebar entries', () => {
  const orphans = ['routes', 'outbounds', 'inbounds', 'connections'] as const;
  const entryViews = new Set(NAV_GROUPS.flatMap((group) => group.entries.map((entry) => entry.view)));
  for (const orphan of orphans) {
    assert.ok(!entryViews.has(orphan), `${orphan} must not be a sidebar entry`);
    const redirect = ORPHAN_VIEW_REDIRECTS[orphan];
    assert.ok(redirect, `${orphan} must redirect to a canonical URL`);
    // The redirect target must itself be a real sidebar destination.
    const target = NAV_GROUPS.flatMap((group) => group.entries)
      .find((entry) => entry.view === redirect.view && (entry.tab === redirect.tab || entry.tab === undefined));
    assert.ok(target, `${orphan} redirect target ${redirect.view}?tab=${redirect.tab} has no sidebar entry`);
  }
});

test('reseller sidebar is scoped to Overview + Customers + Revenue', () => {
  assert.deepEqual(RESELLER_NAV_GROUPS.map((group) => group.id), ['overview', 'customers', 'revenue']);
  const views = RESELLER_NAV_GROUPS.flatMap((group) => group.entries.map((entry) => entry.view));
  assert.deepEqual([...views].sort(), ['billing', 'dashboard', 'users']);
});

test('activeNavEntryId: exact tab match wins, then untabbed, then first', () => {
  assert.equal(activeNavEntryId(NAV_GROUPS, 'exits', 'routing'), 'exits-routing');
  assert.equal(activeNavEntryId(NAV_GROUPS, 'exits', 'sources'), 'exits-sources');
  // No tab -> the view's first entry (Exits egress).
  assert.equal(activeNavEntryId(NAV_GROUPS, 'exits', null), 'exits');
  // Settings without a tab -> the untabbed Settings entry, not Telegram bot.
  assert.equal(activeNavEntryId(NAV_GROUPS, 'settings', null), 'settings');
  assert.equal(activeNavEntryId(NAV_GROUPS, 'settings', 'telegram'), 'telegram-bot');
  // Unknown tab falls back to the untabbed entry.
  assert.equal(activeNavEntryId(NAV_GROUPS, 'settings', 'branding'), 'settings');
  assert.equal(activeNavEntryId(NAV_GROUPS, 'routes', null), null);
});

test('collapsed groups round-trip and tolerate garbage', () => {
  assert.deepEqual(parseCollapsedGroups(serializeCollapsedGroups(['revenue', 'automation'])), ['revenue', 'automation']);
  assert.deepEqual(parseCollapsedGroups(null), []);
  assert.deepEqual(parseCollapsedGroups('not json'), []);
  assert.deepEqual(parseCollapsedGroups('{"a":1}'), []);
  assert.deepEqual(parseCollapsedGroups('["bogus","settings"]'), ['settings']);
});
