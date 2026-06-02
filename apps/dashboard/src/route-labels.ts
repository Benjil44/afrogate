import type { AdminRouteDecisionCandidateSummary, RouteDecisionAction } from '@afrogate/shared';
import type { Tone } from './dashboard-types';
import type { DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export function routeDecisionDispositionLabel(disposition: string, t: DashboardStrings): string {
  switch (disposition) {
    case 'recommended':
      return t.settings.decisionDispositionRecommended;
    case 'current':
      return t.settings.decisionDispositionCurrent;
    case 'eligible':
      return t.settings.decisionDispositionEligible;
    case 'routeLocked':
      return t.settings.decisionDispositionRouteLocked;
    case 'cooldownBlocked':
      return t.settings.decisionDispositionCooldown;
    case 'manualMode':
      return t.settings.decisionDispositionManual;
    case 'diagnosticOnly':
      return t.settings.decisionDispositionDiagnostic;
    case 'unhealthy':
      return t.settings.decisionDispositionUnhealthy;
    case 'preferenceMismatch':
      return t.settings.decisionDispositionPreferenceMismatch;
    case 'belowHysteresis':
      return t.settings.decisionDispositionBelowHysteresis;
    default:
      return disposition;
  }
}

export function routeApplyPlanStatusTone(status: string): Tone {
  switch (status) {
    case 'assignmentOnlyReady':
    case 'dataPlaneReady':
      return 'good';
    case 'blocked':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function routeApplyPlanStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'assignmentOnlyReady':
      return t.settings.routeApplyPlanAssignmentOnlyReady;
    case 'dataPlaneReady':
      return t.settings.routeApplyPlanDataPlaneReady;
    case 'blocked':
      return t.settings.routeApplyPlanBlocked;
    case 'notRequired':
      return t.settings.routeApplyPlanNotRequired;
    default:
      return status;
  }
}

export function routeApplyAdapterStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'missing':
    case 'unsupported':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function routeApplyAdapterStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.routeApplyAdapterReady;
    case 'disabled':
      return t.settings.routeApplyAdapterDisabled;
    case 'missing':
      return t.settings.routeApplyAdapterMissing;
    case 'unsupported':
      return t.settings.routeApplyAdapterUnsupported;
    default:
      return status;
  }
}

export function routeApplyPlanStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'verify_preview_fresh':
      return t.settings.routeApplyStepVerifyPreview;
    case 'verify_route_lock_clear':
      return t.settings.routeApplyStepVerifyLock;
    case 'verify_cooldown_clear':
      return t.settings.routeApplyStepVerifyCooldown;
    case 'persist_assignment':
      return t.settings.routeApplyStepPersistAssignment;
    case 'set_cooldown':
      return t.settings.routeApplyStepSetCooldown;
    case 'drain_current_route':
      return t.settings.routeApplyStepDrainCurrent;
    case 'switch_data_plane_route':
      return t.settings.routeApplyStepSwitchDataPlane;
    case 'verify_route_health':
      return t.settings.routeApplyStepVerifyHealth;
    case 'restore_previous_route':
      return t.settings.routeApplyStepRestorePrevious;
    default:
      return code;
  }
}

export function routeDecisionActionLabel(action: RouteDecisionAction, t: DashboardStrings): string {
  switch (action) {
    case 'switchRecommended':
      return t.settings.decisionActionSwitch;
    case 'manualMode':
      return t.settings.decisionActionManual;
    case 'routeLocked':
      return t.settings.decisionActionLocked;
    case 'cooldownActive':
      return t.settings.decisionActionCooldown;
    case 'insufficientCandidates':
      return t.settings.decisionActionInsufficient;
    case 'noHealthyCandidate':
      return t.settings.decisionActionNoHealthy;
    case 'noManagedCandidate':
      return t.settings.decisionActionNoManaged;
    default:
      return t.settings.decisionActionKeep;
  }
}

export function routeDecisionStateLabel(state: string, t: DashboardStrings): string {
  switch (state) {
    case 'switchRecommended':
    case 'manualMode':
    case 'routeLocked':
    case 'cooldownActive':
    case 'insufficientCandidates':
    case 'noHealthyCandidate':
    case 'noManagedCandidate':
    case 'keepCurrent':
      return routeDecisionActionLabel(state, t);
    default:
      return state;
  }
}

export function routeClientPreferenceModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'country':
      return t.settings.routeClientPreferenceModeCountry;
    case 'outbound':
      return t.settings.routeClientPreferenceModeOutbound;
    default:
      return t.settings.routeClientPreferenceModeAuto;
  }
}

