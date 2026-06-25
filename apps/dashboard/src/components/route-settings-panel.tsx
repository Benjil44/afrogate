import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CheckCircle2 } from 'lucide-react';
import type { AdminRouteAssignmentSummary, AdminRouteDecisionEventDetail, AdminRouteDecisionEventSummary, AdminRouteDecisionPreviewResponse, AdminRouteDecisionSwitchExecutionSummary, AdminRouteQualityAnalyticsResponse, AdminSessionResponse, AdminSettingsResponse, LoadBalanceStrategy, ProtocolProfile, RouteSelectionMode } from '@afrows/shared';
import { applyRouteDecisionPreview, fetchAdminSettings, fetchRouteAssignment, fetchRouteDecisionEvent, fetchRouteDecisionEvents, fetchRouteDecisionPreview, fetchRouteQualityAnalytics, recordRouteDecisionPreview, updateAdminRouteAssignment, updateAdminRouteSettings } from '../api/admin';
import { PanelHeading, StatusBadge } from '../components/primitives';
import { RouteDecisionPreviewPanel, RouteIntelligencePanel } from '../components/route-decision';
import { SettingsInput } from '../components/settings-form';
import type { DataState, WireGuardHealthCandidate } from '../dashboard-types';
import { clamp, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { buildSampleWireGuardCandidates, deriveActiveWireGuard, pickWireGuardCandidates, wireGuardCandidateSourceLabel } from '../route-candidates';
import { getWireGuardScoreTone } from '../tone';

const panelClass = 'rounded-lg border border-afro-line bg-white p-3.5 shadow-sm';

export function RouteSettingsPanel({
  format,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [routeMode, setRouteMode] = useState<RouteSelectionMode>('automatic');
  const [loadBalanceStrategy, setLoadBalanceStrategy] = useState<LoadBalanceStrategy>('balanced');
  const [selectedWireGuardId, setSelectedWireGuardId] = useState('wg-primary');
  const [routeProfile, setRouteProfile] = useState<ProtocolProfile>('balanced');
  const [assignmentAutoRouteEnabled, setAssignmentAutoRouteEnabled] = useState(true);
  const [assignmentRouteLocked, setAssignmentRouteLocked] = useState(false);
  const [assignmentCurrentOutboundId, setAssignmentCurrentOutboundId] = useState('');
  const [assignmentLockedOutboundId, setAssignmentLockedOutboundId] = useState('');
  const [assignmentHysteresisScoreDelta, setAssignmentHysteresisScoreDelta] = useState('15');
  const [assignmentCooldownSeconds, setAssignmentCooldownSeconds] = useState('180');
  const [apiWireGuardCandidates, setApiWireGuardCandidates] = useState<WireGuardHealthCandidate[]>([]);
  const [routeQualityAnalytics, setRouteQualityAnalytics] = useState<AdminRouteQualityAnalyticsResponse | null>(null);
  const [routeDecisionPreview, setRouteDecisionPreview] = useState<AdminRouteDecisionPreviewResponse | null>(null);
  const [routeDecisionEvents, setRouteDecisionEvents] = useState<AdminRouteDecisionEventSummary[]>([]);
  const [routeDecisionEventDetail, setRouteDecisionEventDetail] = useState<AdminRouteDecisionEventDetail | null>(null);
  const [routeDecisionSwitchExecution, setRouteDecisionSwitchExecution] = useState<AdminRouteDecisionSwitchExecutionSummary | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [dataState, setDataState] = useState<DataState>('loading');
  const [isRouteSaving, setIsRouteSaving] = useState(false);
  const [isDecisionRecording, setIsDecisionRecording] = useState(false);
  const [isDecisionApplying, setIsDecisionApplying] = useState(false);
  const [isDecisionEventDetailLoading, setIsDecisionEventDetailLoading] = useState(false);

  const sampleWireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(() => buildSampleWireGuardCandidates(t), [t]);
  const wireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => pickWireGuardCandidates(apiWireGuardCandidates, sampleWireGuardCandidates),
    [apiWireGuardCandidates, sampleWireGuardCandidates],
  );
  const managedWireGuardCandidates = useMemo(
    () => wireGuardCandidates.filter((candidate) => candidate.source === 'outbound'),
    [wireGuardCandidates],
  );
  const { best: bestWireGuard, selected: selectedWireGuard, active: activeWireGuard } = deriveActiveWireGuard(wireGuardCandidates, routeMode, selectedWireGuardId);
  const routeModeDescription = routeMode === 'automatic' ? t.settings.autoModeDescription : t.settings.manualModeDescription;
  const loadBalanceOptions: Array<[LoadBalanceStrategy, string]> = [
    ['balanced', t.settings.balancedStrategy],
    ['stability', t.settings.stabilityStrategy],
    ['throughput', t.settings.throughputStrategy],
  ];

  const applyRouteAssignment = (assignment: AdminRouteAssignmentSummary) => {
    setAssignmentAutoRouteEnabled(assignment.autoRouteEnabled);
    setAssignmentRouteLocked(assignment.routeLocked);
    setAssignmentCurrentOutboundId(assignment.currentOutboundId ?? '');
    setAssignmentLockedOutboundId(assignment.lockedOutboundId ?? assignment.currentOutboundId ?? '');
    setAssignmentHysteresisScoreDelta(String(assignment.hysteresisScoreDelta));
    setAssignmentCooldownSeconds(String(assignment.cooldownSeconds));
    setRouteMode(assignment.autoRouteEnabled ? 'automatic' : 'manual');
    if (assignment.currentOutboundId) setSelectedWireGuardId(assignment.currentOutboundId);
    if (
      assignment.speedProfile === 'balanced' || assignment.speedProfile === 'highSpeed' ||
      assignment.speedProfile === 'highSecurity' || assignment.speedProfile === 'gaming'
    ) {
      setRouteProfile(assignment.speedProfile);
    }
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setDataState('loading');
    setRouteQualityAnalytics(null);
    setRouteDecisionPreview(null);
    setRouteDecisionEvents([]);
    setRouteDecisionEventDetail(null);

    fetchAdminSettings(sessionToken, 'main', controller.signal)
      .then((data: AdminSettingsResponse) => {
        if (!isActive) return;
        setApiWireGuardCandidates(data.wireGuardCandidates);
        setDataState('live');
        if (
          data.routeSettings.loadBalanceStrategy === 'balanced' ||
          data.routeSettings.loadBalanceStrategy === 'stability' ||
          data.routeSettings.loadBalanceStrategy === 'throughput'
        ) {
          setLoadBalanceStrategy(data.routeSettings.loadBalanceStrategy);
        }
        if (data.routeSettings.selectedOutboundId) setSelectedWireGuardId(data.routeSettings.selectedOutboundId);
        if (
          data.routeSettings.protocolProfile === 'balanced' || data.routeSettings.protocolProfile === 'highSpeed' ||
          data.routeSettings.protocolProfile === 'highSecurity' || data.routeSettings.protocolProfile === 'gaming'
        ) {
          setRouteProfile(data.routeSettings.protocolProfile);
        }
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDataState('fallback');
      });

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((data) => { if (isActive) applyRouteAssignment(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; });

    fetchRouteQualityAnalytics(sessionToken, 'main', 168, controller.signal)
      .then((data) => { if (isActive) setRouteQualityAnalytics(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteQualityAnalytics(null); });

    fetchRouteDecisionPreview(sessionToken, 'main', 'default', controller.signal)
      .then((data) => { if (isActive) setRouteDecisionPreview(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteDecisionPreview(null); });

    fetchRouteDecisionEvents(sessionToken, 'main', 'default', 10, controller.signal)
      .then((data) => { if (isActive) setRouteDecisionEvents(data.events); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteDecisionEvents([]); });

    return () => { isActive = false; controller.abort(); };
  }, [sessionToken]);

  const saveRouteSettings = async () => {
    setIsRouteSaving(true);
    setRouteMessage(null);
    try {
      const routeGroup = 'main';
      const selectedManagedOutboundId = activeWireGuard.source === 'outbound' ? activeWireGuard.id : null;
      const currentOutboundId = assignmentCurrentOutboundId || selectedManagedOutboundId;
      const lockedOutboundId = assignmentRouteLocked ? assignmentLockedOutboundId || currentOutboundId : null;
      const mode: RouteSelectionMode = assignmentAutoRouteEnabled ? 'automatic' : 'manual';
      const hysteresisScoreDelta = clamp(Math.round(Number(assignmentHysteresisScoreDelta) || 15), 1, 100);
      const cooldownSeconds = clamp(Math.round(Number(assignmentCooldownSeconds) || 180), 30, 3600);
      await updateAdminRouteSettings(sessionToken, {
        routeGroup, mode,
        selectedOutboundId: mode === 'manual' ? currentOutboundId || null : null,
        loadBalanceStrategy, protocolProfile: routeProfile, speedProfile: routeProfile,
      });
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup, assignmentKey: 'default', assignmentLabel: t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null, lockedOutboundId: lockedOutboundId || null,
        autoRouteEnabled: assignmentAutoRouteEnabled, routeLocked: assignmentRouteLocked,
        protocolProfile: routeProfile, speedProfile: routeProfile, hysteresisScoreDelta, cooldownSeconds,
      });
      const preview = await fetchRouteDecisionPreview(sessionToken, routeGroup, 'default');
      applyRouteAssignment(savedAssignment);
      setRouteDecisionPreview(preview);
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMode(mode);
      setRouteMessage(t.settings.routeSettingsSaved);
      setDataState('live');
    } catch (error) {
      setRouteMessage(t.settings.saveFailed);
    } finally {
      setIsRouteSaving(false);
    }
  };

  const recordDecisionEvent = async () => {
    setIsDecisionRecording(true);
    setRouteMessage(null);
    try {
      const response = await recordRouteDecisionPreview(sessionToken, { routeGroup: 'main', assignmentKey: 'default' });
      setRouteDecisionPreview(response.preview);
      setRouteDecisionEvents((current) => [response.event, ...current.filter((event) => event.id !== response.event.id)].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMessage(t.settings.routeDecisionRecorded);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionRecordFailed);
    } finally {
      setIsDecisionRecording(false);
    }
  };

  const inspectDecisionEvent = async (eventId: string) => {
    setIsDecisionEventDetailLoading(true);
    setRouteMessage(null);
    try {
      const response = await fetchRouteDecisionEvent(sessionToken, eventId);
      setRouteDecisionEventDetail(response.event);
      setRouteDecisionSwitchExecution(response.event.switchExecution ?? null);
    } catch (error) {
      setRouteMessage(t.settings.decisionEventDetailFailed);
    } finally {
      setIsDecisionEventDetailLoading(false);
    }
  };

  const applyDecisionAssignment = async () => {
    setIsDecisionApplying(true);
    setRouteMessage(null);
    try {
      const response = await applyRouteDecisionPreview(sessionToken, { routeGroup: 'main', assignmentKey: 'default', applyMode: 'assignmentOnly' });
      applyRouteAssignment(response.assignment);
      setRouteDecisionPreview(response.preview);
      setRouteDecisionSwitchExecution(response.switchExecution);
      setRouteDecisionEvents((current) => [response.event, ...current.filter((event) => event.id !== response.event.id)].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteMessage(response.dataPlaneApplied ? t.settings.routeDecisionApplied : t.settings.routeDecisionAssignmentApplied);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionApplyFailed);
    } finally {
      setIsDecisionApplying(false);
    }
  };

  void session;

  return (
    <div className="flex flex-col gap-3">
      <section className={panelClass}>
        <PanelHeading title={t.panels.routeControl} icon={ArrowDownUp} meta={t.settings.smartRoute} />
        <div className="mt-3 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(['automatic', 'manual'] as RouteSelectionMode[]).map((mode) => {
                const isSelected = routeMode === mode;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef] text-afro-green' : 'border-afro-line bg-white text-afro-ink hover:border-afro-teal hover:text-afro-teal'}`}
                    key={mode}
                    onClick={() => {
                      setRouteMode(mode);
                      setAssignmentAutoRouteEnabled(mode === 'automatic');
                      if (mode === 'manual' && !assignmentCurrentOutboundId && activeWireGuard.source === 'outbound') {
                        setAssignmentCurrentOutboundId(activeWireGuard.id);
                      }
                    }}
                    type="button"
                  >
                    {mode === 'automatic' ? t.settings.automatic : t.settings.manual}
                  </button>
                );
              })}
            </div>

            <p className="rounded-md border border-afro-line bg-white px-3 py-2 text-[13px] font-bold text-afro-muted">
              {routeModeDescription}
            </p>

            <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[13px]">{t.settings.routeAssignment}</strong>
                <StatusBadge tone={assignmentRouteLocked ? 'warning' : assignmentAutoRouteEnabled ? 'good' : 'neutral'}>
                  {assignmentRouteLocked ? t.routePolicy.routeLock : assignmentAutoRouteEnabled ? t.routePolicy.autoRoute : t.settings.manual}
                </StatusBadge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRouteToggle}</span>
                  <input
                    checked={assignmentAutoRouteEnabled}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentAutoRouteEnabled(event.target.checked);
                      setRouteMode(event.target.checked ? 'automatic' : 'manual');
                    }}
                    type="checkbox"
                  />
                </label>
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.routeLockToggle}</span>
                  <input
                    checked={assignmentRouteLocked}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentRouteLocked(event.target.checked);
                      if (event.target.checked && !assignmentLockedOutboundId) {
                        setAssignmentLockedOutboundId(assignmentCurrentOutboundId || managedWireGuardCandidates[0]?.id || '');
                      }
                    }}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.currentManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                    onChange={(event) => {
                      setAssignmentCurrentOutboundId(event.target.value);
                      if (!assignmentLockedOutboundId) setAssignmentLockedOutboundId(event.target.value);
                    }}
                    value={assignmentCurrentOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.lockedManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-50"
                    disabled={!assignmentRouteLocked}
                    onChange={(event) => setAssignmentLockedOutboundId(event.target.value)}
                    value={assignmentLockedOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <SettingsInput inputMode="numeric" label={t.settings.hysteresisScoreDelta} onChange={setAssignmentHysteresisScoreDelta} value={assignmentHysteresisScoreDelta} />
                <SettingsInput inputMode="numeric" label={t.settings.cooldownSeconds} onChange={setAssignmentCooldownSeconds} value={assignmentCooldownSeconds} />
              </div>
              {managedWireGuardCandidates.length === 0 ? <p className="text-[12px] font-bold text-afro-muted">{t.settings.noManagedWireGuard}</p> : null}
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.loadBalanceStrategy}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {loadBalanceOptions.map(([value, label]) => {
                  const isSelected = loadBalanceStrategy === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-blue bg-[#edf4ff] text-afro-blue' : 'border-afro-line bg-white text-afro-ink hover:border-afro-blue hover:text-afro-blue'}`}
                      key={value}
                      onClick={() => setLoadBalanceStrategy(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {routeMode === 'manual' ? (
              <div>
                <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.manualWireGuard}</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {wireGuardCandidates.map((candidate) => {
                    const isSelected = selectedWireGuard.id === candidate.id;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`grid min-h-[74px] gap-1 rounded-md border px-3 py-2 text-start transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef]' : 'border-afro-line bg-white hover:border-afro-teal'}`}
                        key={candidate.id}
                        onClick={() => setSelectedWireGuardId(candidate.id)}
                        type="button"
                      >
                        <span className="truncate text-sm font-bold text-afro-ink">{candidate.name}</span>
                        <span className="truncate text-[12px] text-afro-muted" dir="ltr">{candidate.endpoint ?? '-'}</span>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.percent(candidate.score)}</StatusBadge>
                          <StatusBadge tone={candidate.source === 'agent' ? 'good' : 'neutral'}>
                            {wireGuardCandidateSourceLabel(candidate, t)}
                          </StatusBadge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRecommendation}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <strong className="min-w-0 truncate text-sm">{bestWireGuard.name}</strong>
                  <StatusBadge tone={getWireGuardScoreTone(bestWireGuard.score)}>{t.settings.bestHealth}</StatusBadge>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <span className="text-[13px] font-bold text-afro-muted">
                {dataState === 'live' ? t.settings.settingsStorageReady : t.settings.localDraftOnly}
              </span>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                disabled={isRouteSaving}
                onClick={() => void saveRouteSettings()}
                type="button"
              >
                <CheckCircle2 size={16} />
                {isRouteSaving ? t.settings.saving : t.settings.saveRouteSettings}
              </button>
            </div>
            {routeMessage ? <p className="text-[13px] font-bold text-afro-teal">{routeMessage}</p> : null}
        </div>
      </section>
      <RouteIntelligencePanel analytics={routeQualityAnalytics} format={format} t={t} />
      <RouteDecisionPreviewPanel
        eventDetail={routeDecisionEventDetail}
        events={routeDecisionEvents}
        format={format}
        isApplying={isDecisionApplying}
        isEventDetailLoading={isDecisionEventDetailLoading}
        isRecording={isDecisionRecording}
        onApply={() => void applyDecisionAssignment()}
        onInspectEvent={(eventId) => void inspectDecisionEvent(eventId)}
        onRecord={() => void recordDecisionEvent()}
        preview={routeDecisionPreview}
        switchExecution={routeDecisionSwitchExecution}
        t={t}
      />
    </div>
  );
}
