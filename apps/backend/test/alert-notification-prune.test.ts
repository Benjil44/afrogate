/**
 * AlertNotificationService keeps a per-alert "last Telegram attempt" stamp for
 * its cooldown. Stamps older than the cooldown are equivalent to no stamp, so
 * they are pruned each pass instead of accumulating forever.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

type Service = {
  deliverCriticalAlerts(): Promise<void>;
  lastAttemptByAlert: Map<string, number>;
};
type ServiceCtor = new (config: unknown, operations: unknown, telegram: unknown, audit: unknown) => Service;

describe('AlertNotificationService attempt-stamp pruning', { skip: bundledSkipReason }, () => {
  const { AlertNotificationService } = loadBundled<{ AlertNotificationService: ServiceCtor }>(
    'notifications/alert-notification.service.ts',
    { quiet: true },
  );

  function build(openAlerts: Array<{ id: string }>) {
    const sent: string[] = [];
    const service = new AlertNotificationService(
      { get: () => undefined }, // defaults: cooldown 300s
      { listAlerts: async () => openAlerts.map((a) => ({ ...a, sourceType: 'server', sourceId: 's', severity: 'critical' })) },
      {
        isEnabled: async () => true,
        isConfigured: async () => true,
        sendAlert: async (alert: { id: string }) => {
          sent.push(alert.id);
          return { status: 'sent', durationMs: 1 };
        },
      },
      { recordBestEffort: async () => undefined },
    );
    return { service, sent };
  }

  it('drops expired stamps (resolved alerts) and keeps fresh ones; cooldown unchanged', async () => {
    const { service, sent } = build([{ id: 'open-fresh' }]);
    const now = Date.now();
    service.lastAttemptByAlert.set('resolved-long-ago', now - 10 * 60_000);
    service.lastAttemptByAlert.set('open-fresh', now - 60_000);

    await service.deliverCriticalAlerts();

    assert.equal(service.lastAttemptByAlert.has('resolved-long-ago'), false);
    assert.equal(service.lastAttemptByAlert.has('open-fresh'), true);
    assert.deepEqual(sent, [], 'an alert inside its cooldown is still not re-sent');
  });

  it('re-sends an alert whose cooldown expired (pruned stamp behaves like no stamp)', async () => {
    const { service, sent } = build([{ id: 'open-old' }]);
    service.lastAttemptByAlert.set('open-old', Date.now() - 10 * 60_000);
    await service.deliverCriticalAlerts();
    assert.deepEqual(sent, ['open-old']);
    assert.equal(service.lastAttemptByAlert.has('open-old'), true);
  });
});