export function routeDecisionReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'no_candidates':
      return t.settings.decisionReasonNoCandidates;
    case 'no_healthy_candidate':
      return t.settings.decisionReasonNoHealthy;
    case 'agent_candidate_not_applicable':
      return t.settings.decisionReasonAgentOnly;
    case 'route_locked':
      return t.settings.decisionReasonLocked;
    case 'manual_mode':
      return t.settings.decisionReasonManual;
    case 'cooldown_active':
      return t.settings.decisionReasonCooldown;
    case 'no_current_candidate':
      return t.settings.decisionReasonNoCurrent;
    case 'best_candidate_current':
      return t.settings.decisionReasonBestCurrent;
    case 'score_delta_meets_hysteresis':
      return t.settings.decisionReasonDeltaMet;
    case 'score_delta_below_hysteresis':
      return t.settings.decisionReasonDeltaLow;
    case 'auto_route_enabled':
      return t.settings.decisionReasonAutoEnabled;
    case 'has_previous_decision_state':
      return t.settings.decisionReasonPreviousState;
    case 'recommended_candidate':
      return t.settings.decisionReasonRecommendedCandidate;
    case 'current_candidate':
      return t.settings.decisionReasonCurrentCandidate;
    case 'candidate_unhealthy':
      return t.settings.decisionReasonCandidateUnhealthy;
    case 'current_candidate_unhealthy':
      return t.settings.decisionReasonCurrentUnhealthy;
    case 'health_based_switch':
      return t.settings.decisionReasonHealthSwitch;
    case 'score_below_threshold':
      return t.settings.decisionReasonScoreLow;
    case 'assignment_apply_requested':
      return t.settings.decisionReasonApplyRequested;
    case 'assignment_only_apply':
      return t.settings.decisionReasonAssignmentOnly;
    case 'data_plane_not_applied':
      return t.settings.decisionReasonDataPlaneNotApplied;
    case 'apply_requires_switch_recommended':
      return t.settings.decisionReasonApplyRequiresSwitch;
    case 'server_apply_adapter_missing':
      return t.settings.decisionReasonApplyAdapterMissing;
    case 'data_plane_apply_disabled':
      return t.settings.decisionReasonDataPlaneDisabled;
    case 'route_apply_adapter_unsupported':
      return t.settings.decisionReasonApplyAdapterUnsupported;
    case 'dry_run_only':
      return t.settings.decisionReasonDryRunOnly;
    case 'loaded_latency_high':
      return t.settings.decisionReasonLoadedLatency;
    case 'mtu_reduce_recommended':
      return t.settings.decisionReasonMtuReduce;
    case 'mtu_manual_review':
      return t.settings.decisionReasonMtuReview;
    case 'mtu_probe_blocked':
      return t.settings.decisionReasonMtuBlocked;
    case 'client_route_preference':
      return t.settings.decisionReasonClientPreference;
    case 'detected_country_context':
      return t.settings.decisionReasonDetectedCountry;
    case 'client_score_profile_context':
    case 'client_score_profile_applied':
      return t.settings.decisionReasonClientScoreProfile;
    case 'preferred_country_applied':
      return t.settings.decisionReasonPreferredCountryApplied;
    case 'preferred_country_unavailable':
      return t.settings.decisionReasonPreferredCountryUnavailable;
    case 'preferred_country_match':
      return t.settings.decisionReasonPreferredCountryMatch;
    case 'preferred_country_mismatch':
      return t.settings.decisionReasonPreferredCountryMismatch;
    case 'preferred_outbound_applied':
      return t.settings.decisionReasonPreferredOutboundApplied;
    case 'preferred_outbound_unavailable':
      return t.settings.decisionReasonPreferredOutboundUnavailable;
    case 'preferred_outbound_match':
      return t.settings.decisionReasonPreferredOutboundMatch;
    case 'preferred_outbound_mismatch':
      return t.settings.decisionReasonPreferredOutboundMismatch;
    default:
      return reason;
  }
}

export function routeScoreReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'healthStatus':
      return t.settings.decisionScoreReasonHealthStatus;
    case 'latency':
      return t.settings.decisionScoreReasonLatency;
    case 'jitter':
      return t.settings.decisionScoreReasonJitter;
    case 'packetLoss':
      return t.settings.decisionScoreReasonPacketLoss;
    case 'loadedLatency':
      return t.settings.decisionScoreReasonLoadedLatency;
    case 'load':
      return t.settings.decisionScoreReasonLoad;
    case 'serverHealth':
      return t.settings.decisionScoreReasonServerHealth;
    case 'wireguardHandshake':
      return t.settings.decisionScoreReasonHandshake;
    case 'routeProbe':
      return t.settings.decisionScoreReasonRouteProbe;
    case 'mtu':
      return t.settings.decisionScoreReasonMtu;
    case 'maintenance':
      return t.settings.decisionScoreReasonMaintenance;
    default:
      return reason;
  }
}

export function routeScoreProfileLabel(profile: string, t: DashboardStrings): string {
  switch (profile) {
    case 'balanced':
      return t.settings.profileBalanced;
    case 'stability':
      return t.settings.stabilityStrategy;
    case 'throughput':
      return t.settings.throughputStrategy;
    case 'gaming':
      return t.settings.profileGaming;
    case 'tcp':
      return 'TCP';
    case 'udp':
      return 'UDP';
    case 'quic':
      return 'QUIC';
    case 'dns':
      return 'DNS';
    case 'wireguard':
      return 'WireGuard';
    default:
      return profile;
  }
}

