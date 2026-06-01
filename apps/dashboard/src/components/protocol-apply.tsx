import { Eye, Network, Route, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import type { AdminProtocolServerApplyAdapterSummary, AdminProtocolServerApplyEventDetail, AdminProtocolServerApplyEventSummary, AdminProtocolServerApplyPlanSummary, AdminProtocolServerApplyPreflightSummary } from '@afrogate/shared';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { protocolApplyAdapterStatusLabel, protocolApplyGateKindLabel, protocolApplyGateStatusLabel, protocolApplyRunnerModeLabel, protocolServerApplyEventStatusLabel, protocolServerApplyModeLabel, protocolServerApplyStatusLabel, protocolServerApplyStepLabel } from '../labels';
import { protocolApplyAdapterStatusTone, protocolApplyGateTone, protocolServerApplyStepTone, protocolServerApplyTone } from '../tone';
import { mutedTextClass } from '../ui-classes';
import { EmptyState, MetricPill, StatusBadge } from './primitives';

export function ProtocolApplyEventsPanel({
  eventDetail,
  events,
  format,
  isDetailLoading,
  onInspectEvent,
  t,
}: {
  eventDetail: AdminProtocolServerApplyEventDetail | null;
  events: AdminProtocolServerApplyEventSummary[];
  format: DashboardFormatters;
  isDetailLoading: boolean;
  onInspectEvent: (eventId: string) => void;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-2 border-t border-afro-line pt-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <strong className="text-[13px] text-afro-muted">{t.settings.protocolApplyAudit}</strong>
        <StatusBadge tone="neutral">{t.settings.serverApplyNoMutation}</StatusBadge>
      </div>

      {events.length === 0 ? (
        <EmptyState message={t.settings.noProtocolApplyEvents} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {events.slice(0, 6).map((event) => {
            const title = event.protocolSetupName ?? event.protocol ?? event.protocolSetupId;
            const meta = [event.protocol, event.routeGroup, event.targetServerLabel].filter(Boolean).join(' / ');

            return (
              <div className="grid gap-1.5 rounded-md border border-afro-line bg-white px-2.5 py-2" key={event.id}>
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px]">{title}</strong>
                    <span className={`${mutedTextClass} block truncate`}>{meta || t.settings.pending}</span>
                  </div>
                  <button
                    className="inline-flex min-h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-afro-line bg-white px-2 text-[11px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
                    disabled={isDetailLoading}
                    onClick={() => onInspectEvent(event.id)}
                    type="button"
                  >
                    <Eye size={13} />
                    {isDetailLoading ? t.settings.loadingProtocolApplyEvent : t.settings.inspectProtocolApplyEvent}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={event.secretSafe ? 'good' : 'warning'}>
                    {event.secretSafe ? t.settings.secretSafe : t.settings.decisionEventSecretUnsafe}
                  </StatusBadge>
                  <StatusBadge tone={event.canExecute ? 'good' : 'neutral'}>
                    {event.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
                  </StatusBadge>
                  <StatusBadge tone={protocolServerApplyTone(event.applyStatus)}>
                    {protocolServerApplyEventStatusLabel(event.applyStatus, t)}
                  </StatusBadge>
                  <StatusBadge tone={event.applyMode === 'live' ? 'warning' : 'neutral'}>
                    {protocolServerApplyModeLabel(event.applyMode, t)}
                  </StatusBadge>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{format.time(new Date(event.createdAt), false)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.reasonCodes.slice(0, 4).map((reason) => (
                    <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${event.id}-${reason}`}>
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eventDetail ? <ProtocolApplyEventDetailCard detail={eventDetail} format={format} t={t} /> : null}
    </div>
  );
}

export function ProtocolApplyEventDetailCard({
  detail,
  format,
  t,
}: {
  detail: AdminProtocolServerApplyEventDetail;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const snapshot = detail.dryRunSnapshot;

  return (
    <div className="grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{t.settings.protocolApplyEventContext}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {detail.protocolSetupName ?? detail.protocolSetupId} / {format.time(new Date(detail.createdAt))}
          </span>
        </div>
        <StatusBadge tone={detail.secretSafe ? 'good' : 'warning'}>
          {detail.secretSafe ? t.settings.secretSafe : t.settings.decisionEventSecretUnsafe}
        </StatusBadge>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.protocolApplySnapshot}
          value={snapshot ? (detail.applyMode === 'live' ? t.settings.protocolApplyRequestSnapshot : t.settings.dryRunSnapshot) : t.settings.noDryRunSnapshot}
        />
        <MetricPill
          icon={Route}
          label={t.settings.protocolApplyMode}
          value={protocolServerApplyModeLabel(detail.applyMode, t)}
        />
        <MetricPill
          icon={SettingsIcon}
          label={t.settings.routeApplyDryRunCommands}
          value={t.settings.dryRunCommandsCount(format.integer(detail.commandCount))}
        />
        <MetricPill
          icon={Network}
          label={t.settings.routeApplyConfigChanges}
          value={t.settings.dryRunConfigChangesCount(format.integer(detail.configChangeCount))}
        />
      </div>

      {snapshot ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={snapshot.dataPlaneMutationExecuted ? 'warning' : snapshot.liveApply ? 'good' : 'neutral'}>
              {snapshot.dataPlaneMutationExecuted
                ? t.settings.serverApplyMutationExecuted
                : snapshot.liveApply
                  ? t.settings.protocolApplyLiveAccepted
                  : t.settings.protocolApplyLiveBlocked}
            </StatusBadge>
            <StatusBadge tone={snapshot.canExecute ? 'good' : 'neutral'}>
              {snapshot.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
            </StatusBadge>
            {snapshot.steps.slice(0, 6).map((step) => (
              <StatusBadge key={step.id} tone={protocolServerApplyStepTone(step.status)}>
                {protocolServerApplyStepLabel(step.kind, t)}
              </StatusBadge>
            ))}
          </div>

          <ProtocolServerApplySecretBadges
            hasSecretRef={snapshot.hasSecretRef}
            requiresSecret={snapshot.requiresSecret}
            secretDecryptAllowed={snapshot.secretDecryptAllowed}
            t={t}
          />
          <ProtocolServerApplyConfigMaterialBadges
            format={format}
            missingFields={snapshot.configMaterialMissingFields}
            ready={snapshot.configMaterialReady}
            t={t}
          />
          <ProtocolServerApplyCommandPolicyBadges
            format={format}
            ready={snapshot.commandPolicyReady}
            t={t}
            violations={snapshot.commandPolicyViolations}
          />
          <ProtocolServerApplyPreflightCard format={format} preflight={snapshot.preflight} t={t} />
          <ProtocolServerApplyAdapterCard adapter={snapshot.adapter} t={t} />
          {snapshot.execution ? (
            <div className="grid gap-1 rounded border border-afro-line bg-white px-2 py-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyExecution}</strong>
              <span className="flex flex-wrap gap-1">
                <StatusBadge tone={snapshot.execution.status === 'succeeded' ? 'good' : snapshot.execution.status === 'rolledBack' ? 'warning' : 'critical'}>
                  {snapshot.execution.status === 'succeeded'
                    ? t.settings.protocolApplyExecutionSucceeded
                    : snapshot.execution.status === 'rolledBack'
                      ? t.settings.protocolApplyExecutionRolledBack
                      : t.settings.protocolApplyExecutionFailed}
                </StatusBadge>
                <StatusBadge tone="neutral">
                  {t.settings.protocolApplyExecutionCommands(
                    format.integer(snapshot.execution.successfulCommandCount),
                    format.integer(snapshot.execution.commandCount),
                  )}
                </StatusBadge>
                {snapshot.execution.rollbackAttempted ? (
                  <StatusBadge tone={snapshot.execution.rollbackSucceeded ? 'good' : 'warning'}>
                    {t.settings.serverApplyRollback}
                  </StatusBadge>
                ) : null}
              </span>
            </div>
          ) : null}

          {snapshot.commands.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyCommandsPreview}</strong>
              {snapshot.commands.slice(0, 5).map((item) => (
                <div className="grid gap-1 rounded border border-afro-line bg-white px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                      {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                    </StatusBadge>
                    <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                      {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                    </StatusBadge>
                    <StatusBadge tone={item.allowlisted ? 'good' : 'warning'}>
                      {item.allowlisted ? t.settings.protocolApplyCommandPolicyReady : t.settings.protocolApplyCommandPolicyBlocked}
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      {t.settings.protocolApplyCommandTimeout(format.integer(item.timeoutSeconds))}
                    </StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.configChanges.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyConfigPreview}</strong>
              {snapshot.configChanges.slice(0, 4).map((item) => (
                <div className="grid gap-0.5 rounded border border-afro-line bg-white px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{item.action}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState message={t.settings.noDryRunSnapshot} />
      )}
    </div>
  );
}

export function ProtocolServerApplyPreflightCard({
  compact = false,
  format,
  preflight,
  t,
}: {
  compact?: boolean;
  format: DashboardFormatters;
  preflight: AdminProtocolServerApplyPreflightSummary;
  t: DashboardStrings;
}) {
  const visibleGates = preflight.gates.slice(0, compact ? 5 : 9);

  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyPreflight}</strong>
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={preflight.canRecordDryRun ? 'good' : 'warning'}>
            {preflight.canRecordDryRun ? t.settings.protocolApplyDryRunAllowed : t.settings.protocolApplyDryRunBlocked}
          </StatusBadge>
          <StatusBadge tone={preflight.canExecuteDataPlane ? 'good' : 'neutral'}>
            {preflight.canExecuteDataPlane ? t.settings.protocolApplyLiveReady : t.settings.protocolApplyLiveBlocked}
          </StatusBadge>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded border border-afro-line bg-white px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
          {t.settings.protocolApplyGateSummary(
            format.integer(preflight.passedGateCount),
            format.integer(preflight.blockedGateCount),
            format.integer(preflight.futureGateCount),
          )}
        </span>
        {visibleGates.map((gate) => (
          <span className="inline-flex min-h-6 items-center gap-1 rounded border border-afro-line bg-white px-1.5 text-[11px] font-bold" key={gate.id}>
            <span className="text-afro-muted">{protocolApplyGateKindLabel(gate.kind, t)}</span>
            <StatusBadge tone={protocolApplyGateTone(gate.status)}>
              {protocolApplyGateStatusLabel(gate.status, t)}
            </StatusBadge>
          </span>
        ))}
      </div>
      {!compact && preflight.liveApplyBlockedReasonCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {preflight.liveApplyBlockedReasonCodes.slice(0, 6).map((reason) => (
            <span className="rounded border border-afro-line bg-white px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={reason}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProtocolServerApplyAdapterCard({
  adapter,
  compact = false,
  t,
}: {
  adapter: AdminProtocolServerApplyAdapterSummary;
  compact?: boolean;
  t: DashboardStrings;
}) {
  const boundary = adapter.serverAccessBoundary;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white px-2 py-1.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[12px] text-afro-muted">{t.settings.protocolApplyAdapter}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {adapter.protocol ?? '-'} / {adapter.id}
          </span>
        </div>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusBadge tone={protocolApplyAdapterStatusTone(adapter.status)}>
            {protocolApplyAdapterStatusLabel(adapter.status, t)}
          </StatusBadge>
          <StatusBadge tone={adapter.commandRunner.mode === 'live' ? 'warning' : 'neutral'}>
            {protocolApplyRunnerModeLabel(adapter.commandRunner.mode, t)}
          </StatusBadge>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge tone={adapter.enabled ? 'good' : 'neutral'}>
          {adapter.enabled ? t.settings.routeApplyAdapterEnabled : t.settings.routeApplyAdapterDisabled}
        </StatusBadge>
        <StatusBadge tone={adapter.implemented ? 'good' : 'neutral'}>
          {adapter.implemented ? t.settings.protocolApplyAdapterImplemented : t.settings.protocolApplyAdapterNotImplemented}
        </StatusBadge>
        <StatusBadge tone={boundary.accessProfileReady ? 'good' : 'warning'}>
          {boundary.accessProfileReady ? t.settings.accessReady : t.settings.accessPending}
        </StatusBadge>
        <StatusBadge tone={boundary.credentialRecordActive ? 'good' : 'warning'}>
          {boundary.credentialRecordActive ? t.settings.protocolApplyCredentialReady : t.settings.protocolApplyCredentialBlocked}
        </StatusBadge>
        <StatusBadge tone={boundary.credentialDecryptAllowed ? 'good' : 'neutral'}>
          {boundary.credentialDecryptAllowed ? t.settings.protocolApplyCredentialDecryptReady : t.settings.protocolApplyCredentialDecryptBlocked}
        </StatusBadge>
      </div>
      {!compact && adapter.reasonCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {adapter.reasonCodes.slice(0, 7).map((reason) => (
            <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${adapter.id}-${reason}`}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProtocolServerApplyPlanCard({
  format,
  plan,
  t,
}: {
  format: DashboardFormatters;
  plan: AdminProtocolServerApplyPlanSummary;
  t: DashboardStrings;
}) {
  const visibleSteps = plan.steps.slice(0, 4);

  return (
    <div className="grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-bold text-afro-muted">{t.settings.serverApplyPlan}</span>
        <StatusBadge tone={protocolServerApplyTone(plan.status)}>{protocolServerApplyStatusLabel(plan.status, t)}</StatusBadge>
      </div>
      <div className="grid gap-1.5 text-[12px] sm:grid-cols-3">
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyCommands}</span>
          <strong>{format.integer(plan.commandCount)}</strong>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyChanges}</span>
          <strong>{format.integer(plan.configChangeCount)}</strong>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyTarget}</span>
          <strong className="truncate">{plan.targetServerLabel ?? (plan.targetServerId ? t.settings.configured : t.settings.pending)}</strong>
        </div>
      </div>
      <ProtocolServerApplySecretBadges
        hasSecretRef={plan.hasSecretRef}
        requiresSecret={plan.requiresSecret}
        secretDecryptAllowed={plan.secretDecryptAllowed}
        t={t}
      />
      <ProtocolServerApplyConfigMaterialBadges
        format={format}
        missingFields={plan.configMaterialMissingFields}
        ready={plan.configMaterialReady}
        t={t}
      />
      <ProtocolServerApplyCommandPolicyBadges
        format={format}
        ready={plan.commandPolicyReady}
        t={t}
        violations={plan.commandPolicyViolations}
      />
      <ProtocolServerApplyPreflightCard compact format={format} preflight={plan.preflight} t={t} />
      <ProtocolServerApplyAdapterCard adapter={plan.adapter} compact t={t} />
      <div className="flex flex-wrap gap-1.5">
        {visibleSteps.map((step) => (
          <StatusBadge key={step.id} tone={protocolServerApplyStepTone(step.status)}>
            {protocolServerApplyStepLabel(step.kind, t)}
          </StatusBadge>
        ))}
        <StatusBadge tone={plan.canExecute ? 'good' : 'neutral'}>
          {plan.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
        </StatusBadge>
      </div>
    </div>
  );
}

export function ProtocolServerApplyCommandPolicyBadges({
  format,
  ready,
  t,
  violations,
}: {
  format: DashboardFormatters;
  ready: boolean;
  t: DashboardStrings;
  violations: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={ready ? 'good' : 'warning'}>
        {ready ? t.settings.protocolApplyCommandPolicyReady : t.settings.protocolApplyCommandPolicyBlocked}
      </StatusBadge>
      {!ready ? (
        <StatusBadge tone="neutral">{t.settings.protocolApplyCommandPolicyViolations(format.integer(violations.length))}</StatusBadge>
      ) : null}
    </div>
  );
}

export function ProtocolServerApplyConfigMaterialBadges({
  format,
  missingFields,
  ready,
  t,
}: {
  format: DashboardFormatters;
  missingFields: string[];
  ready: boolean;
  t: DashboardStrings;
}) {
  const missingCount = missingFields.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={ready ? 'good' : 'warning'}>
        {ready ? t.settings.protocolApplyConfigMaterialReady : t.settings.protocolApplyConfigMaterialBlocked}
      </StatusBadge>
      {!ready ? (
        <StatusBadge tone="neutral">{t.settings.protocolApplyConfigMissingFields(format.integer(missingCount))}</StatusBadge>
      ) : null}
    </div>
  );
}

export function ProtocolServerApplySecretBadges({
  hasSecretRef,
  requiresSecret,
  secretDecryptAllowed,
  t,
}: {
  hasSecretRef: boolean;
  requiresSecret: boolean;
  secretDecryptAllowed: boolean;
  t: DashboardStrings;
}) {
  if (!requiresSecret) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={hasSecretRef ? 'good' : 'warning'}>
        {hasSecretRef ? t.settings.protocolApplySecretReady : t.settings.protocolApplySecretBlocked}
      </StatusBadge>
      <StatusBadge tone={secretDecryptAllowed ? 'good' : 'neutral'}>
        {secretDecryptAllowed ? t.settings.protocolApplySecretDecryptReady : t.settings.protocolApplySecretDecryptBlocked}
      </StatusBadge>
    </div>
  );
}
