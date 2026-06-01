import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownUp, Clock, Gauge, Network, Route, ShieldCheck } from 'lucide-react';
import type { AdminRouteAssignmentSummary, AdminRouteCanaryStatusResponse, AdminRouteHealthHistoryResponse, AdminSessionResponse, AdminTunnelSummary } from '@afrogate/shared';
import { fetchAdminTunnel, fetchRouteAssignment, fetchRouteCanaryStatus, fetchRouteHealthHistory, updateAdminRouteAssignment } from '../api/admin';
import { OutboundsPanel } from '../components/dashboard-panels';
import { TunnelPanel, tunnelRowKey } from '../components/panels';
import { DashboardTabs, DataStateEmpty, DataStateNotice, DetailRow, EmptyState, MetricPill, PanelHeading, StatusBadge } from '../components/primitives';
import { RouteDecisionCandidateCard, RouteDecisionMetric, RouteDecisionSwitchOrchestrationCard, RouteDecisionSwitchRolloutCard } from '../components/route-decision';
import type { DashboardTabItem, DataState, OutboundRowData, RouteFailoverRowData, RoutesTab, Tone, TunnelRowData } from '../dashboard-types';
import { clamp, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { routeHealthHistoryKey, routeHealthPointMeta, routeHealthPointRoute } from '../route-helpers';
import { routeDecisionReasonLabel, routeScoreProfileLabel, routeSwitchOrchestrationActionLabel, routeSwitchOrchestrationStatusTone } from '../route-labels';
import { inventoryStatusLabel, inventoryStatusTone } from '../server-helpers';
import { getScoreClass } from '../tone';
import { fieldInputClass, fieldLabelClass, mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

export function RoutesPage({
  dataState,
  failoverRows,
  format,
  outbounds,
  session,
  sessionToken,
  tunnelDataState,
  tunnelSummaries,
  tunnels,
  t,
}: {
  dataState: DataState;
  failoverRows: RouteFailoverRowData[];
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  tunnelDataState: DataState;
  tunnelSummaries: AdminTunnelSummary[];
  tunnels: TunnelRowData[];
  t: DashboardStrings;
}) {
  const [selectedTunnelKey, setSelectedTunnelKey] = useState<string | null>(() => tunnels[0] ? tunnelRowKey(tunnels[0]) : null);
  const [routeCanaryStatus, setRouteCanaryStatus] = useState<AdminRouteCanaryStatusResponse | null>(null);
  const [routeCanaryState, setRouteCanaryState] = useState<DataState>('loading');
  const [routeHealthHistory, setRouteHealthHistory] = useState<AdminRouteHealthHistoryResponse | null>(null);
  const [routeHealthHistoryState, setRouteHealthHistoryState] = useState<DataState>('loading');
  const [activeRoutesTab, setActiveRoutesTab] = useState<RoutesTab>('overview');

  useEffect(() => {
    if (tunnels.length === 0) {
      setSelectedTunnelKey(null);
      return;
    }

    if (!selectedTunnelKey || !tunnels.some((tunnel) => tunnelRowKey(tunnel) === selectedTunnelKey)) {
      setSelectedTunnelKey(tunnelRowKey(tunnels[0]));
    }
  }, [selectedTunnelKey, tunnels]);

  useEffect(() => {
    const controller = new AbortController();
    setRouteHealthHistoryState('loading');

    fetchRouteHealthHistory(sessionToken, 'main', 168, 24, controller.signal)
      .then((response) => {
        setRouteHealthHistory(response);
        setRouteHealthHistoryState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRouteHealthHistory(null);
        setRouteHealthHistoryState('stale');
      });

    return () => controller.abort();
  }, [sessionToken]);

  useEffect(() => {
    const controller = new AbortController();
    setRouteCanaryState('loading');

    fetchRouteCanaryStatus(sessionToken, 'main', 'default', controller.signal)
      .then((response) => {
        setRouteCanaryStatus(response);
        setRouteCanaryState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRouteCanaryStatus(null);
        setRouteCanaryState('stale');
      });

    return () => controller.abort();
  }, [sessionToken]);

  const selectedTunnelRow = tunnels.find((tunnel) => tunnelRowKey(tunnel) === selectedTunnelKey) ?? tunnels[0] ?? null;
  const selectedTunnelSummary = selectedTunnelRow?.id
    ? tunnelSummaries.find((tunnel) => tunnel.id === selectedTunnelRow.id) ?? null
    : null;
  const routeTabs: Array<DashboardTabItem<RoutesTab>> = [
    { id: 'overview', label: t.tabs.routesOverview, meta: t.panels.links(format.integer(tunnels.length)) },
    { id: 'policy', label: t.tabs.routesPolicy, meta: t.panels.priorityFailover },
    { id: 'canary', label: t.tabs.routesCanary, meta: routeCanaryStatus ? routeSwitchOrchestrationActionLabel(routeCanaryStatus.recommendedAction, t) : t.routeCanary.learning },
    { id: 'history', label: t.tabs.routesHistory, meta: routeHealthHistory ? t.routeHealthHistory.points(format.integer(routeHealthHistory.points.length)) : t.routeHealthHistory.learning },
  ];

  return (
    <section className="mt-3 grid gap-3">
      <DashboardTabs activeTab={activeRoutesTab} ariaLabel={t.tabs.routesSections} onChange={setActiveRoutesTab} tabs={routeTabs} />
      {activeRoutesTab === 'overview' ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TunnelPanel
            dataState={tunnelDataState}
            emptyMessage={tunnelDataState === 'loading' ? t.dataStatus.loading : t.operationalData.noTunnels}
            format={format}
            onSelectTunnel={setSelectedTunnelKey}
            selectedTunnelKey={selectedTunnelKey}
            t={t}
            tunnels={tunnels}
          />
          <TunnelDetailPanel
            format={format}
            sessionToken={sessionToken}
            tunnel={selectedTunnelSummary}
            tunnelDataState={tunnelDataState}
            tunnelRow={selectedTunnelRow}
            t={t}
          />
        </section>
      ) : null}
      {activeRoutesTab === 'policy' ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <OutboundsPanel
            dataState={dataState}
            emptyMessage={dataState === 'loading' ? t.dataStatus.loading : t.operationalData.noOutbounds}
            format={format}
            outbounds={outbounds}
            t={t}
          />
          <RoutePolicyPanel format={format} outbounds={outbounds} session={session} sessionToken={sessionToken} t={t} />
        </section>
      ) : null}
      {activeRoutesTab === 'canary' ? (
        <RouteCanaryPanel
          dataState={routeCanaryState}
          format={format}
          status={routeCanaryStatus}
          t={t}
        />
      ) : null}
      {activeRoutesTab === 'history' ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <RouteHealthHistoryPanel
            dataState={routeHealthHistoryState}
            format={format}
            history={routeHealthHistory}
            t={t}
          />
          <FailoverPanel
            dataState={dataState}
            emptyMessage={dataState === 'loading' ? t.dataStatus.loading : t.operationalData.noFailoverEvents}
            events={failoverRows}
            format={format}
            t={t}
          />
        </section>
      ) : null}
    </section>
  );
}


