import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import {
  ACTIVE_ACCOUNT_STATUS,
  ARCHIVED_ACCOUNT_STATUS,
  archiveCustomerAccountInTransaction,
  customerAccountArchivedWhereClause,
  isWireguardConfig,
  restoreCustomerAccountInTransaction,
} from '../src/billing/customer-account-deletion.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('isWireguardConfig', () => {
  it('is case-insensitive and null-safe', () => {
    assert.equal(isWireguardConfig('wireguard'), true);
    assert.equal(isWireguardConfig('WireGuard'), true);
    assert.equal(isWireguardConfig('vless'), false);
    assert.equal(isWireguardConfig(null), false);
    assert.equal(isWireguardConfig(undefined), false);
  });
});

describe('archiveCustomerAccountInTransaction', () => {
  it('throws NotFound and touches nothing when the account does not exist', async () => {
    const executor = createFakeExecutor([{ rows: [] }]); // lock returns no rows
    let audited = false;
    await assert.rejects(
      archiveCustomerAccountInTransaction(executor, 'missing-id', async () => {
        audited = true;
      }),
      NotFoundException,
    );
    assert.equal(executor.calls.length, 1); // only the lock query ran
    assert.match(executor.calls[0].text, /SELECT id, deleted_at .* FROM customer_accounts WHERE id = \$1 FOR UPDATE/s);
    assert.deepEqual(executor.calls[0].values, ['missing-id']);
    assert.equal(audited, false);
  });

  it('is idempotent for an already-archived account (no writes, no audit)', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-1', deletedAt: '2026-07-24T00:00:00Z' }] }, // already archived
    ]);
    let audited = false;
    const outcome = await archiveCustomerAccountInTransaction(executor, 'acct-1', async () => {
      audited = true;
    });
    assert.deepEqual(outcome, { alreadyArchived: true, wgPeersMarkedAbsent: 0 });
    assert.equal(executor.calls.length, 1); // only the lock; nothing mutated
    assert.equal(audited, false);
    assert.equal(
      executor.calls.some((c) => /UPDATE (customer_accounts|wireguard_peers)/.test(c.text)),
      false,
    );
  });

  it('archives: stamps deleted_at + disables status + marks WG peers absent + audits, keeping configs', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-1', deletedAt: null }] }, // lock (live account)
      {
        rows: [
          { id: 'cfg-wg', protocol: 'wireguard' },
          { id: 'cfg-vless', protocol: 'vless' },
        ],
      }, // client_configs
      { rows: [{}] }, // peer UPDATE affected 1 row
      { rows: [] }, // account UPDATE
    ]);

    let auditMetadata: Record<string, unknown> | null = null;
    const outcome = await archiveCustomerAccountInTransaction(executor, 'acct-1', async (metadata) => {
      auditMetadata = metadata;
    });

    assert.deepEqual(outcome, { alreadyArchived: false, wgPeersMarkedAbsent: 1 });
    assert.deepEqual(auditMetadata, { soft: true, wgPeersMarkedAbsent: 1 });

    const texts = executor.calls.map((c) => c.text);

    // Peer marked absent only for the WireGuard config, bound by client_config_id.
    const wgCall = executor.calls.find((c) => /UPDATE wireguard_peers/.test(c.text));
    assert.ok(wgCall, 'wireguard peer should be marked absent');
    assert.match(wgCall.text, /desired_state = 'absent'/);
    assert.deepEqual(wgCall.values, ['cfg-wg']);
    assert.equal(
      texts.filter((t) => /UPDATE wireguard_peers/.test(t)).length,
      1,
      'only the wireguard config should touch wireguard_peers',
    );

    // Account is archived + disabled, NOT deleted. Retention: nothing is DELETEd.
    const acctUpdate = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text));
    assert.ok(acctUpdate, 'account row must be updated');
    assert.match(acctUpdate.text, /SET deleted_at = now\(\), status = \$2/);
    assert.deepEqual(acctUpdate.values, ['acct-1', ARCHIVED_ACCOUNT_STATUS]);
    assert.equal(ARCHIVED_ACCOUNT_STATUS, 'disabled');

    // Retention guarantees: no hard deletes of the account or any history/config rows.
    assert.equal(
      texts.some((t) => /DELETE FROM/i.test(t)),
      false,
      'archive must not hard-delete any rows (client_configs / payment history retained)',
    );

    // Ordering: peers-absent before the account archive stamp.
    const idxPeer = texts.findIndex((t) => /UPDATE wireguard_peers/.test(t));
    const idxAcct = texts.findIndex((t) => /UPDATE customer_accounts/.test(t));
    assert.ok(idxPeer < idxAcct, 'peers marked absent before the account is archived');
  });

  it('reports zero WG peers when the account has no WireGuard config', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-2', deletedAt: null }] },
      { rows: [{ id: 'cfg-vless', protocol: 'vless' }] },
      { rows: [] }, // account UPDATE
    ]);
    const outcome = await archiveCustomerAccountInTransaction(executor, 'acct-2', async () => {});
    assert.deepEqual(outcome, { alreadyArchived: false, wgPeersMarkedAbsent: 0 });
    assert.equal(
      executor.calls.some((c) => /UPDATE wireguard_peers/.test(c.text)),
      false,
    );
    assert.ok(executor.calls.some((c) => /UPDATE customer_accounts/.test(c.text)));
  });
});