export function routeProfileRecommendationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'selectedProfile':
      return t.settings.profileReasonSelected;
    case 'bestProfileScore':
      return t.settings.profileReasonBestScore;
    case 'profileScoreLead':
      return t.settings.profileReasonScoreLead;
    case 'gamingSensitive':
      return t.settings.profileReasonGaming;
    case 'protocolSensitive':
      return t.settings.profileReasonProtocol;
    case 'throughputSensitive':
      return t.settings.profileReasonThroughput;
    case 'stabilitySensitive':
      return t.settings.profileReasonStability;
    default:
      return reason;
  }
}

export function routeLoadBalanceStrategyLabel(strategy: string, t: DashboardStrings): string {
  switch (strategy) {
    case 'balanced':
      return t.settings.balancedStrategy;
    case 'stability':
      return t.settings.stabilityStrategy;
    case 'throughput':
      return t.settings.throughputStrategy;
    default:
      return strategy;
  }
}

export function routeLoadBalancingModeTone(mode: string): Tone {
  switch (mode) {
    case 'weighted':
      return 'good';
    case 'primaryStandby':
    case 'singlePrimary':
      return 'neutral';
    case 'insufficientCandidates':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function routeLoadBalancingModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'singlePrimary':
      return t.settings.loadBalancingSinglePrimary;
    case 'weighted':
      return t.settings.loadBalancingWeighted;
    case 'primaryStandby':
      return t.settings.loadBalancingPrimaryStandby;
    case 'insufficientCandidates':
      return t.settings.loadBalancingInsufficient;
    default:
      return mode;
  }
}

export function routeLoadBalancingRoleLabel(role: string, t: DashboardStrings): string {
  switch (role) {
    case 'primary':
      return t.settings.loadBalancingPrimary;
    case 'secondary':
      return t.settings.loadBalancingSecondary;
    case 'standby':
      return t.settings.loadBalancingStandby;
    default:
      return role;
  }
}

export function routeLoadBalancingRiskTone(risk: string): Tone {
  switch (risk) {
    case 'low':
      return 'good';
    case 'medium':
      return 'warning';
    case 'high':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeLoadBalancingRiskLabel(risk: string, t: DashboardStrings): string {
  switch (risk) {
    case 'low':
      return t.settings.loadBalancingRiskLow;
    case 'medium':
      return t.settings.loadBalancingRiskMedium;
    case 'high':
      return t.settings.loadBalancingRiskHigh;
    default:
      return risk;
  }
}

export function routeLoadBalancingReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'advisoryOnly':
      return t.settings.loadBalancingReasonAdvisory;
    case 'dataPlaneDisabled':
      return t.settings.loadBalancingReasonDataPlaneOff;
    case 'profileWeighted':
      return t.settings.loadBalancingReasonProfile;
    case 'healthWeighted':
      return t.settings.loadBalancingReasonHealth;
    case 'packetLossWeighted':
      return t.settings.loadBalancingReasonPacketLoss;
    case 'jitterWeighted':
      return t.settings.loadBalancingReasonJitter;
    case 'latencyWeighted':
      return t.settings.loadBalancingReasonLatency;
    case 'throughputWeighted':
      return t.settings.loadBalancingReasonThroughput;
    case 'loadWeighted':
      return t.settings.loadBalancingReasonLoad;
    case 'securityProfileWeighted':
      return t.settings.loadBalancingReasonSecurity;
    case 'routeConsistency':
      return t.settings.loadBalancingReasonConsistency;
    case 'scoreCloseToPrimary':
      return t.settings.loadBalancingReasonCloseScore;
    case 'bestCompositeScore':
      return t.settings.loadBalancingReasonBestComposite;
    case 'standbyRoute':
      return t.settings.loadBalancingReasonStandby;
    case 'insufficientEligibleCandidates':
      return t.settings.loadBalancingReasonInsufficient;
    default:
      return reason;
  }
}

export function routeSessionSafetyModeTone(mode: string): Tone {
  switch (mode) {
    case 'safeToSwitch':
    case 'notRequired':
      return 'good';
    case 'stickyHold':
    case 'drainNewSessions':
      return 'warning';
    case 'emergencySwitch':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSessionSafetyModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'notRequired':
      return t.settings.sessionSafetyModeNoChange;
    case 'safeToSwitch':
      return t.settings.sessionSafetyModeSafe;
    case 'stickyHold':
      return t.settings.sessionSafetyModeStickyHold;
    case 'drainNewSessions':
      return t.settings.sessionSafetyModeDrain;
    case 'emergencySwitch':
      return t.settings.sessionSafetyModeEmergency;
    default:
      return mode;
  }
}