function TunnelDetailPanel({
  format,
  sessionToken,
  t,
  tunnel,
  tunnelDataState,
  tunnelRow,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
  tunnel: AdminTunnelSummary | null;
  tunnelDataState: DataState;
  tunnelRow: TunnelRowData | null;
}) {
  const [tunnelDetail, setTunnelDetail] = useState<AdminTunnelSummary | null>(tunnel);
  const [detailDataState, setDetailDataState] = useState<DataState>(tunnel?.id ? 'loading' : tunnelDataState);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setTunnelDetail(tunnel);

    if (!tunnel?.id) {
      setDetailDataState(tunnelRow ? tunnelDataState : 'fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setDetailDataState('loading');

    fetchAdminTunnel(sessionToken, tunnel.id, controller.signal)
      .then((detail) => {
        if (!isActive) return;

        setTunnelDetail(detail);
        setDetailDataState('live');
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;

        setDetailDataState('stale');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken, tunnel?.id, tunnelDataState, tunnelRow]);

  const activeTunnel = tunnelDetail ?? tunnel;
  const status = activeTunnel?.status ?? tunnelRow?.status ?? 'unknown';
  const type = activeTunnel?.type ?? tunnelRow?.type ?? 'wireguard';
  const routeGroup = activeTunnel?.routeGroup ?? tunnelRow?.routeGroup ?? 'main';
  const serverLabel = activeTunnel?.serverHostname || activeTunnel?.serverExternalId || tunnelRow?.serverLabel || '-';
  const localInterface = activeTunnel?.localInterfaceName || activeTunnel?.interfaceName || tunnelRow?.localInterfaceName || tunnelRow?.interfaceName || '-';
  const operator = activeTunnel?.interfaceOperator || tunnelRow?.operator || '-';
  const remoteEndpoint = activeTunnel?.remoteEndpoint || tunnelRow?.remoteEndpoint || '-';
  const lockable = activeTunnel?.lockable ?? tunnelRow?.lockable ?? false;
  const updatedAt = activeTunnel?.updatedAt ?? tunnelRow?.updatedAt;

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.tunnelDetail}
        icon={Route}
        meta={detailDataState === 'loading' ? t.dataStatus.loading : tunnelRow ? format.label(tunnelRow.name) : t.tunnelDetail.noTunnel}
      />
      <div className="mt-2 grid gap-2">
        {!tunnelRow ? <DataStateEmpty emptyMessage={t.tunnelDetail.noTunnel} state={tunnelDataState} t={t} /> : null}
        {tunnelRow && detailDataState !== 'live' ? <DataStateNotice state={detailDataState} t={t} /> : null}
        {tunnelRow ? (
          <>
            <DetailRow label={t.tunnelDetail.labels.status}>
              <StatusBadge tone={inventoryStatusTone(status)}>{inventoryStatusLabel(status, t)}</StatusBadge>
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.type}>{format.label(String(type))}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.server}>{format.label(serverLabel)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.routeGroup}>{format.label(routeGroup)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.localInterface}>{format.label(localInterface)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.operator}>{format.label(operator)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.remoteEndpoint}>{remoteEndpoint}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.lockable}>{lockable ? t.tunnelDetail.values.lockable : t.tunnelDetail.values.notLockable}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.routeQuality}>
              {format.latency(tunnelRow.ping)} / {format.latency(tunnelRow.jitter)} / {format.packetLoss(tunnelRow.loss)}
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.healthScore}>
              <span className={getScoreClass(tunnelRow.score)}>{format.integer(tunnelRow.score)}</span>
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.updatedAt}>
              {updatedAt ? format.time(new Date(updatedAt), false) : t.serverEdit.values.localSample}
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.detailSource}>
              {detailDataState === 'live'
                ? t.tunnelDetail.values.apiDetail
                : detailDataState === 'loading'
                  ? t.dataStatus.loading
                  : activeTunnel
                    ? t.tunnelDetail.values.listDetail
                    : t.tunnelDetail.values.fallbackDetail}
            </DetailRow>
          </>
        ) : null}
      </div>
    </section>
  );
}

