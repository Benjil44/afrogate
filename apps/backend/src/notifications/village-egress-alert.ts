/**
 * Pure decision + copy logic for the URGENT "customer egress down" Telegram
 * notice (village MikroTik offline). The service owns I/O; this file owns the
 * transition / dedupe rules so they are unit-testable under `node --test`.
 *
 * Persisted state (no new table — survives backend restarts):
 *  - Outage marker = one row in `alerts` keyed by VILLAGE_EGRESS_ALERT_KEY.
 *    open  => village currently offline, `first_seen_at` = outage start.
 *    resolved => outage over, `resolved_at` = recovery time.
 *  - Delivery log = `audit_logs` rows (action VILLAGE_ALERT_SENT_ACTION,
 *    target_id = outage alert id, metadata.kind). Only a *delivered* notice is
 *    recorded, so a failed send is naturally retried on the next check.
 *
 * Rules (decideVillageAlert):
 *  - open outage, nothing delivered yet            -> 'down'
 *  - open outage, last delivery older than interval -> 'reminder'
 *  - no open outage, the latest outage resolved within the recovery window and
 *    its recovery not yet delivered                -> 'recovery' (+ duration;
 *    flags when the down notice never got through, e.g. Telegram's own route
 *    went down with the village tunnel)
 *  - otherwise                                     -> nothing
 *
 * No I/O, no decorators, no runtime relative imports.
 */

import type { TelegramCopyId, TelegramLanguage } from '../telegram/telegram-i18n';

export const VILLAGE_EGRESS_ALERT_KEY = {
  sourceType: 'egress',
  sourceId: 'village',
  title: 'Village egress offline',
} as const;

export const VILLAGE_ALERT_SENT_ACTION = 'egress.village.alert.sent';

/** Default reminder cadence while the outage persists (6 h). */
export const VILLAGE_ALERT_DEFAULT_REMINDER_MINUTES = 360;
/** A recovery notice older than this (e.g. after a long backend downtime) is dropped. */
export const VILLAGE_ALERT_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type VillageAlertKind = 'down' | 'reminder' | 'recovery';

export interface VillageOutage {
  id: string;
  startedAt: Date;
  /** null while the outage is open. */
  resolvedAt: Date | null;
}

export interface VillageAlertDelivery {
  kind: VillageAlertKind;
  at: Date;
}

export interface VillageAlertDecisionInput {
  now: Date;
  /** The currently-open outage marker, if any. */
  open: VillageOutage | null;
  lastSentForOpen: VillageAlertDelivery | null;
  /** The most recently resolved outage, if any. */
  lastResolved: VillageOutage | null;
  lastSentForResolved: VillageAlertDelivery | null;
  reminderIntervalMs: number;
  recoveryWindowMs?: number;
}

export interface VillageAlertDecision {
  kind: VillageAlertKind;
  outage: VillageOutage;
  /** Outage length so far (open) or total (recovered), in ms. */
  durationMs: number;
  /** Recovery only: false when no down/reminder notice was ever delivered for this outage. */
  previouslyAlerted: boolean;
}

/** Decide which notice (if any) is due on this check. Deterministic in its inputs. */
export function decideVillageAlert(input: VillageAlertDecisionInput): VillageAlertDecision | null {
  const nowMs = input.now.getTime();

  if (input.open) {
    const durationMs = Math.max(0, nowMs - input.open.startedAt.getTime());
    const last = input.lastSentForOpen;
    if (!last) return { kind: 'down', outage: input.open, durationMs, previouslyAlerted: false };
    if (nowMs - last.at.getTime() >= input.reminderIntervalMs) {
      return { kind: 'reminder', outage: input.open, durationMs, previouslyAlerted: true };
    }
    return null;
  }

  const resolved = input.lastResolved;
  if (!resolved?.resolvedAt) return null;
  if (input.lastSentForResolved?.kind === 'recovery') return null;
  const windowMs = input.recoveryWindowMs ?? VILLAGE_ALERT_RECOVERY_WINDOW_MS;
  if (nowMs - resolved.resolvedAt.getTime() > windowMs) return null;
  return {
    kind: 'recovery',
    outage: resolved,
    durationMs: Math.max(0, resolved.resolvedAt.getTime() - resolved.startedAt.getTime()),
    previouslyAlerted: input.lastSentForResolved !== null,
  };
}