export function routeSessionSafetyPolicyLabel(policy: string, t: DashboardStrings): string {
  switch (policy) {
    case 'none':
      return t.settings.sessionSafetyPolicyNone;
    case 'keepExisting':
      return t.settings.sessionSafetyPolicyKeepExisting;
    case 'newSessionsOnly':
      return t.settings.sessionSafetyPolicyNewOnly;
    case 'emergencyReroute':
      return t.settings.sessionSafetyPolicyEmergency;
    default:
      return policy;
  }
}

export function routeSessionSafetyRiskTone(risk: string): Tone {
  switch (risk) {
    case 'low':
      return 'good';
    case 'medium':
      return 'warning';
    case 'high':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSessionSafetyRiskLabel(risk: string, t: DashboardStrings): string {
  switch (risk) {
    case 'low':
      return t.settings.sessionSafetyRiskLow;
    case 'medium':
      return t.settings.sessionSafetyRiskMedium;
    case 'high':
      return t.settings.sessionSafetyRiskHigh;
    default:
      return risk;
  }
}

export function routeSessionSafetyReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'gamingSensitive':
      return t.settings.sessionSafetyReasonGaming;
    case 'udpSessionSensitive':
      return t.settings.sessionSafetyReasonUdp;
    case 'routeConsistency':
      return t.settings.sessionSafetyReasonConsistency;
    case 'publicIpMayChange':
      return t.settings.sessionSafetyReasonPublicIp;
    case 'natStateMayReset':
      return t.settings.sessionSafetyReasonNat;
    case 'stickySessionsRequired':
      return t.settings.sessionSafetyReasonSticky;
    case 'drainExistingSessions':
      return t.settings.sessionSafetyReasonDrain;
    case 'newSessionsOnly':
      return t.settings.sessionSafetyReasonNewOnly;
    case 'emergencyHealthFailure':
      return t.settings.sessionSafetyReasonEmergency;
    case 'manualOrLocked':
      return t.settings.sessionSafetyReasonManualLocked;
    case 'cooldownActive':
      return t.settings.sessionSafetyReasonCooldown;
    case 'noSwitchNeeded':
      return t.settings.sessionSafetyReasonNoSwitch;
    case 'noCurrentRoute':
      return t.settings.sessionSafetyReasonNoCurrent;
    case 'assignmentOnly':
      return t.settings.sessionSafetyReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.sessionSafetyReasonDataPlaneOff;
    case 'scoreDeltaSwitch':
      return t.settings.sessionSafetyReasonScoreDelta;
    default:
      return reason;
  }
}

export function routeSwitchEngineStatusTone(status: string): Tone {
  switch (status) {
    case 'dataPlaneReady':
      return 'good';
    case 'planningOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchEngineStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchEngineStatusNotRequired;
    case 'planningOnly':
      return t.settings.switchEngineStatusPlanning;
    case 'blocked':
      return t.settings.switchEngineStatusBlocked;
    case 'dataPlaneReady':
      return t.settings.switchEngineStatusReady;
    default:
      return status;
  }
}

export function routeSwitchEngineModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'noChange':
      return t.settings.switchEngineModeNoChange;
    case 'assignmentOnly':
      return t.settings.switchEngineModeAssignment;
    case 'stickyDrain':
      return t.settings.switchEngineModeStickyDrain;
    case 'newSessionsOnly':
      return t.settings.switchEngineModeNewOnly;
    case 'emergencyReroute':
      return t.settings.switchEngineModeEmergency;
    default:
      return mode;
  }
}

export function routeSwitchEngineStepStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchEngineStepStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

export function routeSwitchEngineSessionImpactLabel(impact: string, t: DashboardStrings): string {
  switch (impact) {
    case 'none':
      return t.settings.switchEngineImpactNone;
    case 'newSessionsOnly':
      return t.settings.switchEngineImpactNewOnly;
    case 'existingSessions':
      return t.settings.switchEngineImpactExisting;
    case 'allSessions':
      return t.settings.switchEngineImpactAll;
    default:
      return impact;
  }
}

export function routeSwitchEngineStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'verify_switch_guards':
      return t.settings.switchEngineStepVerifyGuards;
    case 'pin_existing_sessions':
      return t.settings.switchEngineStepPinExisting;
    case 'route_new_sessions':
      return t.settings.switchEngineStepRouteNew;
    case 'drain_existing_sessions':
      return t.settings.switchEngineStepDrainExisting;
    case 'switch_active_route':
      return t.settings.switchEngineStepSwitchActive;
    case 'emergency_switch_active_route':
      return t.settings.switchEngineStepEmergencySwitch;
    case 'verify_switched_route':
      return t.settings.switchEngineStepVerifyRoute;
    case 'rollback_previous_route':
      return t.settings.switchEngineStepRollback;
    default:
      return code;
  }
}

