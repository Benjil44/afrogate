import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import {
  ARCHIVED_ACCOUNT_STATUS,
  archiveCustomerAccountInTransaction,
  isWireguardConfig,
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
