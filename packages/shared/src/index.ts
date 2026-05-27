export type HealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type Role = 'superadmin' | 'owner' | 'admin' | 'supervisor' | 'support' | 'auditor' | 'agent';

export const ROLE_PERMISSIONS = {
  superadmin: ['*'],
  owner: ['*'],
  admin: ['servers:write', 'routes:write', 'users:write', 'alerts:write'],
  supervisor: ['servers:read', 'routes:read', 'users:read', 'alerts:read'],
  support: ['users:read', 'users:support', 'alerts:read'],
  auditor: ['audit:read', 'reports:read'],
  agent: ['metrics:write'],
} as const;

export interface ServerMetricSnapshot {
  serverId: string;
  hostname?: string;
  platform?: string;
  observedAt: string;
  cpuPercent?: number | null;
  ramPercent?: number | null;
  diskFreePercent?: number | null;
  storages?: StorageVolumeMetric[];
  networkInterfaces?: NetworkInterfaceMetric[];
  wireGuardInterfaces?: WireGuardInterfaceMetric[];
  routeProbes?: RouteProbeMetric[];
  inboundBps?: number | null;
  outboundBps?: number | null;
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface StorageVolumeMetric {
  path: string;
  device?: string | null;
  filesystem?: string | null;
  totalBytes?: number | null;
  freeBytes?: number | null;
  usedPercent?: number | null;
  freePercent?: number | null;
}

export interface NetworkInterfaceMetric {
  name: string;
  rxBytes?: number | null;
  txBytes?: number | null;
  rxBps?: number | null;
  txBps?: number | null;
}

export type WireGuardPeerStatus = 'active' | 'stale' | 'never' | 'unknown';
export type WireGuardInterfaceStatus = 'up' | 'degraded' | 'down' | 'unknown';

export interface WireGuardPeerMetric {
  publicKeyHash: string;
  latestHandshakeAt?: string | null;
  latestHandshakeAgeSeconds?: number | null;
  rxBytes?: number | null;
  txBytes?: number | null;
  rxBps?: number | null;
  txBps?: number | null;
  persistentKeepaliveSeconds?: number | null;
  status: WireGuardPeerStatus | string;
}

export interface WireGuardInterfaceMetric {
  name: string;
  listenPort?: number | null;
  peerCount: number;
  activePeerCount: number;
  latestHandshakeAt?: string | null;
  latestHandshakeAgeSeconds?: number | null;
  rxBytes?: number | null;
  txBytes?: number | null;
  rxBps?: number | null;
  txBps?: number | null;
  status: WireGuardInterfaceStatus | string;
  peers?: WireGuardPeerMetric[];
}

export type RouteProbeProtocol = 'tcp' | 'udp' | 'quic' | 'dns' | 'wireguard';
export type RouteProbeStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface RouteProbeMetric {
  protocol: RouteProbeProtocol | string;
  target: string;
  mode?: string | null;
  routeGroup?: string | null;
  outboundId?: string | null;
  outboundKey?: string | null;
  outboundName?: string | null;
  operator?: string | null;
  scoreProfile?: RouteScoreProfile | string | null;
  status: RouteProbeStatus | string;
  latencyMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  loadedLatencyMs?: number | null;
  loadedLatencyDeltaMs?: number | null;
  checkedAt?: string | null;
}

export interface LatestMetricsResponse {
  servers: ServerMetricSnapshot[];
}

export type MetricsTimeRange = '15m' | '1h' | '6h' | '24h';

export interface MetricTimeseriesPoint {
  observedAt: string;
  cpuPercent?: number | null;
  ramPercent?: number | null;
  diskFreePercent?: number | null;
  inboundBps?: number | null;
  outboundBps?: number | null;
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface ServerMetricTimeseries {
  serverId: string;
  hostname?: string;
  platform?: string;
  points: MetricTimeseriesPoint[];
}

export interface MetricsTimeseriesResponse {
  range: MetricsTimeRange;
  bucketSeconds: number;
  series: ServerMetricTimeseries[];
}

export interface ApiEnvelope<T> {
  data: T;
  timestamp: string;
}

export interface AdminSessionResponse {
  actor: {
    id: string;
    username?: string;
    role: Role;
    type: 'admin';
    isSuperAdmin?: boolean;
  };
  mfaReady: boolean;
  mfaRequired: boolean;
  issuedAt: string;
  expiresAt: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse extends AdminSessionResponse {
  sessionToken: string;
}

export type AdminUserStatus = 'active' | 'disabled';
export type AdminUserSource = 'bootstrap' | 'env' | 'local';

export interface AdminUserSummary {
  id: string;
  username: string;
  role: Role;
  status: AdminUserStatus;
  source: AdminUserSource;
  isSuperAdmin: boolean;
  canDelete: boolean;
  canDisable: boolean;
  canChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
}

export interface CreateAdminUserRequest {
  username: string;
  password: string;
  role: Role;
  status?: AdminUserStatus;
}

export interface UpdateAdminUserRequest {
  role?: Role;
  status?: AdminUserStatus;
}

export interface UpdateAdminUserPasswordRequest {
  password: string;
}

export interface RegisterAgentRequest {
  serverExternalId: string;
  hostname?: string | null;
  platform?: string | null;
  country?: string | null;
  region?: string | null;
  role?: string | null;
  tags?: string[];
  tokenName?: string;
  revokeExistingTokens?: boolean;
}

export interface AgentRegistrationResponse {
  server: {
    id: string;
    externalId: string;
    hostname?: string | null;
    platform?: string | null;
    status: string;
  };
  token: {
    id: string;
    name: string;
    token: string;
    scopes: string[];
    createdAt: string;
  };
}

export interface AgentHeartbeatRequest {
  serverId?: string;
  hostname?: string | null;
  platform?: string | null;
  status?: HealthState | string;
}

export interface AgentHeartbeatResponse {
  serverId: string;
  status: string;
  receivedAt: string;
}

export type ServerAccessMethod = 'ssh_key' | 'temporary_root_password' | 'temporary_root_key' | 'existing_admin_key';

export type ServerBootstrapState = 'not_started' | 'pending' | 'installed' | 'failed' | 'revoked';

export interface ServerAccessProfileSummary {
  id: string;
  address: string;
  sshPort: number;
  username: string;
  accessMethod: ServerAccessMethod | string;
  bootstrapState: ServerBootstrapState | string;
  hasCredentialRef: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminServerSummary {
  id: string;
  externalId: string;
  hostname?: string | null;
  platform?: string | null;
  country?: string | null;
  region?: string | null;
  role?: string | null;
  tags: string[];
  status: HealthState | string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  latestMetric?: ServerMetricSnapshot;
  accessProfile?: ServerAccessProfileSummary;
  outboundCount: number;
  openAlertCount: number;
}

export interface AdminServerDetail extends AdminServerSummary {
  outbounds: AdminOutboundSummary[];
}

export type OutboundType =
  | 'wireguard'
  | 'vless-local-proxy'
  | 'l2tp'
  | 'ikev2'
  | 'http-proxy'
  | 'socks-proxy'
  | 'direct'
  | 'custom';

export type OutboundHealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface AdminOutboundSummary {
  id: string;
  serverId?: string | null;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  name: string;
  type: OutboundType | string;
  routeGroup: string;
  priority: number;
  enabled: boolean;
  maintenanceMode: boolean;
  config: Record<string, unknown>;
  hasSecretRef: boolean;
  healthStatus: OutboundHealthStatus | string;
  healthIntervalSeconds: number;
  failThreshold: number;
  recoveryThreshold: number;
  cooldownSeconds: number;
  weight: number;
  maxUsers?: number | null;
  lastCheckedAt?: string | null;
  lastHealthyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouteFailoverEventSummary {
  id: string;
  routeGroup: string;
  fromOutboundId?: string | null;
  toOutboundId?: string | null;
  reason: string;
  triggerMetric: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAlertSummary {
  id: string;
  severity: string;
  status: string;
  sourceType: string;
  sourceId: string;
  sourceLabel?: string | null;
  title: string;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string | null;
}

export type ProtocolKind = 'wireguard' | 'vless' | 'l2tp' | 'ikev2';
export type ProtocolProfile = 'balanced' | 'highSpeed' | 'highSecurity' | 'gaming';
export type RouteProtocolProfile =
  | ProtocolProfile
  | 'tcp'
  | 'udp'
  | 'quic'
  | 'dns'
  | 'wireguard';
export type RouteSelectionMode = 'automatic' | 'manual';
export type LoadBalanceStrategy = 'balanced' | 'stability' | 'throughput';
export type RouteScoreProfile =
  | 'balanced'
  | 'stability'
  | 'throughput'
  | 'gaming'
  | 'tcp'
  | 'udp'
  | 'quic'
  | 'dns'
  | 'wireguard';
export type SettingsSecretKind =
  | 'wireguardPrivateKey'
  | 'wireguardPresharedKey'
  | 'protocolCredential'
  | 'serverCredential';

export interface AdminSecretRefSummary {
  secretRef: string;
  name: string;
  kind: SettingsSecretKind | string;
  routeGroup?: string | null;
  protocol?: ProtocolKind | string | null;
  fingerprint?: string | null;
  status: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  lastRotatedAt?: string | null;
}

export interface CreateSettingsSecretRequest {
  name: string;
  kind: SettingsSecretKind;
  secret: string;
  routeGroup?: string;
  protocol?: ProtocolKind;
}

export interface AdminProtocolSetupSummary {
  id: string;
  name: string;
  protocol: ProtocolKind | string;
  profile: ProtocolProfile | string;
  routeGroup: string;
  port: number;
  status: string;
  config: Record<string, unknown>;
  hasSecretRef: boolean;
  provisionedOutboundId?: string | null;
  provisionedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProtocolSetupRequest {
  name: string;
  protocol: ProtocolKind;
  profile: ProtocolProfile;
  routeGroup?: string;
  port: number;
  config?: Record<string, unknown>;
  secretRef?: string | null;
}

export interface AdminRouteSettingsSummary {
  routeGroup: string;
  mode: RouteSelectionMode | string;
  selectedOutboundId?: string | null;
  selectedOutboundName?: string | null;
  loadBalanceStrategy: LoadBalanceStrategy | string;
  protocolProfile: RouteProtocolProfile | string;
  speedProfile: ProtocolProfile | string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface UpsertRouteSettingsRequest {
  routeGroup?: string;
  mode: RouteSelectionMode;
  selectedOutboundId?: string | null;
  loadBalanceStrategy: LoadBalanceStrategy;
  protocolProfile?: RouteProtocolProfile;
  speedProfile?: ProtocolProfile;
}

export interface AdminRouteAssignmentSummary {
  routeGroup: string;
  assignmentKey: string;
  assignmentLabel?: string | null;
  currentOutboundId?: string | null;
  currentOutboundName?: string | null;
  lockedOutboundId?: string | null;
  lockedOutboundName?: string | null;
  autoRouteEnabled: boolean;
  routeLocked: boolean;
  protocolProfile: RouteProtocolProfile | string;
  speedProfile: ProtocolProfile | string;
  hysteresisScoreDelta: number;
  cooldownSeconds: number;
  cooldownUntil?: string | null;
  lastDecisionAt?: string | null;
  decisionState: string;
  updatedAt?: string | null;
}

export interface UpsertRouteAssignmentRequest {
  routeGroup?: string;
  assignmentKey?: string;
  assignmentLabel?: string | null;
  currentOutboundId?: string | null;
  lockedOutboundId?: string | null;
  autoRouteEnabled?: boolean;
  routeLocked?: boolean;
  protocolProfile?: RouteProtocolProfile;
  speedProfile?: ProtocolProfile;
  hysteresisScoreDelta?: number;
  cooldownSeconds?: number;
}

export interface RouteProfileScores {
  balanced: number;
  stability: number;
  throughput: number;
  gaming: number;
  tcp: number;
  udp: number;
  quic: number;
  dns: number;
  wireguard: number;
}

export type RouteScoreReasonCode =
  | 'healthStatus'
  | 'latency'
  | 'jitter'
  | 'packetLoss'
  | 'loadedLatency'
  | 'load'
  | 'serverHealth'
  | 'wireguardHandshake'
  | 'routeProbe'
  | 'maintenance';

export interface RouteScoreReason {
  code: RouteScoreReasonCode | string;
  profile?: RouteScoreProfile | string;
  impact: number;
  value?: number | null;
  threshold?: number | null;
  source?: string | null;
}

export type RouteQualityRecommendationKind =
  | 'bestWindow'
  | 'degradedWindow'
  | 'upcomingDegradedWindow'
  | 'insufficientData';
export type RouteQualityConfidence = 'low' | 'medium' | 'high';

export interface RouteQualityWindowSummary {
  routeGroup: string;
  serverExternalId: string;
  serverHostname?: string | null;
  outboundId?: string | null;
  outboundKey?: string | null;
  outboundName?: string | null;
  operator?: string | null;
  protocol: RouteProbeProtocol | string;
  scoreProfile?: RouteScoreProfile | string | null;
  hourOfDay: number;
  dayOfWeek?: number | null;
  sampleCount: number;
  averageScore: number;
  averageLatencyMs?: number | null;
  averageJitterMs?: number | null;
  averagePacketLossPercent?: number | null;
  degradedSamplePercent: number;
  criticalSamplePercent: number;
}

export interface RouteQualityRecommendation {
  kind: RouteQualityRecommendationKind;
  routeGroup: string;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  outboundId?: string | null;
  outboundKey?: string | null;
  outboundName?: string | null;
  operator?: string | null;
  protocol?: RouteProbeProtocol | string | null;
  scoreProfile?: RouteScoreProfile | string | null;
  hourOfDay?: number | null;
  dayOfWeek?: number | null;
  nextWindowAt?: string | null;
  startsInMinutes?: number | null;
  averageScore?: number | null;
  sampleCount: number;
  confidence: RouteQualityConfidence;
  reason: string;
}

export interface AdminWireGuardCandidate {
  id: string;
  name: string;
  endpoint?: string | null;
  routeGroup: string;
  healthStatus: OutboundHealthStatus | string;
  score: number;
  selectedScoreProfile?: RouteScoreProfile | string;
  profileScores?: RouteProfileScores;
  scoreReasons?: RouteScoreReason[];
  latencyMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  loadedLatencyMs?: number | null;
  loadedLatencyDeltaMs?: number | null;
  bufferbloatSeverity?: RouteBufferbloatSeverity | string | null;
  bufferbloatRecommendation?: RouteBufferbloatRecommendation | string | null;
  loadPercent?: number | null;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  interfaceName?: string | null;
  peerCount?: number | null;
  activePeerCount?: number | null;
  latestHandshakeAgeSeconds?: number | null;
  rxBps?: number | null;
  txBps?: number | null;
  checkedAt?: string | null;
  source: 'outbound' | 'agent';
}

export type RouteBufferbloatSeverity = 'none' | 'low' | 'medium' | 'high' | 'unknown';
export type RouteBufferbloatRecommendation = 'none' | 'watch' | 'sqmRecommended' | 'avoidUnderLoad';

export interface AdminSettingsResponse {
  routeSettings: AdminRouteSettingsSummary;
  protocolSetups: AdminProtocolSetupSummary[];
  wireGuardCandidates: AdminWireGuardCandidate[];
}

export interface AdminRouteQualityAnalyticsResponse {
  routeGroup: string;
  rangeHours: number;
  generatedAt: string;
  minimumSamples: number;
  windows: RouteQualityWindowSummary[];
  recommendations: RouteQualityRecommendation[];
}

export type RouteDecisionAction =
  | 'keepCurrent'
  | 'switchRecommended'
  | 'manualMode'
  | 'routeLocked'
  | 'cooldownActive'
  | 'insufficientCandidates'
  | 'noHealthyCandidate'
  | 'noManagedCandidate';

export interface AdminRouteDecisionCandidateSummary {
  id: string;
  name: string;
  routeGroup: string;
  source: 'outbound' | 'agent';
  healthStatus: OutboundHealthStatus | string;
  score: number;
  selectedScoreProfile?: RouteScoreProfile | string;
  latencyMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  loadedLatencyMs?: number | null;
  loadedLatencyDeltaMs?: number | null;
  bufferbloatSeverity?: RouteBufferbloatSeverity | string | null;
  bufferbloatRecommendation?: RouteBufferbloatRecommendation | string | null;
  loadPercent?: number | null;
}

export type RouteDecisionCandidateDisposition =
  | 'recommended'
  | 'current'
  | 'eligible'
  | 'routeLocked'
  | 'cooldownBlocked'
  | 'manualMode'
  | 'diagnosticOnly'
  | 'unhealthy'
  | 'belowHysteresis';

export interface AdminRouteDecisionCandidateReviewSummary extends AdminRouteDecisionCandidateSummary {
  disposition: RouteDecisionCandidateDisposition | string;
  scoreDeltaFromCurrent?: number | null;
  reviewReasonCodes: string[];
  scoreReasons?: RouteScoreReason[];
}

export type RouteDecisionProfileRecommendationReason =
  | 'selectedProfile'
  | 'bestProfileScore'
  | 'profileScoreLead'
  | 'gamingSensitive'
  | 'protocolSensitive'
  | 'throughputSensitive'
  | 'stabilitySensitive';

export interface AdminRouteDecisionProfileRecommendation {
  profile: RouteScoreProfile | string;
  recommendedCandidateId?: string | null;
  recommendedCandidateName?: string | null;
  score: number;
  scoreDeltaFromSelected: number;
  candidateCount: number;
  reasonCodes: Array<RouteDecisionProfileRecommendationReason | string>;
}

export type RouteDecisionLoadBalancingMode =
  | 'singlePrimary'
  | 'weighted'
  | 'primaryStandby'
  | 'insufficientCandidates';

export type RouteDecisionLoadBalancingRole = 'primary' | 'secondary' | 'standby';
export type RouteDecisionLoadBalancingRisk = 'low' | 'medium' | 'high';

export type RouteDecisionLoadBalancingReason =
  | 'advisoryOnly'
  | 'dataPlaneDisabled'
  | 'profileWeighted'
  | 'healthWeighted'
  | 'packetLossWeighted'
  | 'jitterWeighted'
  | 'latencyWeighted'
  | 'throughputWeighted'
  | 'loadWeighted'
  | 'securityProfileWeighted'
  | 'routeConsistency'
  | 'scoreCloseToPrimary'
  | 'bestCompositeScore'
  | 'standbyRoute'
  | 'insufficientEligibleCandidates';

export interface AdminRouteDecisionLoadBalancingCandidate {
  id: string;
  name: string;
  role: RouteDecisionLoadBalancingRole | string;
  weightPercent: number;
  score: number;
  profileScore: number;
  adjustedScore: number;
  riskLevel: RouteDecisionLoadBalancingRisk | string;
  reasonCodes: Array<RouteDecisionLoadBalancingReason | string>;
}

export interface AdminRouteDecisionLoadBalancingSummary {
  mode: RouteDecisionLoadBalancingMode | string;
  strategy: LoadBalanceStrategy | string;
  selectedProfile?: RouteScoreProfile | string;
  primaryCandidateId?: string | null;
  primaryCandidateName?: string | null;
  secondaryCandidateId?: string | null;
  secondaryCandidateName?: string | null;
  candidateCount: number;
  eligibleCandidateCount: number;
  totalAssignedWeightPercent: number;
  reasonCodes: Array<RouteDecisionLoadBalancingReason | string>;
  candidates: AdminRouteDecisionLoadBalancingCandidate[];
}

export type RouteDecisionSessionSafetyMode =
  | 'notRequired'
  | 'safeToSwitch'
  | 'stickyHold'
  | 'drainNewSessions'
  | 'emergencySwitch';

export type RouteDecisionSessionSafetyPolicy =
  | 'none'
  | 'keepExisting'
  | 'newSessionsOnly'
  | 'emergencyReroute';

export type RouteDecisionSessionSafetyRisk = 'low' | 'medium' | 'high';

export type RouteDecisionSessionSafetyReason =
  | 'gamingSensitive'
  | 'udpSessionSensitive'
  | 'routeConsistency'
  | 'publicIpMayChange'
  | 'natStateMayReset'
  | 'stickySessionsRequired'
  | 'drainExistingSessions'
  | 'newSessionsOnly'
  | 'emergencyHealthFailure'
  | 'manualOrLocked'
  | 'cooldownActive'
  | 'noSwitchNeeded'
  | 'noCurrentRoute'
  | 'assignmentOnly'
  | 'dataPlaneDisabled'
  | 'scoreDeltaSwitch';

export interface AdminRouteDecisionSessionSafetySummary {
  mode: RouteDecisionSessionSafetyMode | string;
  policy: RouteDecisionSessionSafetyPolicy | string;
  riskLevel: RouteDecisionSessionSafetyRisk | string;
  selectedProfile?: RouteScoreProfile | string;
  stickySessionTtlSeconds: number;
  estimatedDrainSeconds: number;
  drainExistingSessions: boolean;
  switchNewSessionsOnly: boolean;
  emergencySwitchAllowed: boolean;
  reasonCodes: Array<RouteDecisionSessionSafetyReason | string>;
}

export type RouteDecisionSwitchEngineStatus =
  | 'notRequired'
  | 'planningOnly'
  | 'blocked'
  | 'dataPlaneReady';

export type RouteDecisionSwitchEngineMode =
  | 'noChange'
  | 'assignmentOnly'
  | 'stickyDrain'
  | 'newSessionsOnly'
  | 'emergencyReroute';

export type RouteDecisionSwitchEngineStepKind =
  | 'guard'
  | 'sessionPin'
  | 'newSessionRoute'
  | 'drain'
  | 'switch'
  | 'verify'
  | 'rollback';

export type RouteDecisionSwitchEngineStepStatus =
  | 'ready'
  | 'future'
  | 'blocked'
  | 'notRequired';

export type RouteDecisionSwitchEngineSessionImpact =
  | 'none'
  | 'newSessionsOnly'
  | 'existingSessions'
  | 'allSessions';

export type RouteDecisionSwitchEngineReason =
  | 'assignmentOnly'
  | 'dataPlaneDisabled'
  | 'serverApplyAdapterMissing'
  | 'routeLock'
  | 'manualMode'
  | 'cooldownActive'
  | 'stickySessions'
  | 'newSessionsOnly'
  | 'drainSafe'
  | 'emergencySwitch'
  | 'rollbackPlanned'
  | 'noSwitchNeeded'
  | 'guardBlocked';

export interface AdminRouteDecisionSwitchEngineStep {
  id: string;
  kind: RouteDecisionSwitchEngineStepKind | string;
  code: string;
  status: RouteDecisionSwitchEngineStepStatus | string;
  sessionImpact: RouteDecisionSwitchEngineSessionImpact | string;
  targetOutboundId?: string | null;
  dataPlaneMutation: boolean;
  estimatedSeconds?: number | null;
  reasonCodes: Array<RouteDecisionSwitchEngineReason | string>;
}

export interface AdminRouteDecisionSwitchEngineSummary {
  status: RouteDecisionSwitchEngineStatus | string;
  mode: RouteDecisionSwitchEngineMode | string;
  dataPlaneReady: boolean;
  preserveExistingSessions: boolean;
  switchNewSessionsOnly: boolean;
  drainRequired: boolean;
  rollbackReady: boolean;
  estimatedTotalSeconds: number;
  reasonCodes: Array<RouteDecisionSwitchEngineReason | string>;
  steps: AdminRouteDecisionSwitchEngineStep[];
}

export type RouteDecisionSwitchExecutionStatus =
  | 'notRequired'
  | 'blocked'
  | 'controlPlaneApplied'
  | 'dataPlaneBlocked'
  | 'dataPlaneApplied';

export type RouteDecisionSwitchExecutionPhase =
  | 'noChange'
  | 'guarded'
  | 'stickyDrainArmed'
  | 'newSessionsArmed'
  | 'emergencyApplied'
  | 'dataPlaneApplied';

export type RouteDecisionSwitchExecutionReason =
  | 'assignmentOnly'
  | 'assignmentApplied'
  | 'dataPlaneNotApplied'
  | 'dataPlaneDisabled'
  | 'serverApplyAdapterMissing'
  | 'stickySessionsPreserved'
  | 'newSessionsOnly'
  | 'drainWindowArmed'
  | 'cooldownArmed'
  | 'emergencySwitch'
  | 'rollbackReady';

export interface AdminRouteDecisionSwitchExecutionSummary {
  status: RouteDecisionSwitchExecutionStatus | string;
  phase: RouteDecisionSwitchExecutionPhase | string;
  generatedAt: string;
  appliedAt?: string | null;
  fromOutboundId?: string | null;
  toOutboundId?: string | null;
  assignmentApplied: boolean;
  dataPlaneApplied: boolean;
  dataPlaneReady: boolean;
  preserveExistingSessions: boolean;
  switchNewSessionsOnly: boolean;
  drainRequired: boolean;
  emergencySwitch: boolean;
  stickyUntil?: string | null;
  drainUntil?: string | null;
  cooldownUntil?: string | null;
  rollbackReady: boolean;
  executedStepIds: string[];
  futureStepIds: string[];
  reasonCodes: Array<RouteDecisionSwitchExecutionReason | string>;
}

export type RouteDecisionSwitchPreflightStatus =
  | 'notRequired'
  | 'blocked'
  | 'ready'
  | 'planningOnly';

export type RouteDecisionSwitchPreflightCheckStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'future'
  | 'notRequired';

export type RouteDecisionSwitchPreflightCheckKind =
  | 'featureFlag'
  | 'adapter'
  | 'dryRun'
  | 'guards'
  | 'sessionSafety'
  | 'rollback'
  | 'cooldown'
  | 'audit'
  | 'healthVerify';

export type RouteDecisionSwitchPreflightReason =
  | 'noSwitchNeeded'
  | 'featureFlagDisabled'
  | 'adapterMissing'
  | 'adapterUnsupported'
  | 'dryRunOnly'
  | 'guardBlocked'
  | 'sessionSafetyRequired'
  | 'rollbackPlanned'
  | 'cooldownRequired'
  | 'auditReady'
  | 'healthVerifyRequired'
  | 'dataPlaneReady';

export interface AdminRouteDecisionSwitchPreflightCheck {
  id: string;
  kind: RouteDecisionSwitchPreflightCheckKind | string;
  code: string;
  status: RouteDecisionSwitchPreflightCheckStatus | string;
  dataPlaneMutation: boolean;
  estimatedSeconds?: number | null;
  reasonCodes: Array<RouteDecisionSwitchPreflightReason | string>;
}

export interface AdminRouteDecisionSwitchPreflightSummary {
  status: RouteDecisionSwitchPreflightStatus | string;
  dataPlaneReady: boolean;
  canExecuteDataPlane: boolean;
  safeToArm: boolean;
  checkCount: number;
  failedCheckCount: number;
  futureCheckCount: number;
  reasonCodes: Array<RouteDecisionSwitchPreflightReason | string>;
  checks: AdminRouteDecisionSwitchPreflightCheck[];
}

export type RouteDecisionSwitchRolloutStatus =
  | 'notRequired'
  | 'blocked'
  | 'planningOnly'
  | 'canaryReady'
  | 'emergencyOnly';

export type RouteDecisionSwitchRolloutStrategy =
  | 'none'
  | 'assignmentOnly'
  | 'newSessionCanary'
  | 'stickyDrainCanary'
  | 'emergencyReroute';

export type RouteDecisionSwitchRolloutStepStatus =
  | 'ready'
  | 'future'
  | 'blocked'
  | 'notRequired';

export type RouteDecisionSwitchRolloutStepPhase =
  | 'assignment'
  | 'pinExisting'
  | 'canary'
  | 'verify'
  | 'expand'
  | 'full'
  | 'rollback';

export type RouteDecisionSwitchRolloutTrafficScope =
  | 'none'
  | 'controlPlane'
  | 'newSessions'
  | 'canary'
  | 'allNewSessions'
  | 'allSessions'
  | 'emergency';

export type RouteDecisionSwitchRolloutReason =
  | 'noSwitchNeeded'
  | 'assignmentOnly'
  | 'dataPlaneDisabled'
  | 'preflightBlocked'
  | 'stickySessions'
  | 'newSessionsOnly'
  | 'emergencySwitch'
  | 'canaryRequired'
  | 'rollbackGuard'
  | 'healthVerifyRequired'
  | 'gamingSensitive'
  | 'routeConsistencyHold'
  | 'dataPlaneReady';

export interface AdminRouteDecisionSwitchRolloutStep {
  id: string;
  phase: RouteDecisionSwitchRolloutStepPhase | string;
  code: string;
  status: RouteDecisionSwitchRolloutStepStatus | string;
  trafficScope: RouteDecisionSwitchRolloutTrafficScope | string;
  targetPercent: number;
  durationSeconds?: number | null;
  dataPlaneMutation: boolean;
  reasonCodes: Array<RouteDecisionSwitchRolloutReason | string>;
}

export interface AdminRouteDecisionSwitchRolloutSummary {
  status: RouteDecisionSwitchRolloutStatus | string;
  strategy: RouteDecisionSwitchRolloutStrategy | string;
  dataPlaneReady: boolean;
  existingSessionsPinned: boolean;
  newSessionsCanary: boolean;
  automaticExpansion: boolean;
  initialPercent: number;
  maxPercent: number;
  canaryDurationSeconds: number;
  routeConsistencyHoldSeconds: number;
  rollbackOnLossPercent: number;
  rollbackOnJitterMs: number;
  rollbackOnLatencyMs: number;
  reasonCodes: Array<RouteDecisionSwitchRolloutReason | string>;
  steps: AdminRouteDecisionSwitchRolloutStep[];
}

export type RouteDecisionApplyPlanStatus =
  | 'notRequired'
  | 'assignmentOnlyReady'
  | 'blocked'
  | 'dataPlaneReady';

export type RouteDecisionApplyPlanStepKind =
  | 'guard'
  | 'assignment'
  | 'drain'
  | 'switch'
  | 'verify'
  | 'rollback';

export interface AdminRouteDecisionApplyPlanStep {
  id: string;
  kind: RouteDecisionApplyPlanStepKind | string;
  code: string;
  targetOutboundId?: string | null;
  dataPlaneMutation: boolean;
  estimatedSeconds?: number | null;
}

export type RouteDecisionApplyDryRunCommandKind =
  | 'precheck'
  | 'drain'
  | 'switch'
  | 'verify'
  | 'rollback';

export interface AdminRouteDecisionApplyDryRunCommand {
  id: string;
  kind: RouteDecisionApplyDryRunCommandKind | string;
  command: string;
  requiresRoot: boolean;
  dataPlaneMutation: boolean;
  secretSafe: boolean;
}

export interface AdminRouteDecisionApplyDryRunConfigChange {
  id: string;
  filePath: string;
  action: 'create' | 'update' | 'validate' | string;
  description: string;
  secretSafe: boolean;
}

export type RouteDecisionApplyAdapterStatus =
  | 'ready'
  | 'disabled'
  | 'missing'
  | 'unsupported';

export interface AdminRouteDecisionApplyAdapterSummary {
  id: string;
  label: string;
  status: RouteDecisionApplyAdapterStatus | string;
  outboundType?: string | null;
  protocol?: string | null;
  enabled: boolean;
  implemented: boolean;
  dataPlaneReady: boolean;
  supportedOutboundTypes: string[];
  supportedProtocols: string[];
  reasonCodes: string[];
  dryRunSupported: boolean;
  dryRunCommands: AdminRouteDecisionApplyDryRunCommand[];
  dryRunConfigChanges: AdminRouteDecisionApplyDryRunConfigChange[];
}

export interface AdminRouteDecisionApplyDryRunSnapshot {
  generatedAt: string;
  adapterId: string;
  adapterStatus: RouteDecisionApplyAdapterStatus | string;
  adapterEnabled: boolean;
  adapterImplemented: boolean;
  dataPlaneReady: boolean;
  dryRunSupported: boolean;
  secretSafe: boolean;
  commandCount: number;
  configChangeCount: number;
  commands: AdminRouteDecisionApplyDryRunCommand[];
  configChanges: AdminRouteDecisionApplyDryRunConfigChange[];
}

export interface AdminRouteDecisionApplyPlanSummary {
  status: RouteDecisionApplyPlanStatus | string;
  applyMode: RouteDecisionApplyMode;
  dataPlaneReady: boolean;
  assignmentOnlyAvailable: boolean;
  adapter: AdminRouteDecisionApplyAdapterSummary;
  estimatedDrainSeconds: number;
  guardReasonCodes: string[];
  steps: AdminRouteDecisionApplyPlanStep[];
  rollbackSteps: AdminRouteDecisionApplyPlanStep[];
}

export interface AdminRouteDecisionPreviewResponse {
  routeGroup: string;
  assignmentKey: string;
  generatedAt: string;
  mode: RouteSelectionMode | string;
  autoRouteEnabled: boolean;
  routeLocked: boolean;
  selectedScoreProfile?: RouteScoreProfile | string;
  hysteresisScoreDelta: number;
  cooldownSeconds: number;
  cooldownUntil?: string | null;
  currentCandidate?: AdminRouteDecisionCandidateSummary | null;
  recommendedCandidate?: AdminRouteDecisionCandidateSummary | null;
  candidateReviews: AdminRouteDecisionCandidateReviewSummary[];
  profileRecommendations: AdminRouteDecisionProfileRecommendation[];
  loadBalancing: AdminRouteDecisionLoadBalancingSummary;
  sessionSafety: AdminRouteDecisionSessionSafetySummary;
  switchEngine: AdminRouteDecisionSwitchEngineSummary;
  switchPreflight: AdminRouteDecisionSwitchPreflightSummary;
  switchRollout: AdminRouteDecisionSwitchRolloutSummary;
  applyPlan: AdminRouteDecisionApplyPlanSummary;
  scoreDelta?: number | null;
  action: RouteDecisionAction;
  reasonCodes: string[];
  candidateCount: number;
  healthyCandidateCount: number;
  managedCandidateCount: number;
}

export interface AdminRouteDecisionEventSummary {
  id: string;
  routeGroup: string;
  assignmentKey: string;
  decisionKind: string;
  decisionState: RouteDecisionAction | string;
  scoreProfile?: RouteScoreProfile | string | null;
  fromOutboundId?: string | null;
  fromOutboundName?: string | null;
  toOutboundId?: string | null;
  toOutboundName?: string | null;
  fromScore?: number | null;
  toScore?: number | null;
  scoreDelta?: number | null;
  hysteresisScoreDelta?: number | null;
  cooldownUntil?: string | null;
  routeLocked: boolean;
  autoRouteEnabled: boolean;
  reasonCodes: string[];
  appliedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface AdminRouteDecisionEventDetail extends AdminRouteDecisionEventSummary {
  decisionContext: Record<string, unknown>;
  dryRunSnapshot?: AdminRouteDecisionApplyDryRunSnapshot | null;
  switchExecution?: AdminRouteDecisionSwitchExecutionSummary | null;
  switchPreflight?: AdminRouteDecisionSwitchPreflightSummary | null;
  switchRollout?: AdminRouteDecisionSwitchRolloutSummary | null;
}

export interface RecordRouteDecisionPreviewRequest {
  routeGroup?: string;
  assignmentKey?: string;
}

export interface RecordRouteDecisionPreviewResponse {
  event: AdminRouteDecisionEventSummary;
  preview: AdminRouteDecisionPreviewResponse;
}

export type RouteDecisionApplyMode = 'assignmentOnly';

export interface ApplyRouteDecisionPreviewRequest extends RecordRouteDecisionPreviewRequest {
  applyMode?: RouteDecisionApplyMode;
}

export interface ApplyRouteDecisionPreviewResponse {
  event: AdminRouteDecisionEventSummary;
  preview: AdminRouteDecisionPreviewResponse;
  assignment: AdminRouteAssignmentSummary;
  applyMode: RouteDecisionApplyMode;
  assignmentApplied: boolean;
  dataPlaneApplied: boolean;
  switchExecution: AdminRouteDecisionSwitchExecutionSummary;
  reasonCodes: string[];
}

export interface AdminRouteDecisionEventsResponse {
  events: AdminRouteDecisionEventSummary[];
}

export interface AdminRouteDecisionEventDetailResponse {
  event: AdminRouteDecisionEventDetail;
}

export interface ProvisionProtocolSetupResponse {
  protocolSetup: AdminProtocolSetupSummary;
  outbound: AdminOutboundSummary;
}

export interface AdminServersResponse {
  servers: AdminServerSummary[];
}

export interface AdminOutboundsResponse {
  outbounds: AdminOutboundSummary[];
}

export interface RouteFailoverEventsResponse {
  events: RouteFailoverEventSummary[];
}

export interface AdminAlertsResponse {
  alerts: AdminAlertSummary[];
}