export function routeSwitchEngineReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'serverApplyAdapterMissing':
      return t.settings.switchEngineReasonAdapterMissing;
    case 'routeLock':
      return t.settings.switchEngineReasonRouteLock;
    case 'manualMode':
      return t.settings.switchEngineReasonManual;
    case 'cooldownActive':
      return t.settings.switchEngineReasonCooldown;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainSafe':
      return t.settings.switchEngineReasonDrainSafe;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'rollbackPlanned':
      return t.settings.switchEngineReasonRollback;
    case 'noSwitchNeeded':
      return t.settings.switchEngineReasonNoSwitch;
    case 'guardBlocked':
      return t.settings.switchEngineReasonGuardBlocked;
    default:
      return reason;
  }
}

export function routeSwitchPreflightStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'planningOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchPreflightStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchPreflightStatusNotRequired;
    case 'planningOnly':
      return t.settings.switchPreflightStatusPlanning;
    case 'blocked':
      return t.settings.switchPreflightStatusBlocked;
    case 'ready':
      return t.settings.switchPreflightStatusReady;
    default:
      return status;
  }
}

export function routeSwitchPreflightCheckStatusTone(status: string): Tone {
  switch (status) {
    case 'passed':
      return 'good';
    case 'warning':
    case 'future':
      return 'warning';
    case 'failed':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchPreflightCheckStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'passed':
      return t.settings.switchPreflightCheckPassed;
    case 'warning':
      return t.settings.switchPreflightCheckWarning;
    case 'failed':
      return t.settings.switchPreflightCheckFailed;
    case 'future':
      return t.settings.switchPreflightCheckFuture;
    case 'notRequired':
      return t.settings.switchPreflightCheckNotRequired;
    default:
      return status;
  }
}

export function routeSwitchPreflightCheckLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'route_data_plane_feature_flag':
      return t.settings.switchPreflightFeatureFlag;
    case 'server_apply_adapter':
      return t.settings.switchPreflightAdapter;
    case 'secret_safe_dry_run':
      return t.settings.switchPreflightDryRun;
    case 'route_switch_guards':
      return t.settings.switchPreflightGuards;
    case 'session_safety_policy':
      return t.settings.switchPreflightSessionSafety;
    case 'rollback_plan':
      return t.settings.switchPreflightRollback;
    case 'cooldown_policy':
      return t.settings.switchPreflightCooldown;
    case 'decision_audit':
      return t.settings.switchPreflightAudit;
    case 'post_switch_health_verify':
      return t.settings.switchPreflightHealthVerify;
    default:
      return code;
  }
}

export function routeSwitchPreflightReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'featureFlagDisabled':
      return t.settings.switchPreflightReasonFeatureFlag;
    case 'adapterMissing':
      return t.settings.switchPreflightReasonAdapterMissing;
    case 'adapterUnsupported':
      return t.settings.switchPreflightReasonAdapterUnsupported;
    case 'dryRunOnly':
      return t.settings.switchPreflightReasonDryRunOnly;
    case 'guardBlocked':
      return t.settings.switchPreflightReasonGuardBlocked;
    case 'sessionSafetyRequired':
      return t.settings.switchPreflightReasonSessionSafety;
    case 'rollbackPlanned':
      return t.settings.switchPreflightReasonRollback;
    case 'cooldownRequired':
      return t.settings.switchPreflightReasonCooldown;
    case 'auditReady':
      return t.settings.switchPreflightReasonAudit;
    case 'healthVerifyRequired':
      return t.settings.switchPreflightReasonHealthVerify;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

export function routeSwitchRolloutStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
      return 'good';
    case 'planningOnly':
    case 'emergencyOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchRolloutStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchRolloutStatusNotRequired;
    case 'blocked':
      return t.settings.switchRolloutStatusBlocked;
    case 'planningOnly':
      return t.settings.switchRolloutStatusPlanning;
    case 'canaryReady':
      return t.settings.switchRolloutStatusReady;
    case 'emergencyOnly':
      return t.settings.switchRolloutStatusEmergency;
    default:
      return status;
  }
}

export function routeSwitchRolloutStrategyLabel(strategy: string, t: DashboardStrings): string {
  switch (strategy) {
    case 'none':
      return t.settings.switchRolloutStrategyNone;
    case 'assignmentOnly':
      return t.settings.switchRolloutStrategyAssignment;
    case 'newSessionCanary':
      return t.settings.switchRolloutStrategyNewCanary;
    case 'stickyDrainCanary':
      return t.settings.switchRolloutStrategyStickyCanary;
    case 'emergencyReroute':
      return t.settings.switchRolloutStrategyEmergency;
    default:
      return strategy;
  }
}

export function routeSwitchRolloutStepStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchRolloutStepStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

