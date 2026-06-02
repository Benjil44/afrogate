import type { ReactNode } from 'react';
import { Activity, AlertTriangle, ArrowDownUp, Clock, Eye, Gauge, LockKeyhole, Network, Route, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import type { AdminRouteDecisionApplyAdapterSummary, AdminRouteDecisionApplyPlanStep, AdminRouteDecisionApplyPlanSummary, AdminRouteDecisionCandidateReviewSummary, AdminRouteDecisionCandidateSummary, AdminRouteDecisionClientPreferenceSummary, AdminRouteDecisionEventDetail, AdminRouteDecisionEventSummary, AdminRouteDecisionLoadBalancingSummary, AdminRouteDecisionPreviewResponse, AdminRouteDecisionProfileRecommendation, AdminRouteDecisionSessionSafetySummary, AdminRouteDecisionSwitchEngineSummary, AdminRouteDecisionSwitchExecutionSummary, AdminRouteDecisionSwitchOrchestrationSummary, AdminRouteDecisionSwitchPreflightSummary, AdminRouteDecisionSwitchRolloutEvaluationSummary, AdminRouteDecisionSwitchRolloutSummary, AdminRouteQualityAnalyticsResponse, RouteDecisionAction } from '@afrogate/shared';
import type { Tone } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { formatLoadedLatency, formatMtuRecommendation, routeApplyAdapterStatusLabel, routeApplyAdapterStatusTone, routeApplyPlanStatusLabel, routeApplyPlanStatusTone, routeApplyPlanStepLabel, routeClientPreferenceModeLabel, routeDecisionActionLabel, routeDecisionCandidateSourceLabel, routeDecisionDispositionLabel, routeDecisionReasonLabel, routeDecisionStateLabel, routeLoadBalanceStrategyLabel, routeLoadBalancingModeLabel, routeLoadBalancingModeTone, routeLoadBalancingReasonLabel, routeLoadBalancingRiskLabel, routeLoadBalancingRiskTone, routeLoadBalancingRoleLabel, routeProfileRecommendationReasonLabel, routeScoreProfileLabel, routeScoreReasonLabel, routeSessionSafetyModeLabel, routeSessionSafetyModeTone, routeSessionSafetyPolicyLabel, routeSessionSafetyReasonLabel, routeSessionSafetyRiskLabel, routeSessionSafetyRiskTone, routeSwitchEngineModeLabel, routeSwitchEngineReasonLabel, routeSwitchEngineSessionImpactLabel, routeSwitchEngineStatusLabel, routeSwitchEngineStatusTone, routeSwitchEngineStepLabel, routeSwitchEngineStepStatusLabel, routeSwitchEngineStepStatusTone, routeSwitchExecutionPhaseLabel, routeSwitchExecutionReasonLabel, routeSwitchExecutionStatusLabel, routeSwitchExecutionStatusTone, routeSwitchOrchestrationActionLabel, routeSwitchOrchestrationPhaseLabel, routeSwitchOrchestrationReasonLabel, routeSwitchOrchestrationStageLabel, routeSwitchOrchestrationStageStatusLabel, routeSwitchOrchestrationStageStatusTone, routeSwitchOrchestrationStatusLabel, routeSwitchOrchestrationStatusTone, routeSwitchPreflightCheckLabel, routeSwitchPreflightCheckStatusLabel, routeSwitchPreflightCheckStatusTone, routeSwitchPreflightReasonLabel, routeSwitchPreflightStatusLabel, routeSwitchPreflightStatusTone, routeSwitchRolloutEvaluationActionLabel, routeSwitchRolloutEvaluationReasonLabel, routeSwitchRolloutEvaluationStatusLabel, routeSwitchRolloutEvaluationStatusTone, routeSwitchRolloutReasonLabel, routeSwitchRolloutStatusLabel, routeSwitchRolloutStatusTone, routeSwitchRolloutStepLabel, routeSwitchRolloutStepStatusLabel, routeSwitchRolloutStepStatusTone, routeSwitchRolloutStrategyLabel, routeSwitchRolloutTrafficScopeLabel } from '../route-labels';
import { formatRouteHourWindow, routeRecommendationConfidence, routeRecommendationDetail, routeRecommendationKey, routeRecommendationOperator, routeRecommendationProfile, routeRecommendationTitle } from '../route-helpers';
import { getWireGuardScoreTone } from '../tone';
import { mutedTextClass, panelClass } from '../ui-classes';
import { EmptyState, MetricPill, PanelHeading, StatusBadge, primitiveTooltip } from '../components/primitives';

export function RouteIntelligencePanel({
  analytics,
  format,
  t,
}: {
  analytics: AdminRouteQualityAnalyticsResponse | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const recommendations = analytics?.recommendations ?? [];
  const actionableRecommendations = recommendations.filter((item) => item.kind !== 'insufficientData');
  const meta = analytics
    ? t.settings.routeAnalyticsWindows(format.integer(analytics.windows.length))
    : t.settings.routeAnalyticsLearning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeIntelligence} icon={Activity} meta={meta} />
      <div className="mt-2 grid gap-2">
        {actionableRecommendations.length === 0 ? (
          <EmptyState message={analytics ? t.settings.noRouteRecommendations : t.settings.routeAnalyticsLearning} />
        ) : null}
        {actionableRecommendations.map((recommendation) => (
          <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-2" key={routeRecommendationKey(recommendation)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">
                  {routeRecommendationTitle(recommendation, t)}
                </strong>
                <span className="block truncate text-[12px] text-afro-muted">
                  {routeRecommendationDetail(recommendation, format, t)}
                </span>
              </div>
              <StatusBadge tone={recommendation.kind === 'degradedWindow' || recommendation.kind === 'upcomingDegradedWindow' ? 'warning' : 'good'}>
                {routeRecommendationConfidence(recommendation, t)}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-4">
              <MetricPill
                icon={Clock}
                label={t.settings.routeWindow}
                value={formatRouteHourWindow(recommendation.hourOfDay ?? null, format)}
              />
              <MetricPill
                icon={Gauge}
                label={t.settings.averageScore}
                value={recommendation.averageScore === null || recommendation.averageScore === undefined ? '--' : format.integer(recommendation.averageScore)}
              />
              <MetricPill
                icon={Network}
                label={t.settings.routeOperator}
                value={routeRecommendationOperator(recommendation, format, t)}
              />
              <MetricPill
                icon={Route}
                label={t.settings.routeProfile}
                value={routeRecommendationProfile(recommendation, format, t)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RouteDecisionPreviewPanel({
  eventDetail,
  events,
  preview,
  format,
  isApplying,
  isEventDetailLoading,
  isRecording,
  onApply,
  onInspectEvent,
  onRecord,
  t,
  switchExecution,
}: {
  eventDetail: AdminRouteDecisionEventDetail | null;
  events: AdminRouteDecisionEventSummary[];
  preview: AdminRouteDecisionPreviewResponse | null;
  format: DashboardFormatters;
  isApplying: boolean;
  isEventDetailLoading: boolean;
  isRecording: boolean;
  onApply: () => void;
  onInspectEvent: (eventId: string) => void;
  onRecord: () => void;
  switchExecution: AdminRouteDecisionSwitchExecutionSummary | null;
  t: DashboardStrings;
}) {
  const meta = preview
    ? t.settings.routeDecisionCandidates(format.integer(preview.healthyCandidateCount), format.integer(preview.candidateCount))
    : t.settings.routeDecisionAdvisory;
  const canApplyAssignment = Boolean(
    preview?.action === 'switchRecommended' &&
      preview.recommendedCandidate?.source === 'outbound' &&
      preview.autoRouteEnabled &&
      !preview.routeLocked,
  );

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeDecision} icon={ShieldCheck} meta={meta} />
      {preview ? (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <RouteDecisionMetric label={t.settings.routeDecisionAction}>
              <StatusBadge tone={routeDecisionActionTone(preview.action)}>{routeDecisionActionLabel(preview.action, t)}</StatusBadge>
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionScoreDelta}>
              {preview.scoreDelta === null || preview.scoreDelta === undefined ? '--' : format.integer(preview.scoreDelta)}
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionHysteresis}>
              {format.integer(preview.hysteresisScoreDelta)}
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionCooldown}>
              {preview.cooldownUntil ? format.time(new Date(preview.cooldownUntil)) : format.durationSeconds(preview.cooldownSeconds)}
            </RouteDecisionMetric>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <RouteDecisionCandidateCard candidate={preview.currentCandidate ?? null} format={format} label={t.settings.routeDecisionCurrent} t={t} />
            <RouteDecisionCandidateCard candidate={preview.recommendedCandidate ?? null} format={format} label={t.settings.routeDecisionRecommended} t={t} />
          </div>

          <RouteDecisionClientPreferenceCard preference={preview.clientRoutePreference ?? null} format={format} t={t} />
          <RouteDecisionProfileRecommendationList
            format={format}
            recommendations={preview.profileRecommendations ?? []}
            selectedProfile={preview.selectedScoreProfile ?? null}
            t={t}
          />
          <RouteDecisionLoadBalancingCard loadBalancing={preview.loadBalancing} format={format} t={t} />
          <RouteDecisionSessionSafetyCard sessionSafety={preview.sessionSafety} format={format} t={t} />
          <RouteDecisionSwitchEngineCard switchEngine={preview.switchEngine} format={format} t={t} />
          <RouteDecisionSwitchPreflightCard preflight={preview.switchPreflight} format={format} t={t} />
          <RouteDecisionSwitchRolloutCard
            evaluation={preview.switchRolloutEvaluation}
            rollout={preview.switchRollout}
            format={format}
            t={t}
          />
          <RouteDecisionSwitchOrchestrationCard orchestration={preview.switchOrchestration} format={format} t={t} />
          <RouteDecisionSwitchExecutionCard execution={switchExecution} format={format} t={t} />
          <RouteDecisionCandidateReviewList reviews={preview.candidateReviews ?? []} format={format} t={t} />
          <RouteDecisionApplyPlanCard plan={preview.applyPlan} t={t} />

          <div className="flex flex-wrap gap-1.5">
            {preview.reasonCodes.map((reason) => (
              <span className="rounded-md border border-afro-line bg-white px-2 py-1 text-[12px] font-bold text-afro-muted" key={reason}>
                {routeDecisionReasonLabel(reason, t)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canApplyAssignment || isApplying}
              onClick={onApply}
              type="button"
            >
              <Route size={15} />
              {isApplying ? t.settings.applyingDecision : t.settings.applyDecisionAssignment}
            </button>
            <button
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
              disabled={isRecording}
              onClick={onRecord}
              type="button"
            >
              <Clock size={15} />
              {isRecording ? t.settings.recordingDecision : t.settings.recordDecisionEvent}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState message={t.settings.routeDecisionNoPreview} />
        </div>
      )}
      <RouteDecisionEventList
        eventDetail={eventDetail}
        events={events}
        format={format}
        isDetailLoading={isEventDetailLoading}
        onInspectEvent={onInspectEvent}
        t={t}
      />
    </section>
  );
}

export function RouteDecisionClientPreferenceCard({
  preference,
  format,
  t,
}: {
  preference: AdminRouteDecisionClientPreferenceSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!preference) return null;

  const preferredOutbound = preference.preferredOutboundName ?? preference.preferredOutboundId ?? '-';
  const preferredCountry = preference.preferredExitCountryCode ?? '-';
  const detectedCountry = preference.detectedCountryCode ?? '-';
  const targetAvailable =
    preference.mode === 'outbound'
      ? preference.preferredOutboundAvailable
      : preference.mode === 'country'
        ? preference.preferredCountryAvailable
        : true;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.routeClientPreference}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {preference.assignmentKey}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={targetAvailable ? 'good' : 'warning'}>
            {targetAvailable ? t.settings.routeClientPreferenceAvailable : t.settings.routeClientPreferenceUnavailable}
          </StatusBadge>
          <StatusBadge tone={preference.stickySessionProtection ? 'good' : 'neutral'}>
            {preference.stickySessionProtection ? t.settings.routeClientPreferenceSticky : t.settings.routeClientPreferenceNoSticky}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricPill icon={Route} label={t.settings.routeClientPreferenceMode} value={routeClientPreferenceModeLabel(preference.mode, t)} />
        <MetricPill icon={Network} label={t.settings.routeClientDetectedCountry} value={detectedCountry} />
        <MetricPill icon={Network} label={t.settings.routeClientPreferredCountry} value={preferredCountry} />
        <MetricPill icon={Route} label={t.settings.routeClientPreferredOutbound} value={preferredOutbound} />
        <MetricPill icon={Gauge} label={t.settings.routeClientPreferredMatches} value={format.integer(preference.preferredCountryCandidateCount)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {preference.reasonCodes.slice(0, 6).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`client-route-pref-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionProfileRecommendationList({
  recommendations,
  selectedProfile,
  format,
  t,
}: {
  recommendations: AdminRouteDecisionProfileRecommendation[];
  selectedProfile: string | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.profileRecommendations}</strong>
        <span className="text-[12px] font-bold text-afro-muted">
          {selectedProfile ? routeScoreProfileLabel(selectedProfile, t) : t.settings.unknownProfile}
        </span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {recommendations.length === 0 ? <EmptyState message={t.settings.noProfileRecommendations} /> : null}
        {recommendations.map((recommendation) => {
          const isSelected = recommendation.profile === selectedProfile;
          const delta = recommendation.scoreDeltaFromSelected > 0
            ? `+${format.integer(recommendation.scoreDeltaFromSelected)}`
            : format.integer(recommendation.scoreDeltaFromSelected);

          return (
            <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={recommendation.profile}>
              <div className="flex min-h-7 items-center justify-between gap-2">
                <div className="min-w-0">
                  <strong className="block truncate text-[13px]">{routeScoreProfileLabel(recommendation.profile, t)}</strong>
                  <span className={`${mutedTextClass} block truncate`}>
                    {recommendation.recommendedCandidateName ?? t.settings.noManagedRouteSelected}
                  </span>
                </div>
                <span className="inline-flex shrink-0 flex-wrap justify-end gap-1">
                  {isSelected ? <StatusBadge tone="neutral">{t.settings.selectedProfile}</StatusBadge> : null}
                  <StatusBadge tone={recommendation.scoreDeltaFromSelected >= 8 ? 'good' : 'neutral'}>
                    {format.integer(recommendation.score)}
                  </StatusBadge>
                </span>
              </div>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5">
                <MetricPill icon={ArrowDownUp} label={t.settings.routeDecisionCandidateDelta} value={delta} />
                <MetricPill icon={Route} label={t.settings.usableCandidates} value={format.integer(recommendation.candidateCount)} />
              </div>
              <div className="flex flex-wrap gap-1">
                {recommendation.reasonCodes.slice(0, 3).map((reason) => (
                  <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${recommendation.profile}-${reason}`}>
                    {routeProfileRecommendationReasonLabel(reason, t)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RouteDecisionLoadBalancingCard({
  loadBalancing,
  format,
  t,
}: {
  loadBalancing?: AdminRouteDecisionLoadBalancingSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!loadBalancing) return null;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.smartLoadBalancing}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {t.settings.loadBalancingEligible(format.integer(loadBalancing.eligibleCandidateCount), format.integer(loadBalancing.candidateCount))}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeLoadBalancingModeTone(loadBalancing.mode)}>
            {routeLoadBalancingModeLabel(loadBalancing.mode, t)}
          </StatusBadge>
          <StatusBadge tone="neutral">{routeLoadBalanceStrategyLabel(loadBalancing.strategy, t)}</StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <MetricPill
          icon={Route}
          label={t.settings.loadBalancingPrimary}
          value={loadBalancing.primaryCandidateName ?? t.settings.routeDecisionNoCandidate}
        />
        <MetricPill
          icon={ArrowDownUp}
          label={t.settings.loadBalancingSecondary}
          value={loadBalancing.secondaryCandidateName ?? t.settings.routeDecisionNoCandidate}
        />
        <MetricPill
          icon={Gauge}
          label={t.settings.loadBalancingTotalWeight}
          value={format.percent(loadBalancing.totalAssignedWeightPercent)}
        />
      </div>

      <div className="grid gap-1.5 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {loadBalancing.candidates.length === 0 ? <EmptyState message={t.settings.loadBalancingNoCandidates} /> : null}
        {loadBalancing.candidates.map((candidate) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={candidate.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{candidate.name}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeLoadBalancingRoleLabel(candidate.role, t)}
                </span>
              </div>
              <StatusBadge tone={routeLoadBalancingRiskTone(candidate.riskLevel)}>
                {routeLoadBalancingRiskLabel(candidate.riskLevel, t)}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5">
              <MetricPill icon={ArrowDownUp} label={t.settings.loadBalancingWeight} value={format.percent(candidate.weightPercent)} />
              <MetricPill icon={Gauge} label={t.settings.loadBalancingAdjustedScore} value={format.integer(candidate.adjustedScore)} />
              <MetricPill icon={ShieldCheck} label={t.settings.loadBalancingProfileScore} value={format.integer(candidate.profileScore)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {candidate.reasonCodes.slice(0, 4).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${candidate.id}-${reason}`}>
                  {routeLoadBalancingReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {loadBalancing.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`load-balancing-${reason}`}>
            {routeLoadBalancingReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSessionSafetyCard({
  sessionSafety,
  format,
  t,
}: {
  sessionSafety?: AdminRouteDecisionSessionSafetySummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!sessionSafety) return null;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.sessionSafety}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSessionSafetyPolicyLabel(sessionSafety.policy, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSessionSafetyModeTone(sessionSafety.mode)}>
            {routeSessionSafetyModeLabel(sessionSafety.mode, t)}
          </StatusBadge>
          <StatusBadge tone={routeSessionSafetyRiskTone(sessionSafety.riskLevel)}>
            {routeSessionSafetyRiskLabel(sessionSafety.riskLevel, t)}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        <MetricPill
          icon={LockKeyhole}
          label={t.settings.sessionSafetyStickyTtl}
          value={format.durationSeconds(sessionSafety.stickySessionTtlSeconds)}
        />
        <MetricPill
          icon={Clock}
          label={t.settings.sessionSafetyDrain}
          value={format.durationSeconds(sessionSafety.estimatedDrainSeconds)}
        />
        <MetricPill
          icon={Route}
          label={t.settings.sessionSafetyNewSessions}
          value={sessionSafety.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={AlertTriangle}
          label={t.settings.sessionSafetyEmergency}
          value={sessionSafety.emergencySwitchAllowed ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {sessionSafety.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`session-safety-${reason}`}>
            {routeSessionSafetyReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSwitchEngineCard({
  switchEngine,
  format,
  t,
}: {
  switchEngine?: AdminRouteDecisionSwitchEngineSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!switchEngine) return null;

  const visibleSteps = switchEngine.steps.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchEngine}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchEngineModeLabel(switchEngine.mode, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchEngineStatusTone(switchEngine.status)}>
            {routeSwitchEngineStatusLabel(switchEngine.status, t)}
          </StatusBadge>
          <StatusBadge tone={switchEngine.dataPlaneReady ? 'good' : 'neutral'}>
            {switchEngine.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill
          icon={LockKeyhole}
          label={t.settings.switchEnginePreserveExisting}
          value={switchEngine.preserveExistingSessions ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Route}
          label={t.settings.switchEngineNewSessions}
          value={switchEngine.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Clock}
          label={t.settings.switchEngineEstimated}
          value={format.durationSeconds(switchEngine.estimatedTotalSeconds)}
        />
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchEngineRollback}
          value={switchEngine.rollbackReady ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={step.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchEngineStepLabel(step.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchEngineSessionImpactLabel(step.sessionImpact, t)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchEngineStepStatusTone(step.status)}>
                {routeSwitchEngineStepStatusLabel(step.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
                {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                {format.durationSeconds(step.estimatedSeconds ?? 0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {switchEngine.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-engine-${reason}`}>
            {routeSwitchEngineReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSwitchPreflightCard({
  preflight,
  format,
  t,
}: {
  preflight?: AdminRouteDecisionSwitchPreflightSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!preflight) return null;

  const visibleChecks = preflight.checks.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchPreflight}</strong>
          <span className={`${mutedTextClass} block truncate`}>{t.settings.switchPreflightChecks(format.integer(preflight.checkCount))}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchPreflightStatusTone(preflight.status)}>
            {routeSwitchPreflightStatusLabel(preflight.status, t)}
          </StatusBadge>
          <StatusBadge tone={preflight.canExecuteDataPlane ? 'good' : 'neutral'}>
            {preflight.canExecuteDataPlane ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill
          icon={Network}
          label={t.settings.routeApplyDataPlaneReady}
          value={preflight.dataPlaneReady ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchPreflightSafeToArm}
          value={preflight.safeToArm ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill icon={AlertTriangle} label={t.settings.switchPreflightFailed} value={format.integer(preflight.failedCheckCount)} />
        <MetricPill icon={Clock} label={t.settings.switchPreflightFuture} value={format.integer(preflight.futureCheckCount)} />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleChecks.map((check) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={check.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchPreflightCheckLabel(check.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {check.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                </span>
              </div>
              <StatusBadge tone={routeSwitchPreflightCheckStatusTone(check.status)}>
                {routeSwitchPreflightCheckStatusLabel(check.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              {check.estimatedSeconds !== null && check.estimatedSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(check.estimatedSeconds)}
                </span>
              ) : null}
              {check.reasonCodes.slice(0, 3).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${check.id}-${reason}`}>
                  {routeSwitchPreflightReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {preflight.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-preflight-${reason}`}>
            {routeSwitchPreflightReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSwitchRolloutCard({
  evaluation,
  rollout,
  format,
  t,
}: {
  evaluation?: AdminRouteDecisionSwitchRolloutEvaluationSummary | null;
  rollout?: AdminRouteDecisionSwitchRolloutSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!rollout) return null;

  const visibleSteps = rollout.steps.slice(0, 7);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchRollout}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchRolloutStrategyLabel(rollout.strategy, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchRolloutStatusTone(rollout.status)}>
            {routeSwitchRolloutStatusLabel(rollout.status, t)}
          </StatusBadge>
          <StatusBadge tone={rollout.dataPlaneReady ? 'good' : 'neutral'}>
            {rollout.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={Gauge} label={t.settings.switchRolloutInitial} value={format.percent(rollout.initialPercent)} />
        <MetricPill icon={Route} label={t.settings.switchRolloutMax} value={format.percent(rollout.maxPercent)} />
        <MetricPill icon={Clock} label={t.settings.switchRolloutCanaryDuration} value={format.durationSeconds(rollout.canaryDurationSeconds)} />
        <MetricPill icon={LockKeyhole} label={t.settings.switchRolloutHold} value={format.durationSeconds(rollout.routeConsistencyHoldSeconds)} />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        <MetricPill icon={AlertTriangle} label={t.settings.switchRolloutLossGuard} value={format.packetLoss(rollout.rollbackOnLossPercent)} />
        <MetricPill icon={Activity} label={t.settings.switchRolloutJitterGuard} value={format.latency(rollout.rollbackOnJitterMs)} />
        <MetricPill icon={Clock} label={t.settings.switchRolloutLatencyGuard} value={format.latency(rollout.rollbackOnLatencyMs)} />
      </div>

      {evaluation ? (
        <div className="grid gap-1.5 rounded-md border border-afro-line bg-afro-soft/60 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <strong className="block text-[13px]">{t.settings.switchRolloutEvaluation}</strong>
              <span className={`${mutedTextClass} block truncate`}>
                {routeSwitchRolloutEvaluationActionLabel(evaluation.recommendedAction, t)}
              </span>
            </div>
            <span className="inline-flex flex-wrap justify-end gap-1">
              <StatusBadge tone={routeSwitchRolloutEvaluationStatusTone(evaluation.status)}>
                {routeSwitchRolloutEvaluationStatusLabel(evaluation.status, t)}
              </StatusBadge>
              <StatusBadge tone={evaluation.guardPassed ? 'good' : 'neutral'}>
                {evaluation.guardPassed ? t.settings.switchRolloutGuardPassed : t.settings.switchRolloutGuardPending}
              </StatusBadge>
            </span>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-4">
            <MetricPill icon={Gauge} label={t.settings.switchRolloutCanary} value={format.percent(evaluation.canaryPercent)} />
            <MetricPill icon={ArrowDownUp} label={t.settings.switchRolloutNext} value={format.percent(evaluation.nextPercent)} />
            <MetricPill icon={LockKeyhole} label={t.settings.switchRolloutHoldRemaining} value={format.durationSeconds(evaluation.holdSecondsRemaining)} />
            <MetricPill icon={ShieldCheck} label={t.settings.switchRolloutObservedScore} value={format.percent(evaluation.observedScore ?? null)} />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3">
            <MetricPill icon={AlertTriangle} label={t.settings.switchRolloutObservedLoss} value={format.packetLoss(evaluation.observedLossPercent ?? null)} />
            <MetricPill icon={Activity} label={t.settings.switchRolloutObservedJitter} value={format.latency(evaluation.observedJitterMs ?? null)} />
            <MetricPill icon={Clock} label={t.settings.switchRolloutObservedLatency} value={format.latency(evaluation.observedLatencyMs ?? null)} />
          </div>

          <div className="flex flex-wrap gap-1">
            {evaluation.reasonCodes.slice(0, 8).map((reason) => (
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-rollout-eval-${reason}`}>
                {routeSwitchRolloutEvaluationReasonLabel(reason, t)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={step.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchRolloutStepLabel(step.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchRolloutTrafficScopeLabel(step.trafficScope, t)} / {format.percent(step.targetPercent)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchRolloutStepStatusTone(step.status)}>
                {routeSwitchRolloutStepStatusLabel(step.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
                {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              {step.durationSeconds !== null && step.durationSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(step.durationSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {rollout.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-rollout-${reason}`}>
            {routeSwitchRolloutReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSwitchOrchestrationCard({
  orchestration,
  format,
  t,
}: {
  orchestration?: AdminRouteDecisionSwitchOrchestrationSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!orchestration) return null;

  const visibleStages = orchestration.stages.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchOrchestration}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeSwitchOrchestrationActionLabel(orchestration.recommendedAction, t)}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchOrchestrationStatusTone(orchestration.status)}>
            {routeSwitchOrchestrationStatusLabel(orchestration.status, t)}
          </StatusBadge>
          <StatusBadge tone={orchestration.activeSessionsProtected ? 'good' : orchestration.activeSessionsMayMove ? 'critical' : 'neutral'}>
            {orchestration.activeSessionsProtected
              ? t.settings.switchOrchestrationSessionsProtected
              : orchestration.activeSessionsMayMove
                ? t.settings.switchOrchestrationSessionsMayMove
                : t.settings.switchOrchestrationNoSessionMove}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={ShieldCheck} label={t.settings.switchOrchestrationPhase} value={routeSwitchOrchestrationPhaseLabel(orchestration.phase, t)} />
        <MetricPill icon={Network} label={t.settings.switchOrchestrationExecutable} value={orchestration.canExecuteDataPlane ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={Gauge} label={t.settings.switchOrchestrationCanary} value={format.percent(orchestration.canaryPercent)} />
        <MetricPill icon={ArrowDownUp} label={t.settings.switchOrchestrationNext} value={format.percent(orchestration.nextPercent)} />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={Clock} label={t.settings.switchOrchestrationHold} value={format.durationSeconds(orchestration.holdSecondsRemaining)} />
        <MetricPill icon={LockKeyhole} label={t.settings.switchOrchestrationSticky} value={orchestration.preserveExistingSessions ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={Route} label={t.settings.switchOrchestrationNewOnly} value={orchestration.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={AlertTriangle} label={t.settings.switchOrchestrationRollback} value={orchestration.rollbackRequired ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleStages.map((stage) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={stage.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchOrchestrationStageLabel(stage.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchRolloutTrafficScopeLabel(stage.trafficScope, t)} / {routeSwitchEngineSessionImpactLabel(stage.sessionImpact, t)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchOrchestrationStageStatusTone(stage.status)}>
                {routeSwitchOrchestrationStageStatusLabel(stage.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={stage.dataPlaneMutation ? 'warning' : 'neutral'}>
                {stage.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                {format.percent(stage.targetPercent)}
              </span>
              {stage.estimatedSeconds !== null && stage.estimatedSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(stage.estimatedSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {orchestration.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-orchestration-${reason}`}>
            {routeSwitchOrchestrationReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionSwitchExecutionCard({
  execution,
  format,
  t,
}: {
  execution?: AdminRouteDecisionSwitchExecutionSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!execution) return null;

  const timeOrDash = (value?: string | null) => (value ? format.time(new Date(value)) : '-');

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchExecution}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchExecutionPhaseLabel(execution.phase, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchExecutionStatusTone(execution.status)}>
            {routeSwitchExecutionStatusLabel(execution.status, t)}
          </StatusBadge>
          <StatusBadge tone={execution.dataPlaneApplied ? 'good' : 'neutral'}>
            {execution.dataPlaneApplied ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchExecutionAssignment}
          value={execution.assignmentApplied ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Network}
          label={t.settings.switchExecutionDataPlane}
          value={execution.dataPlaneApplied ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill icon={LockKeyhole} label={t.settings.switchExecutionStickyUntil} value={timeOrDash(execution.stickyUntil)} />
        <MetricPill icon={Clock} label={t.settings.switchExecutionDrainUntil} value={timeOrDash(execution.drainUntil)} />
        <MetricPill icon={Gauge} label={t.settings.switchExecutionCooldownUntil} value={timeOrDash(execution.cooldownUntil)} />
        <MetricPill icon={Route} label={t.settings.switchExecutionFutureSteps} value={format.integer(execution.futureStepIds.length)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {execution.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-execution-${reason}`}>
            {routeSwitchExecutionReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionCandidateReviewList({
  reviews,
  format,
  t,
}: {
  reviews: AdminRouteDecisionCandidateReviewSummary[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.candidateReview}</strong>
        <span className="text-[12px] font-bold text-afro-muted">{t.settings.candidateReviewCount(format.integer(reviews.length))}</span>
      </div>
      <div className="grid gap-1.5">
        {reviews.length === 0 ? <EmptyState message={t.settings.noCandidateReview} /> : null}
        {reviews.map((review) => (
          <RouteDecisionCandidateReviewRow format={format} key={review.id} review={review} t={t} />
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionApplyPlanCard({
  plan,
  t,
}: {
  plan?: AdminRouteDecisionApplyPlanSummary;
  t: DashboardStrings;
}) {
  if (!plan) return null;

  const visibleSteps = plan.steps.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.routeApplyPlan}</strong>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeApplyPlanStatusTone(plan.status)}>{routeApplyPlanStatusLabel(plan.status, t)}</StatusBadge>
          <StatusBadge tone={plan.dataPlaneReady ? 'good' : 'neutral'}>
            {plan.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {plan.guardReasonCodes.slice(0, 6).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`apply-plan-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
      </div>

      <RouteDecisionApplyAdapterCard adapter={plan.adapter} t={t} />

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <RouteDecisionApplyPlanStepRow key={step.id} step={step} t={t} />
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionApplyAdapterCard({
  adapter,
  t,
}: {
  adapter: AdminRouteDecisionApplyAdapterSummary;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-1.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[12px]">{t.settings.routeApplyAdapter}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {adapter.label} / {adapter.outboundType ?? '-'}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeApplyAdapterStatusTone(adapter.status)}>
            {routeApplyAdapterStatusLabel(adapter.status, t)}
          </StatusBadge>
          <StatusBadge tone={adapter.enabled ? 'good' : 'neutral'}>
            {adapter.enabled ? t.settings.routeApplyAdapterEnabled : t.settings.routeApplyAdapterDisabled}
          </StatusBadge>
        </span>
      </div>

      {adapter.dryRunCommands.length > 0 ? (
        <div className="grid gap-1">
          <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyDryRunCommands}</strong>
          {adapter.dryRunCommands.slice(0, 5).map((item) => (
            <div className="grid gap-1 rounded border border-afro-line px-2 py-1" key={item.id}>
              <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
              <span className="flex flex-wrap gap-1">
                <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                  {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                </StatusBadge>
                <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                  {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                </StatusBadge>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {adapter.dryRunConfigChanges.length > 0 ? (
        <div className="grid gap-1">
          <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyConfigChanges}</strong>
          {adapter.dryRunConfigChanges.slice(0, 3).map((item) => (
            <div className="grid gap-0.5 rounded border border-afro-line px-2 py-1" key={item.id}>
              <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{item.description}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RouteDecisionApplyPlanStepRow({
  step,
  t,
}: {
  step: AdminRouteDecisionApplyPlanStep;
  t: DashboardStrings;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line px-2 py-1">
      <span className="min-w-0 truncate text-[12px] font-bold text-afro-ink">{routeApplyPlanStepLabel(step.code, t)}</span>
      <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
        {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
      </StatusBadge>
    </div>
  );
}

export function RouteDecisionCandidateReviewRow({
  review,
  format,
  t,
}: {
  review: AdminRouteDecisionCandidateReviewSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const scoreDelta =
    review.scoreDeltaFromCurrent === null || review.scoreDeltaFromCurrent === undefined ? '--' : format.integer(review.scoreDeltaFromCurrent);
  const reasonCodes = review.reviewReasonCodes.slice(0, 5);
  const scoreReasons = review.scoreReasons?.slice(0, 3) ?? [];

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{format.label(review.name)}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeDecisionCandidateSourceLabel(review, t)} / {String(review.selectedScoreProfile ?? '-').toUpperCase()}
            {review.serverCountry ? ` / ${review.serverCountry}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <StatusBadge tone={routeDecisionDispositionTone(review.disposition)}>
            {routeDecisionDispositionLabel(review.disposition, t)}
          </StatusBadge>
          <StatusBadge tone={getWireGuardScoreTone(review.score)}>{format.integer(review.score)}</StatusBadge>
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(review.latencyMs ?? null)} />
        <MetricPill icon={Activity} label={t.settings.jitter} value={format.latency(review.jitterMs ?? null)} />
        <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(review.packetLossPercent ?? null)} />
        <MetricPill icon={Gauge} label={t.settings.loadedLatency} value={formatLoadedLatency(review, format, t)} />
        <MetricPill icon={Network} label={t.settings.mtu} value={formatMtuRecommendation(review, format, t)} />
        <MetricPill icon={ArrowDownUp} label={t.settings.routeDecisionCandidateDelta} value={scoreDelta} />
      </div>

      <div className="flex flex-wrap gap-1">
        {reasonCodes.map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${review.id}-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
        {scoreReasons.map((reason, index) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${review.id}-score-${reason.code}-${index}`}>
            {routeScoreReasonLabel(reason.code, t)} {format.integer(reason.impact)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteDecisionEventList({
  eventDetail,
  events,
  format,
  isDetailLoading,
  onInspectEvent,
  t,
}: {
  eventDetail: AdminRouteDecisionEventDetail | null;
  events: AdminRouteDecisionEventSummary[];
  format: DashboardFormatters;
  isDetailLoading: boolean;
  onInspectEvent: (eventId: string) => void;
  t: DashboardStrings;
}) {
  return (
    <div className="mt-3 border-t border-afro-line pt-2">
      <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.recentDecisionEvents}</div>
      <div className="grid gap-1.5">
        {events.length === 0 ? <EmptyState message={t.settings.noDecisionEvents} /> : null}
        {events.map((event) => {
          const fromName = event.fromOutboundName ?? event.fromOutboundId ?? '-';
          const toName = event.toOutboundName ?? event.toOutboundId ?? '-';
          const isSelected = eventDetail?.id === event.id;

          return (
            <div
              className={`grid gap-1 rounded-md border px-2.5 py-2 ${isSelected ? 'border-afro-teal bg-afro-surface' : 'border-afro-line bg-white'}`}
              key={event.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="min-w-0 truncate text-[13px]">
                  {t.settings.decisionEventRoute(format.label(fromName), format.label(toName))}
                </strong>
                <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <StatusBadge tone={routeDecisionActionToneForState(event.decisionState)}>
                    {routeDecisionStateLabel(event.decisionState, t)}
                  </StatusBadge>
                  <button
                    className="inline-flex min-h-7 items-center justify-center gap-1 rounded-md border border-afro-line bg-white px-2 text-[11px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
                    disabled={isDetailLoading}
                    onClick={() => onInspectEvent(event.id)}
                    type="button"
                  >
                    <Eye size={13} />
                    {isDetailLoading ? t.settings.loadingDecisionEvent : t.settings.inspectDecisionEvent}
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-afro-muted">
                <span>{format.time(new Date(event.createdAt))}</span>
                <span>{event.scoreDelta === null || event.scoreDelta === undefined ? '--' : format.integer(event.scoreDelta)}</span>
                <span>{String(event.scoreProfile ?? '-').toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {event.reasonCodes.slice(0, 4).map((reason) => (
                  <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${event.id}-${reason}`}>
                    {routeDecisionReasonLabel(reason, t)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {eventDetail ? <RouteDecisionEventDetailCard detail={eventDetail} format={format} t={t} /> : null}
    </div>
  );
}

export function RouteDecisionEventDetailCard({
  detail,
  format,
  t,
}: {
  detail: AdminRouteDecisionEventDetail;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const snapshot = detail.dryRunSnapshot ?? null;

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{t.settings.decisionEventContext}</strong>
          <span className={`${mutedTextClass} block truncate`}>{format.time(new Date(detail.createdAt))}</span>
        </div>
        <StatusBadge tone={routeDecisionActionToneForState(detail.decisionState)}>
          {routeDecisionStateLabel(detail.decisionState, t)}
        </StatusBadge>
      </div>

      <RouteDecisionSwitchPreflightCard preflight={detail.switchPreflight} format={format} t={t} />
      <RouteDecisionSwitchRolloutCard
        evaluation={detail.switchRolloutEvaluation}
        rollout={detail.switchRollout}
        format={format}
        t={t}
      />
      <RouteDecisionSwitchOrchestrationCard orchestration={detail.switchOrchestration} format={format} t={t} />
      <RouteDecisionSwitchExecutionCard execution={detail.switchExecution} format={format} t={t} />

      {snapshot ? (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill
              icon={ShieldCheck}
              label={t.settings.dryRunSnapshot}
              value={snapshot.secretSafe ? t.settings.decisionEventSecretSafe : t.settings.decisionEventSecretUnsafe}
            />
            <MetricPill
              icon={Route}
              label={t.settings.routeApplyAdapter}
              value={`${snapshot.adapterId || '-'} / ${routeApplyAdapterStatusLabel(snapshot.adapterStatus, t)}`}
            />
            <MetricPill
              icon={SettingsIcon}
              label={t.settings.routeApplyDryRunCommands}
              value={t.settings.dryRunCommandsCount(format.integer(snapshot.commandCount))}
            />
            <MetricPill
              icon={Network}
              label={t.settings.routeApplyConfigChanges}
              value={t.settings.dryRunConfigChangesCount(format.integer(snapshot.configChangeCount))}
            />
          </div>

          {snapshot.commands.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyDryRunCommands}</strong>
              {snapshot.commands.slice(0, 5).map((item) => (
                <div className="grid gap-1 rounded border border-afro-line px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                      {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                    </StatusBadge>
                    <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                      {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                    </StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.configChanges.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyConfigChanges}</strong>
              {snapshot.configChanges.slice(0, 3).map((item) => (
                <div className="grid gap-0.5 rounded border border-afro-line px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{item.description}</span>
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

export function RouteDecisionMetric({ children, label }: { children: ReactNode; label: string }) {
  const valueTooltip = primitiveTooltip(children);
  const metricTooltip = valueTooltip ? `${label} ${valueTooltip}` : label;

  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2.5" title={metricTooltip}>
      <span className={`${mutedTextClass} min-w-0 truncate`} title={label}>{label}</span>
      <strong className="min-w-0 truncate text-[13px]" title={valueTooltip}>{children}</strong>
    </div>
  );
}

export function RouteDecisionCandidateCard({
  candidate,
  format,
  label,
  t,
}: {
  candidate: AdminRouteDecisionCandidateSummary | null;
  format: DashboardFormatters;
  label: string;
  t: DashboardStrings;
}) {
  if (!candidate) {
    return (
      <div className="rounded-md border border-dashed border-afro-line px-2.5 py-2">
        <div className="text-[12px] font-bold uppercase text-afro-muted">{label}</div>
        <div className="mt-1 text-[13px] font-bold text-afro-muted">{t.settings.routeDecisionNoCandidate}</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-afro-line px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase text-afro-muted">{label}</div>
          <strong className="block truncate text-[13px]">{format.label(candidate.name)}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeDecisionCandidateSourceLabel(candidate, t)} / {String(candidate.selectedScoreProfile ?? '-').toUpperCase()}
            {candidate.serverCountry ? ` / ${candidate.serverCountry}` : ''}
          </span>
        </div>
        <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.integer(candidate.score)}</StatusBadge>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-5">
        <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(candidate.latencyMs ?? null)} />
        <MetricPill icon={Activity} label={t.settings.jitter} value={format.latency(candidate.jitterMs ?? null)} />
        <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(candidate.packetLossPercent ?? null)} />
        <MetricPill icon={Gauge} label={t.settings.loadedLatency} value={formatLoadedLatency(candidate, format, t)} />
        <MetricPill icon={Network} label={t.settings.mtu} value={formatMtuRecommendation(candidate, format, t)} />
      </div>
    </div>
  );
}

export function routeDecisionActionTone(action: RouteDecisionAction): Tone {
  switch (action) {
    case 'switchRecommended':
      return 'warning';
    case 'keepCurrent':
      return 'good';
    case 'cooldownActive':
    case 'noHealthyCandidate':
    case 'noManagedCandidate':
    case 'insufficientCandidates':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function routeDecisionActionToneForState(state: string): Tone {
  switch (state) {
    case 'switchRecommended':
      return 'warning';
    case 'keepCurrent':
      return 'good';
    case 'routeLocked':
    case 'cooldownActive':
    case 'manualMode':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function routeDecisionDispositionTone(disposition: string): Tone {
  switch (disposition) {
    case 'recommended':
    case 'eligible':
      return 'good';
    case 'unhealthy':
      return 'critical';
    case 'cooldownBlocked':
    case 'preferenceMismatch':
    case 'belowHysteresis':
      return 'warning';
    default:
      return 'neutral';
  }
}