describe('restoreCustomerAccountInTransaction', () => {
  it('throws NotFound and touches nothing when the account does not exist', async () => {
    const executor = createFakeExecutor([{ rows: [] }]); // lock returns no rows
    let audited = false;
    await assert.rejects(
      restoreCustomerAccountInTransaction(executor, 'missing-id', async () => {
        audited = true;
      }),
      NotFoundException,
    );
    assert.equal(executor.calls.length, 1); // only the lock query ran
    assert.deepEqual(executor.calls[0].values, ['missing-id']);
    assert.equal(audited, false);
  });

  it('is idempotent for an already-active account (no writes, no audit)', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-1', deletedAt: null }] }, // already live
    ]);
    let audited = false;
    const outcome = await restoreCustomerAccountInTransaction(executor, 'acct-1', async () => {
      audited = true;
    });
    assert.deepEqual(outcome, { alreadyActive: true, wgPeersRestored: 0 });
    assert.equal(executor.calls.length, 1); // only the lock; nothing mutated
    assert.equal(audited, false);
    assert.equal(
      executor.calls.some((c) => /UPDATE (customer_accounts|wireguard_peers)/.test(c.text)),
      false,
    );
  });

  it('restores: clears deleted_at + re-enables status + re-arms peers + audits', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-1', deletedAt: '2026-07-24T00:00:00Z' }] }, // lock (archived)
      { rows: [] }, // account UPDATE
      { rows: [{ id: 'p1' }, { id: 'p2' }] }, // peer re-arm UPDATE flipped 2 peers
    ]);

    let auditMetadata: Record<string, unknown> | null = null;
    const outcome = await restoreCustomerAccountInTransaction(executor, 'acct-1', async (metadata) => {
      auditMetadata = metadata;
    });

    assert.deepEqual(outcome, { alreadyActive: false, wgPeersRestored: 2 });
    assert.deepEqual(auditMetadata, { restored: true, wgPeersRestored: 2 });

    // Account cleared + re-enabled to the live status, NOT deleted.
    const acctUpdate = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text));
    assert.ok(acctUpdate, 'account row must be updated');
    assert.match(acctUpdate.text, /SET deleted_at = NULL, status = \$2/);
    assert.deepEqual(acctUpdate.values, ['acct-1', ACTIVE_ACCOUNT_STATUS]);
    assert.equal(ACTIVE_ACCOUNT_STATUS, 'active');

    // Peers flipped absent -> present, guarded by non-disabled config + under quota.
    const wgUpdate = executor.calls.find((c) => /UPDATE wireguard_peers/.test(c.text));
    assert.ok(wgUpdate, 'wireguard peers must be re-armed');
    assert.match(wgUpdate.text, /desired_state = 'present'/);
    assert.match(wgUpdate.text, /wp\.desired_state = 'absent'/);
    assert.match(wgUpdate.text, /cc\.status <> 'disabled'/);
    assert.deepEqual(wgUpdate.values, ['acct-1']);

    // Nothing is hard-deleted on restore.
    assert.equal(executor.calls.some((c) => /DELETE FROM/i.test(c.text)), false);
  });

  it('reports zero restored peers when no absent peer matches', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'acct-2', deletedAt: '2026-07-24T00:00:00Z' }] },
      { rows: [] }, // account UPDATE
      { rows: [] }, // peer re-arm matched nothing
    ]);
    let audited = false;
    const outcome = await restoreCustomerAccountInTransaction(executor, 'acct-2', async () => {
      audited = true;
    });
    assert.deepEqual(outcome, { alreadyActive: false, wgPeersRestored: 0 });
    assert.equal(audited, true);
  });
});

describe('customerAccountArchivedWhereClause', () => {
  it('defaults to live-only (hides archived) for undefined / active', () => {
    assert.equal(customerAccountArchivedWhereClause(undefined), 'ca.deleted_at IS NULL');
    assert.equal(customerAccountArchivedWhereClause('active'), 'ca.deleted_at IS NULL');
  });

  it('surfaces only archived rows for "only"', () => {
    assert.equal(customerAccountArchivedWhereClause('only'), 'ca.deleted_at IS NOT NULL');
  });

  it('applies no archived predicate for "all"', () => {
    assert.equal(customerAccountArchivedWhereClause('all'), null);
  });
});