export function routeSwitchRolloutStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'persist_control_plane_assignment':
      return t.settings.switchRolloutStepPersistAssignment;
    case 'pin_existing_sessions_for_rollout':
      return t.settings.switchRolloutStepPinExisting;
    case 'canary_new_sessions':
      return t.settings.switchRolloutStepCanary;
    case 'verify_canary_health':
      return t.settings.switchRolloutStepVerify;
    case 'expand_new_session_rollout':
      return t.settings.switchRolloutStepExpand;
    case 'complete_new_session_rollout':
      return t.settings.switchRolloutStepComplete;
    case 'rollback_on_regression':
      return t.settings.switchRolloutStepRollback;
    default:
      return code;
  }
}

export function routeSwitchRolloutTrafficScopeLabel(scope: string, t: DashboardStrings): string {
  switch (scope) {
    case 'none':
      return t.settings.switchRolloutScopeNone;
    case 'controlPlane':
      return t.settings.switchRolloutScopeControl;
    case 'newSessions':
      return t.settings.switchRolloutScopeNew;
    case 'canary':
      return t.settings.switchRolloutScopeCanary;
    case 'allNewSessions':
      return t.settings.switchRolloutScopeAllNew;
    case 'allSessions':
      return t.settings.switchRolloutScopeAll;
    case 'emergency':
      return t.settings.switchRolloutScopeEmergency;
    default:
      return scope;
  }
}

export function routeSwitchRolloutReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'canaryRequired':
      return t.settings.switchRolloutReasonCanary;
    case 'rollbackGuard':
      return t.settings.switchRolloutReasonRollback;
    case 'healthVerifyRequired':
      return t.settings.switchPreflightReasonHealthVerify;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

export function routeSwitchRolloutEvaluationStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
    case 'expandReady':
      return 'good';
    case 'planningOnly':
    case 'hold':
      return 'warning';
    case 'blocked':
    case 'rollbackRecommended':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchRolloutEvaluationStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchRolloutEvalStatusNotRequired;
    case 'blocked':
      return t.settings.switchRolloutEvalStatusBlocked;
    case 'planningOnly':
      return t.settings.switchRolloutEvalStatusPlanning;
    case 'hold':
      return t.settings.switchRolloutEvalStatusHold;
    case 'canaryReady':
      return t.settings.switchRolloutEvalStatusCanaryReady;
    case 'expandReady':
      return t.settings.switchRolloutEvalStatusExpandReady;
    case 'rollbackRecommended':
      return t.settings.switchRolloutEvalStatusRollback;
    default:
      return status;
  }
}

export function routeSwitchRolloutEvaluationActionLabel(action: string, t: DashboardStrings): string {
  switch (action) {
    case 'none':
      return t.settings.switchRolloutEvalActionNone;
    case 'manualReview':
      return t.settings.switchRolloutEvalActionManual;
    case 'hold':
      return t.settings.switchRolloutEvalActionHold;
    case 'startCanary':
      return t.settings.switchRolloutEvalActionStart;
    case 'expandCanary':
      return t.settings.switchRolloutEvalActionExpand;
    case 'rollback':
      return t.settings.switchRolloutEvalActionRollback;
    default:
      return action;
  }
}

export function routeSwitchRolloutEvaluationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'rolloutBlocked':
      return t.settings.switchRolloutEvalReasonBlocked;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'guardPassed':
      return t.settings.switchRolloutEvalReasonGuardPassed;
    case 'healthUnknown':
      return t.settings.switchRolloutEvalReasonHealthUnknown;
    case 'lossGuardTriggered':
      return t.settings.switchRolloutEvalReasonLoss;
    case 'jitterGuardTriggered':
      return t.settings.switchRolloutEvalReasonJitter;
    case 'latencyGuardTriggered':
      return t.settings.switchRolloutEvalReasonLatency;
    case 'scoreTooLow':
      return t.settings.switchRolloutEvalReasonScore;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'canaryReady':
      return t.settings.switchRolloutEvalReasonCanary;
    case 'expansionReady':
      return t.settings.switchRolloutEvalReasonExpand;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'manualReviewRequired':
      return t.settings.switchRolloutEvalReasonManual;
    default:
      return reason;
  }
}

export function routeSwitchOrchestrationStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
    case 'expandReady':
    case 'dataPlaneReady':
      return 'good';
    case 'assignmentOnly':
    case 'planningOnly':
    case 'holding':
      return 'warning';
    case 'blocked':
    case 'rollbackRecommended':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchOrchestrationStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchOrchestrationStatusNotRequired;
    case 'blocked':
      return t.settings.switchOrchestrationStatusBlocked;
    case 'assignmentOnly':
      return t.settings.switchOrchestrationStatusAssignment;
    case 'planningOnly':
      return t.settings.switchOrchestrationStatusPlanning;
    case 'holding':
      return t.settings.switchOrchestrationStatusHolding;
    case 'canaryReady':
      return t.settings.switchOrchestrationStatusCanary;
    case 'expandReady':
      return t.settings.switchOrchestrationStatusExpand;
    case 'rollbackRecommended':
      return t.settings.switchOrchestrationStatusRollback;
    case 'dataPlaneReady':
      return t.settings.switchOrchestrationStatusDataPlane;
    default:
      return status;
  }
}

