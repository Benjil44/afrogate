import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VILLAGE_ALERT_RECOVERY_WINDOW_MS,
  buildVillageAlertMessage,
  decideVillageAlert,
  formatOutageDuration,
  formatUtcMinute,
  isVillageTransition,
  resolveReminderIntervalMs,
  type VillageAlertDecisionInput,
  type VillageOutage,
} from '../src/notifications/village-egress-alert.ts';
import { TELEGRAM_COPY, renderTelegramCopy } from '../src/telegram/telegram-i18n.ts';
import { applyRtlGuard, toPersianDigits } from '../src/telegram/telegram-format.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const SIX_HOURS = 6 * HOUR;
const T0 = new Date('2026-09-12T15:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const open: VillageOutage = { id: 'o1', startedAt: T0, resolvedAt: null };
const resolved = (durationMs: number): VillageOutage => ({ id: 'o1', startedAt: T0, resolvedAt: at(durationMs) });

function input(over: Partial<VillageAlertDecisionInput>): VillageAlertDecisionInput {
  return {
    now: at(0),
    open: null,
    lastSentForOpen: null,
    lastResolved: null,
    lastSentForResolved: null,
    reminderIntervalMs: SIX_HOURS,
    ...over,
  };
}

describe('decideVillageAlert — transitions + dedupe', () => {
  it('stays silent while online with no outage history', () => {
    assert.equal(decideVillageAlert(input({})), null);
  });

  it('sends DOWN on online->offline (open outage, nothing delivered yet)', () => {
    const d = decideVillageAlert(input({ open, now: at(10 * MIN) }));
    assert.equal(d?.kind, 'down');
    assert.equal(d?.durationMs, 10 * MIN);
  });

  it('keeps retrying DOWN on every check until a delivery is recorded (Telegram unreachable)', () => {
    for (const t of [10 * MIN, 20 * MIN, 5 * HOUR, 30 * HOUR]) {
      assert.equal(decideVillageAlert(input({ open, now: at(t) }))?.kind, 'down');
    }
  });

  it('does not re-send once DOWN was delivered, until the reminder interval elapses', () => {
    const lastSentForOpen = { kind: 'down' as const, at: at(10 * MIN) };
    assert.equal(decideVillageAlert(input({ open, lastSentForOpen, now: at(20 * MIN) })), null);
    assert.equal(decideVillageAlert(input({ open, lastSentForOpen, now: at(10 * MIN + SIX_HOURS - 1) })), null);
    const reminder = decideVillageAlert(input({ open, lastSentForOpen, now: at(10 * MIN + SIX_HOURS) }));
    assert.equal(reminder?.kind, 'reminder');
    assert.equal(reminder?.durationMs, 10 * MIN + SIX_HOURS);
  });

  it('spaces reminders from the LAST delivery (restart-safe: state comes from persisted rows)', () => {
    const lastSentForOpen = { kind: 'reminder' as const, at: at(12 * HOUR) };
    assert.equal(decideVillageAlert(input({ open, lastSentForOpen, now: at(17 * HOUR) })), null);
    assert.equal(decideVillageAlert(input({ open, lastSentForOpen, now: at(18 * HOUR) }))?.kind, 'reminder');
  });

  it('a 21-day outage at a 10-min check cadence yields 1 down + 84 reminders (6 h apart), not 3025 messages', () => {
    let last: { kind: 'down' | 'reminder'; at: Date } | null = null;
    let sent = 0;
    for (let t = 0; t <= 21 * 24 * HOUR; t += 10 * MIN) {
      const d = decideVillageAlert(input({ open, lastSentForOpen: last, now: at(t) }));
      if (d && d.kind !== 'recovery') {
        last = { kind: d.kind, at: at(t) };
        sent += 1;
      }
    }
    assert.equal(sent, 1 + (21 * 24) / 6); // down at t=0, then a reminder every 6 h through hour 504
  });

  it('sends RECOVERY with the outage duration on offline->online', () => {
    const d = decideVillageAlert(
      input({ lastResolved: resolved(3 * HOUR), lastSentForResolved: { kind: 'down', at: at(MIN) }, now: at(3 * HOUR + MIN) }),
    );
    assert.equal(d?.kind, 'recovery');
    assert.equal(d?.durationMs, 3 * HOUR);
    assert.equal(d?.previouslyAlerted, true);
  });

  it('flags a recovery whose DOWN notice never got through', () => {
    const d = decideVillageAlert(input({ lastResolved: resolved(2 * HOUR), now: at(2 * HOUR + MIN) }));
    assert.equal(d?.kind, 'recovery');
    assert.equal(d?.previouslyAlerted, false);
  });

  it('sends RECOVERY once (dedupe on the delivered recovery row)', () => {
    const d = decideVillageAlert(
      input({ lastResolved: resolved(HOUR), lastSentForResolved: { kind: 'recovery', at: at(HOUR + MIN) }, now: at(2 * HOUR) }),
    );
    assert.equal(d, null);
  });

  it('drops a recovery notice older than the window (e.g. after a long backend downtime)', () => {
    const d = decideVillageAlert(input({ lastResolved: resolved(HOUR), now: at(HOUR + VILLAGE_ALERT_RECOVERY_WINDOW_MS + 1) }));
    assert.equal(d, null);
  });

  it('a new outage takes precedence over an undelivered recovery of the previous one', () => {
    const second: VillageOutage = { id: 'o2', startedAt: at(2 * HOUR), resolvedAt: null };
    const d = decideVillageAlert(input({ open: second, lastResolved: resolved(HOUR), now: at(2 * HOUR + MIN) }));
    assert.equal(d?.kind, 'down');
    assert.equal(d?.outage.id, 'o2');
  });
});

describe('isVillageTransition', () => {
  it('is true only when the probe disagrees with the persisted marker', () => {
    assert.equal(isVillageTransition(true, false), true);
    assert.equal(isVillageTransition(false, true), true);
    assert.equal(isVillageTransition(true, true), false);
    assert.equal(isVillageTransition(false, false), false);
  });
});

describe('resolveReminderIntervalMs', () => {
  it('defaults to 6 h and clamps to 30 min .. 7 days', () => {
    assert.equal(resolveReminderIntervalMs(undefined), SIX_HOURS);
    assert.equal(resolveReminderIntervalMs(''), SIX_HOURS);
    assert.equal(resolveReminderIntervalMs('junk'), SIX_HOURS);
    assert.equal(resolveReminderIntervalMs('120'), 2 * HOUR);
    assert.equal(resolveReminderIntervalMs('1'), 30 * MIN);
    assert.equal(resolveReminderIntervalMs('999999'), 7 * 24 * HOUR);
  });
});

describe('formatting', () => {
  it('formats outage durations in EN and FA', () => {
    assert.equal(formatOutageDuration(0, 'en'), '0m');
    assert.equal(formatOutageDuration(45 * MIN, 'en'), '45m');
    assert.equal(formatOutageDuration(21 * 24 * HOUR + 3 * HOUR + 15 * MIN, 'en'), '21d 3h 15m');
    assert.equal(formatOutageDuration(2 * 24 * HOUR + 5 * MIN, 'en'), '2d 5m');
    assert.equal(formatOutageDuration(3 * HOUR + 15 * MIN, 'fa', toPersianDigits), '۳ ساعت و ۱۵ دقیقه');
  });

  it('formats timestamps as ASCII UTC minutes', () => {
    assert.equal(formatUtcMinute(T0), '2026-09-12 15:00 UTC');
  });
});

describe('buildVillageAlertMessage (bilingual, typed copy layer)', () => {
  const deps = { render: renderTelegramCopy, rtl: applyRtlGuard, digits: toPersianDigits };

  it('has EN + FA copy for every ops.village id', () => {
    for (const id of Object.keys(TELEGRAM_COPY).filter((k) => k.startsWith('ops.village.'))) {
      const entry = TELEGRAM_COPY[id as keyof typeof TELEGRAM_COPY];
      assert.ok(entry.en.length > 0 && entry.fa.length > 0, id);
    }
  });

  it('DOWN with no reserve is URGENT and says customers have no egress, in both languages', () => {
    const d = decideVillageAlert(input({ open, now: at(MIN) }))!;
    const text = buildVillageAlertMessage(d, { enabledReserveCount: 0 }, deps);
    assert.match(text, /URGENT/);
    assert.match(text, /فوری/);
    assert.match(text, /NO egress/);
    assert.match(text, /هیچ اشتراک رزرو فعالی/);
    assert.match(text, /2026-09-12 15:00 UTC/);
    assert.ok(text.indexOf('فوری') < text.indexOf('URGENT'), 'Persian first');
    assert.doesNotMatch(text, /\{\w+\}/, 'no unrendered tokens');
  });

  it('DOWN with reserve reports the failover count (Persian digits in FA)', () => {
    const d = decideVillageAlert(input({ open, now: at(MIN) }))!;
    const text = buildVillageAlertMessage(d, { enabledReserveCount: 2 }, deps);
    assert.match(text, /Failing over to 2 enabled reserve/);
    assert.match(text, /۲ اشتراک رزرو/);
  });

  it('RECOVERY carries the duration and the undelivered note when DOWN never landed', () => {
    const d = decideVillageAlert(input({ lastResolved: resolved(21 * 24 * HOUR), now: at(21 * 24 * HOUR + MIN) }))!;
    const text = buildVillageAlertMessage(d, { enabledReserveCount: 0 }, deps);
    assert.match(text, /restored/);
    assert.match(text, /after 21d offline/);
    assert.match(text, /could not be delivered/);
    assert.match(text, /۲۱ روز/);
    assert.doesNotMatch(text, /\{\w+\}/);
  });
});