/**
 * Whether a probe result disagrees with the persisted marker, i.e. it would be
 * a state transition. Transitions are re-probed once before being committed so
 * a single dropped MikroTik probe can neither page the operator nor send a
 * false "recovered".
 */
export function isVillageTransition(observedOffline: boolean, hasOpenOutage: boolean): boolean {
  return observedOffline !== hasOpenOutage;
}

/** Reminder interval from env minutes (default 360 = 6 h, clamped 30 min .. 7 days). */
export function resolveReminderIntervalMs(raw: string | undefined): number {
  const minutes = Number(raw);
  const value = Number.isFinite(minutes) && raw !== undefined && raw.trim() !== ''
    ? Math.min(Math.max(Math.round(minutes), 30), 7 * 24 * 60)
    : VILLAGE_ALERT_DEFAULT_REMINDER_MINUTES;
  return value * 60 * 1000;
}

/** Compact outage duration: EN `2d 3h 15m`, FA `۲ روز و ۳ ساعت و ۱۵ دقیقه` (digits via `digits`). */
export function formatOutageDuration(
  ms: number,
  language: TelegramLanguage,
  digits: (value: string) => string = (v) => v,
): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: Array<[number, string, string]> = [
    [days, 'd', 'روز'],
    [hours, 'h', 'ساعت'],
    [minutes, 'm', 'دقیقه'],
  ];
  const shown = parts.filter(([n], i) => n > 0 || (i === 2 && days === 0 && hours === 0));
  if (language === 'fa') return shown.map(([n, , fa]) => `${digits(String(n))} ${fa}`).join(' و ');
  return shown.map(([n, en]) => `${n}${en}`).join(' ');
}

/** `2026-09-12 15:00 UTC` — ASCII in both languages (an unambiguous timestamp). */
export function formatUtcMinute(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export interface VillageAlertCopyDeps {
  render: (
    id: TelegramCopyId,
    language: TelegramLanguage,
    vars?: Record<string, string | number>,
    raw?: Record<string, string>,
  ) => string;
  rtl: (text: string, language: TelegramLanguage) => string;
  digits: (value: string) => string;
}

/**
 * One bilingual HTML message (Persian first, then English) so every recipient
 * reads it regardless of their bot language. Operational metadata only — no
 * customer identities, IPs, or secrets.
 */
export function buildVillageAlertMessage(
  decision: VillageAlertDecision,
  context: { enabledReserveCount: number },
  deps: VillageAlertCopyDeps,
): string {
  const startedAt = formatUtcMinute(decision.outage.startedAt);
  const resolvedAt = decision.outage.resolvedAt ? formatUtcMinute(decision.outage.resolvedAt) : '';
  const render = (language: TelegramLanguage): string => {
    const duration = formatOutageDuration(decision.durationMs, language, deps.digits);
    const reserveLine =
      context.enabledReserveCount > 0
        ? deps.render('ops.village.reserveSome', language, {
            count: language === 'fa' ? deps.digits(String(context.enabledReserveCount)) : context.enabledReserveCount,
          })
        : deps.render('ops.village.reserveNone', language);
    const id: TelegramCopyId =
      decision.kind === 'down' ? 'ops.village.down' : decision.kind === 'reminder' ? 'ops.village.reminder' : 'ops.village.recovered';
    let text = deps.render(id, language, { startedAt, resolvedAt, duration }, { reserveLine });
    if (decision.kind === 'recovery' && !decision.previouslyAlerted) {
      text += `\n${deps.render('ops.village.undeliveredNote', language)}`;
    }
    return deps.rtl(text, language);
  };
  return `${render('fa')}\n\n— — —\n\n${render('en')}`;
}