export function routeSwitchOrchestrationPhaseLabel(phase: string, t: DashboardStrings): string {
  switch (phase) {
    case 'noChange':
      return t.settings.switchOrchestrationPhaseNoChange;
    case 'guard':
      return t.settings.switchOrchestrationPhaseGuard;
    case 'assignment':
      return t.settings.switchOrchestrationPhaseAssignment;
    case 'pinExisting':
      return t.settings.switchOrchestrationPhasePin;
    case 'canary':
      return t.settings.switchOrchestrationPhaseCanary;
    case 'drain':
      return t.settings.switchOrchestrationPhaseDrain;
    case 'verify':
      return t.settings.switchOrchestrationPhaseVerify;
    case 'expand':
      return t.settings.switchOrchestrationPhaseExpand;
    case 'rollback':
      return t.settings.switchOrchestrationPhaseRollback;
    default:
      return phase;
  }
}

export function routeSwitchOrchestrationActionLabel(action: string, t: DashboardStrings): string {
  switch (action) {
    case 'none':
      return t.settings.switchOrchestrationActionNone;
    case 'recordDecision':
      return t.settings.switchOrchestrationActionRecord;
    case 'hold':
      return t.settings.switchOrchestrationActionHold;
    case 'startCanary':
      return t.settings.switchOrchestrationActionStart;
    case 'expandCanary':
      return t.settings.switchOrchestrationActionExpand;
    case 'rollback':
      return t.settings.switchOrchestrationActionRollback;
    case 'manualReview':
      return t.settings.switchOrchestrationActionManual;
    default:
      return action;
  }
}

export function routeSwitchOrchestrationStageStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
    case 'hold':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function routeSwitchOrchestrationStageStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'hold':
      return t.settings.switchOrchestrationStageHold;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

export function routeSwitchOrchestrationStageLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'guard_route_locks_cooldown_and_health':
      return t.settings.switchOrchestrationStageGuard;
    case 'record_control_plane_assignment':
      return t.settings.switchOrchestrationStageRecord;
    case 'pin_existing_active_sessions':
      return t.settings.switchOrchestrationStagePin;
    case 'canary_new_sessions_only':
      return t.settings.switchOrchestrationStageCanary;
    case 'hold_route_consistency_window':
      return t.settings.switchOrchestrationStageHoldWindow;
    case 'verify_loss_jitter_latency_guards':
      return t.settings.switchOrchestrationStageVerify;
    case 'expand_new_session_rollout':
      return t.settings.switchOrchestrationStageExpand;
    case 'rollback_on_guard_regression':
      return t.settings.switchOrchestrationStageRollback;
    default:
      return code;
  }
}

export function routeSwitchOrchestrationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'routeLock':
      return t.settings.switchEngineReasonRouteLock;
    case 'manualMode':
      return t.settings.switchEngineReasonManual;
    case 'cooldownActive':
      return t.settings.switchEngineReasonCooldown;
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'rolloutBlocked':
      return t.settings.switchRolloutEvalReasonBlocked;
    case 'guardPassed':
      return t.settings.switchRolloutEvalReasonGuardPassed;
    case 'healthUnknown':
      return t.settings.switchRolloutEvalReasonHealthUnknown;
    case 'rollbackGuard':
      return t.settings.switchRolloutReasonRollback;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainSafe':
      return t.settings.switchEngineReasonDrainSafe;
    case 'canaryRequired':
      return t.settings.switchRolloutReasonCanary;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'auditRequired':
      return t.settings.switchOrchestrationReasonAudit;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

export function routeSwitchExecutionStatusTone(status: string): Tone {
  switch (status) {
    case 'dataPlaneApplied':
      return 'good';
    case 'controlPlaneApplied':
    case 'dataPlaneBlocked':
    case 'blocked':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function routeSwitchExecutionStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchExecutionStatusNotRequired;
    case 'blocked':
      return t.settings.switchExecutionStatusBlocked;
    case 'controlPlaneApplied':
      return t.settings.switchExecutionStatusControlPlane;
    case 'dataPlaneBlocked':
      return t.settings.switchExecutionStatusDataPlaneBlocked;
    case 'dataPlaneApplied':
      return t.settings.switchExecutionStatusDataPlaneApplied;
    default:
      return status;
  }
}

export function routeSwitchExecutionPhaseLabel(phase: string, t: DashboardStrings): string {
  switch (phase) {
    case 'noChange':
      return t.settings.switchExecutionPhaseNoChange;
    case 'guarded':
      return t.settings.switchExecutionPhaseGuarded;
    case 'stickyDrainArmed':
      return t.settings.switchExecutionPhaseStickyDrain;
    case 'newSessionsArmed':
      return t.settings.switchExecutionPhaseNewSessions;
    case 'emergencyApplied':
      return t.settings.switchExecutionPhaseEmergency;
    case 'dataPlaneApplied':
      return t.settings.switchExecutionPhaseDataPlane;
    default:
      return phase;
  }
}