function RoutePolicyPanel({
  format,
  outbounds,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [assignment, setAssignment] = useState<AdminRouteAssignmentSummary | null>(null);
  const [autoRouteEnabled, setAutoRouteEnabled] = useState(true);
  const [routeLocked, setRouteLocked] = useState(false);
  const [currentOutboundId, setCurrentOutboundId] = useState('');
  const [lockedOutboundId, setLockedOutboundId] = useState('');
  const [hysteresisScoreDelta, setHysteresisScoreDelta] = useState('15');
  const [cooldownSeconds, setCooldownSeconds] = useState('180');
  const [policyDataState, setPolicyDataState] = useState<DataState>('loading');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const canManageRoutePolicy = ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const outboundOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();

    outbounds.forEach((outbound) => {
      byId.set(outbound.id, { id: outbound.id, name: outbound.name });
    });

    if (assignment?.currentOutboundId && !byId.has(assignment.currentOutboundId)) {
      byId.set(assignment.currentOutboundId, {
        id: assignment.currentOutboundId,
        name: assignment.currentOutboundName ?? assignment.currentOutboundId,
      });
    }
    if (assignment?.lockedOutboundId && !byId.has(assignment.lockedOutboundId)) {
      byId.set(assignment.lockedOutboundId, {
        id: assignment.lockedOutboundId,
        name: assignment.lockedOutboundName ?? assignment.lockedOutboundId,
      });
    }

    return [...byId.values()];
  }, [assignment, outbounds]);
  const normalizedHysteresisScoreDelta = clamp(Math.round(Number(hysteresisScoreDelta) || 15), 1, 100);
  const normalizedCooldownSeconds = clamp(Math.round(Number(cooldownSeconds) || 180), 30, 3600);
  const statusTone: Tone = policyDataState === 'fallback' ? 'warning' : routeLocked ? 'warning' : autoRouteEnabled ? 'good' : 'neutral';
  const policies: Array<[string, string, Tone]> = [
    [t.routePolicy.autoRoute, autoRouteEnabled ? t.routePolicy.enabled : t.settings.manual, autoRouteEnabled ? 'good' : 'neutral'],
    [t.routePolicy.routeLock, routeLocked ? t.routePolicy.enabled : t.routePolicy.available, routeLocked ? 'warning' : 'neutral'],
    [t.routePolicy.cooldown, format.durationSeconds(normalizedCooldownSeconds), 'neutral'],
    [t.routePolicy.hysteresis, format.scoreDelta(normalizedHysteresisScoreDelta), 'neutral'],
  ];
  const applyRoutePolicy = (nextAssignment: AdminRouteAssignmentSummary) => {
    setAssignment(nextAssignment);
    setAutoRouteEnabled(nextAssignment.autoRouteEnabled);
    setRouteLocked(nextAssignment.routeLocked);
    setCurrentOutboundId(nextAssignment.currentOutboundId ?? '');
    setLockedOutboundId(nextAssignment.lockedOutboundId ?? nextAssignment.currentOutboundId ?? '');
    setHysteresisScoreDelta(String(nextAssignment.hysteresisScoreDelta));
    setCooldownSeconds(String(nextAssignment.cooldownSeconds));
  };
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setPolicyDataState('loading');
    setPolicyMessage(null);

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((nextAssignment) => {
        if (!isActive) return;

        applyRoutePolicy(nextAssignment);
        setPolicyDataState('live');
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setPolicyDataState('fallback');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken]);

  const saveRoutePolicy = async () => {
    if (!canManageRoutePolicy) return;

    setIsSavingPolicy(true);
    setPolicyMessage(null);

    try {
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup: 'main',
        assignmentKey: 'default',
        assignmentLabel: assignment?.assignmentLabel ?? t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null,
        lockedOutboundId: routeLocked ? lockedOutboundId || currentOutboundId || null : null,
        autoRouteEnabled,
        routeLocked,
        hysteresisScoreDelta: normalizedHysteresisScoreDelta,
        cooldownSeconds: normalizedCooldownSeconds,
      });

      applyRoutePolicy(savedAssignment);
      setPolicyDataState('live');
      setPolicyMessage(t.settings.routeSettingsSaved);
    } catch (error) {
      setPolicyMessage(t.settings.saveFailed);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.routePolicy}
        icon={Route}
        meta={policyDataState === 'loading' ? t.dataStatus.loading : assignment?.assignmentLabel ?? t.settings.defaultAssignment}
      />
      <div className="mt-2 grid gap-2">
        {policyDataState !== 'live' ? <DataStateNotice state={policyDataState} t={t} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2.5 py-2">
          <span className={`${mutedTextClass} font-bold`}>{t.settings.routeAssignment}</span>
          <StatusBadge tone={statusTone}>
            {policyDataState === 'loading' ? t.dataStatus.loading : routeLocked ? t.routePolicy.routeLock : autoRouteEnabled ? t.routePolicy.autoRoute : t.settings.manual}
          </StatusBadge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.autoRouteToggle}</span>
            <input
              checked={autoRouteEnabled}
              className="size-4 shrink-0 accent-afro-teal disabled:opacity-50"
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => setAutoRouteEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.routeLockToggle}</span>
            <input
              checked={routeLocked}
              className="size-4 shrink-0 accent-afro-teal disabled:opacity-50"
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => {
                const isLocked = event.target.checked;

                setRouteLocked(isLocked);
                if (isLocked && !lockedOutboundId) {
                  setLockedOutboundId(currentOutboundId || outboundOptions[0]?.id || '');
                }
              }}
              type="checkbox"
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.settings.currentManagedRoute}
            <select
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => {
                setCurrentOutboundId(event.target.value);
                if (!lockedOutboundId) setLockedOutboundId(event.target.value);
              }}
              value={currentOutboundId}
            >
              <option value="">{t.settings.noManagedRouteSelected}</option>
              {outboundOptions.map((outbound) => (
                <option key={outbound.id} value={outbound.id}>
                  {format.label(outbound.name)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.settings.lockedManagedRoute}
            <select
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy || !routeLocked}
              onChange={(event) => setLockedOutboundId(event.target.value)}
              value={lockedOutboundId}
            >
              <option value="">{t.settings.noManagedRouteSelected}</option>
              {outboundOptions.map((outbound) => (
                <option key={outbound.id} value={outbound.id}>
                  {format.label(outbound.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.settings.hysteresisScoreDelta}
            <input
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              inputMode="numeric"
              onChange={(event) => setHysteresisScoreDelta(event.target.value)}
              type="number"
              value={hysteresisScoreDelta}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.settings.cooldownSeconds}
            <input
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              inputMode="numeric"
              onChange={(event) => setCooldownSeconds(event.target.value)}
              type="number"
              value={cooldownSeconds}
            />
          </label>
        </div>
        {policies.map(([label, value, tone]) => (
          <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
            <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
            <StatusBadge tone={tone}>{value}</StatusBadge>
          </div>
        ))}
        {outboundOptions.length === 0 ? <EmptyState message={t.routePolicy.noManagedOutbounds} /> : null}
        {policyMessage ? <p className="text-[12px] font-bold text-afro-muted">{policyMessage}</p> : null}
        <button
          className={primaryButtonClass}
          disabled={!canManageRoutePolicy || isSavingPolicy || policyDataState === 'loading'}
          onClick={() => void saveRoutePolicy()}
          type="button"
        >
          {isSavingPolicy ? t.settings.saving : t.settings.saveRouteSettings}
        </button>
      </div>
    </section>
  );
}

function RouteCanaryPanel({
  dataState,
  format,
  status,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  status: AdminRouteCanaryStatusResponse | null;
  t: DashboardStrings;
}) {
  const meta = status
    ? t.routeCanary.meta(routeSwitchOrchestrationActionLabel(status.recommendedAction, t))
    : t.routeCanary.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeCanary} icon={ShieldCheck} meta={meta} />
      <div className="mt-2 grid gap-2">
        {status && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {!status ? (
          <DataStateEmpty emptyMessage={t.routeCanary.noStatus} state={dataState} t={t} />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <RouteDecisionMetric label={t.routeCanary.recommendedAction}>
                <StatusBadge tone={routeSwitchOrchestrationStatusTone(status.switchOrchestration.status)}>
                  {routeSwitchOrchestrationActionLabel(status.recommendedAction, t)}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.guard}>
                <StatusBadge tone={status.guardReady ? 'good' : 'neutral'}>
                  {status.guardReady ? t.routeCanary.guardReady : t.routeCanary.guardHold}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.dataPlane}>
                <StatusBadge tone={status.canExecuteDataPlane ? 'good' : 'neutral'}>
                  {status.canExecuteDataPlane ? t.routeCanary.dataPlaneReady : t.routeCanary.dataPlaneOff}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.sessionSafety}>
                <StatusBadge tone={status.switchOrchestration.activeSessionsProtected ? 'good' : status.switchOrchestration.activeSessionsMayMove ? 'critical' : 'neutral'}>
                  {status.switchOrchestration.activeSessionsProtected
                    ? t.routeCanary.sessionsProtected
                    : status.switchOrchestration.activeSessionsMayMove
                      ? t.routeCanary.sessionsMayMove
                      : t.settings.switchOrchestrationNoSessionMove}
                </StatusBadge>
              </RouteDecisionMetric>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricPill icon={Route} label={t.routeCanary.routeGroup} value={status.routeGroup} />
              <MetricPill icon={Gauge} label={t.routeCanary.profile} value={status.selectedScoreProfile ? routeScoreProfileLabel(status.selectedScoreProfile, t) : t.settings.unknownProfile} />
              <MetricPill
                icon={Activity}
                label={t.routeCanary.canary}
                value={status.canaryReady ? t.routeCanary.canaryReady : t.routeCanary.canaryPlanning}
              />
            </div>

            <div className="grid gap-2 xl:grid-cols-2">
              <RouteDecisionCandidateCard candidate={status.currentCandidate ?? null} format={format} label={t.settings.routeDecisionCurrent} t={t} />
              <RouteDecisionCandidateCard candidate={status.recommendedCandidate ?? null} format={format} label={t.settings.routeDecisionRecommended} t={t} />
            </div>

            <RouteDecisionSwitchRolloutCard
              evaluation={status.switchRolloutEvaluation}
              rollout={status.switchRollout}
              format={format}
              t={t}
            />
            <RouteDecisionSwitchOrchestrationCard orchestration={status.switchOrchestration} format={format} t={t} />

            <div className="flex flex-wrap gap-1">
              {status.reasonCodes.slice(0, 10).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`route-canary-${reason}`}>
                  {routeDecisionReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RouteHealthHistoryPanel({
  dataState,
  format,
  history,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  history: AdminRouteHealthHistoryResponse | null;
  t: DashboardStrings;
}) {
  const points = history?.points ?? [];
  const meta = history ? t.routeHealthHistory.points(format.integer(points.length)) : t.routeHealthHistory.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeHealthHistory} icon={Activity} meta={meta} />
      <div className="mt-2 grid gap-2">
        {points.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {points.length === 0 ? (
          <DataStateEmpty emptyMessage={t.routeHealthHistory.noPoints} state={dataState} t={t} />
        ) : null}
        {points.slice(0, 8).map((point) => (
          <div className="grid min-h-[62px] gap-2 rounded-md border border-afro-line p-2 sm:grid-cols-[minmax(0,1fr)_auto]" key={routeHealthHistoryKey(point)}>
            <div className="min-w-0">
              <strong className="block truncate text-[13px]" title={routeHealthPointRoute(point, format, t)}>
                {routeHealthPointRoute(point, format, t)}
              </strong>
              <span className={`${mutedTextClass} block truncate`} title={routeHealthPointMeta(point, format, t)}>
                {routeHealthPointMeta(point, format, t)}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
              <MetricPill icon={Gauge} label={t.routeHealthHistory.score} value={format.integer(point.averageScore)} />
              <MetricPill icon={Clock} label={t.routeHealthHistory.samples} value={format.integer(point.sampleCount)} />
              <MetricPill icon={Network} label={t.tables.loss} value={format.packetLoss(point.averagePacketLossPercent ?? null)} />
              <MetricPill icon={Activity} label={t.routeHealthHistory.latency} value={format.latency(point.averageLatencyMs ?? null)} />
              <StatusBadge tone={inventoryStatusTone(point.healthStatus)}>
                {inventoryStatusLabel(point.healthStatus, t)}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailoverPanel({
  dataState,
  emptyMessage,
  events,
  format,
  t,
}: {
  dataState: DataState;
  emptyMessage?: string;
  events: RouteFailoverRowData[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.failover} icon={ArrowDownUp} meta={t.panels.latestDecisions} />
      <div className="mt-2 grid gap-2">
        {events.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {events.length === 0 ? (
          <DataStateEmpty emptyMessage={emptyMessage ?? t.operationalData.noFailoverEvents} state={dataState} t={t} />
        ) : null}
        {events.map((event) => (
          <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={event.id}>
            <div className="min-w-0">
              <strong className="block truncate">{format.label(event.title)}</strong>
              <span className={`${mutedTextClass} block truncate`}>
                {event.detail}
                {event.createdAt ? ` / ${format.time(new Date(event.createdAt), false)}` : ''}
              </span>
            </div>
            <StatusBadge tone={event.tone}>{t.status[event.tone]}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}