export function routeSwitchExecutionReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'assignmentApplied':
      return t.settings.switchExecutionReasonAssignmentApplied;
    case 'dataPlaneNotApplied':
      return t.settings.switchExecutionReasonDataPlaneNotApplied;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'serverApplyAdapterMissing':
      return t.settings.switchEngineReasonAdapterMissing;
    case 'stickySessionsPreserved':
      return t.settings.switchExecutionReasonStickyPreserved;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainWindowArmed':
      return t.settings.switchExecutionReasonDrainArmed;
    case 'cooldownArmed':
      return t.settings.switchExecutionReasonCooldownArmed;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'rollbackReady':
      return t.settings.switchEngineReasonRollback;
    default:
      return reason;
  }
}

export function formatLoadedLatency(
  candidate: Pick<AdminRouteDecisionCandidateSummary, 'loadedLatencyDeltaMs' | 'loadedLatencyMs' | 'bufferbloatRecommendation' | 'bufferbloatSeverity'>,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (candidate.loadedLatencyDeltaMs !== null && candidate.loadedLatencyDeltaMs !== undefined) {
    return `+${format.latency(candidate.loadedLatencyDeltaMs)}`;
  }
  if (candidate.loadedLatencyMs !== null && candidate.loadedLatencyMs !== undefined) {
    return format.latency(candidate.loadedLatencyMs);
  }
  if (candidate.bufferbloatRecommendation && candidate.bufferbloatRecommendation !== 'none') {
    return routeBufferbloatRecommendationLabel(candidate.bufferbloatRecommendation, t);
  }

  return routeBufferbloatSeverityLabel(candidate.bufferbloatSeverity ?? 'unknown', t);
}

export function formatMtuRecommendation(
  candidate: Pick<
    AdminRouteDecisionCandidateSummary,
    'configuredMtuBytes' | 'mtuRecommendation' | 'mtuStatus' | 'recommendedTunnelMtuBytes'
  >,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const recommended = candidate.recommendedTunnelMtuBytes;
  const configured = candidate.configuredMtuBytes;

  if (candidate.mtuRecommendation === 'reduce' && typeof recommended === 'number') {
    return t.settings.mtuReduceTo(format.integer(recommended));
  }
  if (candidate.mtuRecommendation === 'manualReview') return t.settings.mtuManualReview;
  if (candidate.mtuRecommendation === 'keep') {
    if (typeof configured === 'number') return format.integer(configured);
    if (typeof recommended === 'number') return t.settings.mtuSafe(format.integer(recommended));
    return t.settings.mtuKeep;
  }
  if (candidate.mtuStatus === 'blocked') return t.settings.mtuBlocked;
  if (candidate.mtuStatus === 'fragmentationRisk' && typeof recommended === 'number') {
    return t.settings.mtuSafe(format.integer(recommended));
  }

  return t.settings.mtuUnknown;
}

export function routeBufferbloatSeverityLabel(severity: string, t: DashboardStrings): string {
  switch (severity) {
    case 'none':
      return t.settings.bufferbloatNone;
    case 'low':
      return t.settings.bufferbloatLow;
    case 'medium':
      return t.settings.bufferbloatMedium;
    case 'high':
      return t.settings.bufferbloatHigh;
    default:
      return t.settings.bufferbloatUnknown;
  }
}

export function routeBufferbloatRecommendationLabel(recommendation: string, t: DashboardStrings): string {
  switch (recommendation) {
    case 'watch':
      return t.settings.bufferbloatRecommendationWatch;
    case 'sqmRecommended':
      return t.settings.bufferbloatRecommendationSqm;
    case 'avoidUnderLoad':
      return t.settings.bufferbloatRecommendationAvoid;
    default:
      return t.settings.bufferbloatRecommendationNone;
  }
}

export function routeDecisionCandidateSourceLabel(candidate: AdminRouteDecisionCandidateSummary, t: DashboardStrings): string {
  if (candidate.source === 'agent') return t.settings.agentTelemetry;
  if (candidate.source === 'outbound') return t.settings.outboundHealth;

  return t.settings.localSample;
}

export function telegramSecretSourceLabel(source: string, t: DashboardStrings): string {
  switch (source) {
    case 'database':
      return t.settings.sourceDatabase;
    case 'environment':
      return t.settings.sourceEnvironment;
    default:
      return t.settings.sourceNone;
  }
}

export function telegramTestStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ok':
      return t.settings.telegramTestOk;
    case 'failed':
      return t.settings.telegramTestFailed;
    case 'missingToken':
      return t.settings.telegramTestMissingToken;
    default:
      return t.settings.telegramTestNotTested;
  }
}

export function parseTelegramChatIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
