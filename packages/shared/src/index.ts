export type HealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type Role = 'superadmin' | 'owner' | 'admin' | 'supervisor' | 'support' | 'auditor' | 'reseller' | 'agent';

export const ADMIN_ROLE_ORDER = ['superadmin', 'owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'] as const;
export const MANAGED_ADMIN_ROLES = ['owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'] as const;

export const ADMIN_PERMISSION_DEFINITIONS = [
  { id: 'dashboard:read', category: 'operations', risk: 'low' },
  { id: 'servers:read', category: 'operations', risk: 'low' },
  { id: 'servers:write', category: 'operations', risk: 'high' },
  { id: 'serverCredentials:write', category: 'secrets', risk: 'critical' },
  { id: 'tunnels:read', category: 'operations', risk: 'low' },
  { id: 'tunnels:write', category: 'operations', risk: 'high' },
  { id: 'routes:read', category: 'routing', risk: 'low' },
  { id: 'routes:write', category: 'routing', risk: 'high' },
  { id: 'routeDecisions:apply', category: 'routing', risk: 'critical' },
  { id: 'alerts:read', category: 'operations', risk: 'low' },
  { id: 'alerts:write', category: 'operations', risk: 'medium' },
  { id: 'billing:read', category: 'billing', risk: 'medium' },
  { id: 'billing:write', category: 'billing', risk: 'high' },
  { id: 'customers:read', category: 'billing', risk: 'medium' },
  { id: 'customers:write', category: 'billing', risk: 'high' },
  { id: 'resellers:read', category: 'billing', risk: 'medium' },
  { id: 'resellers:write', category: 'billing', risk: 'high' },
  { id: 'resellerWallet:read', category: 'billing', risk: 'medium' },
  { id: 'resellerWallet:write', category: 'billing', risk: 'high' },
  { id: 'settings:read', category: 'settings', risk: 'medium' },
  { id: 'tenantBranding:read', category: 'settings', risk: 'low' },
  { id: 'tenantBranding:write', category: 'settings', risk: 'high' },
  { id: 'protocols:write', category: 'settings', risk: 'critical' },
  { id: 'telegramBot:write', category: 'settings', risk: 'critical' },
  { id: 'adminUsers:read', category: 'access', risk: 'high' },
  { id: 'adminUsers:write', category: 'access', risk: 'critical' },
  { id: 'audit:read', category: 'compliance', risk: 'medium' },
  { id: 'backups:read', category: 'compliance', risk: 'medium' },
  { id: 'reports:read', category: 'compliance', risk: 'medium' },
  { id: 'metrics:write', category: 'agent', risk: 'medium' },
] as const;

export type AdminRole = typeof ADMIN_ROLE_ORDER[number];
export type ManagedAdminRole = typeof MANAGED_ADMIN_ROLES[number];
export type AdminPermissionId = typeof ADMIN_PERMISSION_DEFINITIONS[number]['id'];
export type AdminPermissionCategory = typeof ADMIN_PERMISSION_DEFINITIONS[number]['category'];
export type AdminPermissionRisk = typeof ADMIN_PERMISSION_DEFINITIONS[number]['risk'];
export type RolePermissionGrant = AdminPermissionId | '*';

export interface AdminPermissionDefinition {
  id: AdminPermissionId;
  category: AdminPermissionCategory;
  risk: AdminPermissionRisk;
}

export interface AdminRolePermissionSummary {
  role: AdminRole;
  permissions: AdminPermissionId[];
  inheritsAll: boolean;
  isSystemOwner: boolean;
  canManageAdminUsers: boolean;
}

export interface AdminPermissionsResponse {
  permissions: AdminPermissionDefinition[];
  roles: AdminRolePermissionSummary[];
  currentRole: Role;
  currentPermissions: AdminPermissionId[];
  currentHasFullAccess: boolean;
  deniedByDefault: true;
}

export const ROLE_PERMISSIONS = {
  superadmin: ['*'],
  owner: ['*'],
  admin: [
    'dashboard:read',
    'servers:read',
    'servers:write',
    'serverCredentials:write',
    'tunnels:read',
    'tunnels:write',
    'routes:read',
    'routes:write',
    'routeDecisions:apply',
    'alerts:read',
    'alerts:write',
    'billing:read',
    'billing:write',
    'customers:read',
    'customers:write',
    'resellers:read',
    'resellers:write',
    'resellerWallet:read',
    'resellerWallet:write',
    'settings:read',
    'tenantBranding:read',
    'tenantBranding:write',
    'protocols:write',
    'telegramBot:write',
    'adminUsers:read',
    'audit:read',
    'backups:read',
    'reports:read',
  ],
  supervisor: [
    'dashboard:read',
    'servers:read',
    'tunnels:read',
    'routes:read',
    'alerts:read',
    'billing:read',
    'customers:read',
    'resellers:read',
    'resellerWallet:read',
    'settings:read',
    'tenantBranding:read',
    'audit:read',
    'backups:read',
    'reports:read',
  ],
  support: [
    'dashboard:read',
    'servers:read',
    'tunnels:read',
    'routes:read',
    'alerts:read',
    'billing:read',
    'customers:read',
    'resellers:read',
    'tenantBranding:read',
  ],
  auditor: [
    'dashboard:read',
    'servers:read',
    'tunnels:read',
    'routes:read',
    'alerts:read',
    'audit:read',
    'backups:read',
    'reports:read',
    'tenantBranding:read',
  ],
  reseller: [
    'dashboard:read',
    'billing:read',
    'customers:read',
    'customers:write',
    'resellerWallet:read',
  ],
  agent: ['metrics:write'],
} as const satisfies Record<Role, readonly RolePermissionGrant[]>;

export function roleInheritsAllPermissions(role: Role): boolean {
  return (ROLE_PERMISSIONS[role] as readonly RolePermissionGrant[] | undefined)?.includes('*') === true;
}

export function getEffectiveRolePermissions(role: Role): AdminPermissionId[] {
  const grants = ROLE_PERMISSIONS[role] as readonly RolePermissionGrant[] | undefined;
  if (!grants) return [];
  if (grants.includes('*')) return ADMIN_PERMISSION_DEFINITIONS.map((permission) => permission.id);

  return grants.filter((permission): permission is AdminPermissionId => permission !== '*');
}

export function roleHasPermission(role: Role, permission: AdminPermissionId): boolean {
  const grants = ROLE_PERMISSIONS[role] as readonly RolePermissionGrant[] | undefined;

  return grants?.includes('*') === true || grants?.includes(permission) === true;
}

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

export type RouteProbeProtocol = 'tcp' | 'udp' | 'quic' | 'dns' | 'wireguard' | 'mtu';
export type RouteProbeStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type RouteMtuStatus = 'healthy' | 'fragmentationRisk' | 'blocked' | 'unknown';
export type RouteMtuRecommendation = 'none' | 'keep' | 'reduce' | 'manualReview';

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
  pathMtuBytes?: number | null;
  recommendedTunnelMtuBytes?: number | null;
  configuredMtuBytes?: number | null;
  mtuStatus?: RouteMtuStatus | string | null;
  mtuRecommendation?: RouteMtuRecommendation | string | null;
  mtuSessionSafe?: boolean | null;
  mtuReasonCodes?: string[];
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
export type AdminUserSource = 'bootstrap' | 'env' | 'local' | 'database';

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

export type CustomerAccountStatus = 'active' | 'suspended' | 'disabled';
export type CustomerQuotaScope = 'account_shared' | 'per_client';
export type ClientConfigStatus = 'active' | 'limited' | 'disabled' | 'expired';
export type ClientRoutePreferenceMode = 'auto' | 'country' | 'outbound';
export type ClientRouteCountryDetectionSource = 'client_app' | 'edge_ip' | 'admin' | 'unknown';
export type ClientSplitTunnelMode = 'all_apps' | 'selected_apps';
export type ClientUsageEventSource =
  | 'admin'
  | 'agent'
  | 'panel_sync'
  | 'payment_adjustment'
  | 'manual_adjustment'
  | 'client_report'
  | 'unknown';
export type ClientUsageDirection = 'rx' | 'tx' | 'combined';

export interface AdminClientRoutePreferenceSummary {
  id?: string | null;
  clientConfigId: string;
  customerAccountId: string;
  routeGroup: string;
  assignmentKey: string;
  mode: ClientRoutePreferenceMode | string;
  detectedCountryCode?: string | null;
  detectedCountrySource?: ClientRouteCountryDetectionSource | string | null;
  preferredExitCountryCode?: string | null;
  preferredOutboundId?: string | null;
  preferredOutboundName?: string | null;
  scoreProfile: RouteScoreProfile | string;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
  lastDetectedAt?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ClientAccessTokenSummary {
  id: string;
  clientConfigId: string;
  name: string;
  scopes: string[];
  status: 'active' | 'revoked' | string;
  createdBy?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface IssuedClientAccessTokenSummary extends ClientAccessTokenSummary {
  token: string;
}

export interface IssueClientAccessTokenRequest {
  name?: string | null;
  revokeExistingTokens?: boolean;
}

export interface ClientPortalAccountSummary {
  id: string;
  displayName?: string | null;
  status: CustomerAccountStatus | string;
  quotaScope: CustomerQuotaScope | string;
  quotaLimitBytes?: number | null;
  usedBytes: number;
  remainingBytes?: number | null;
}

export interface ClientPortalConfigSummary {
  id: string;
  label: string;
  protocol: string;
  deviceLimit?: number | null;
  effectiveQuotaLimitBytes?: number | null;
  usedBytes: number;
  remainingBytes?: number | null;
  status: ClientConfigStatus | string;
}

export interface TelegramBotAccountSummary {
  id: string;
  displayName?: string | null;
  status: CustomerAccountStatus | string;
  quotaScope: CustomerQuotaScope | string;
  quotaLimitBytes?: number | null;
  usedBytes: number;
  remainingBytes?: number | null;
  clientCount: number;
  activeClientCount: number;
}

export type TelegramBotAccountLookup =
  | { status: 'found'; account: TelegramBotAccountSummary }
  | { status: 'not_found' }
  | { status: 'ambiguous' };

export type TelegramBotCommandName = 'start' | 'help' | 'status' | 'quota' | 'unknown';

export interface TelegramBotWebhookResponse {
  ok: boolean;
  status: 'ignored' | 'sent' | 'failed';
  command?: TelegramBotCommandName;
  reason?: string;
}

export type TelegramBotSettingsSecretSource = 'database' | 'environment' | 'none';
export type TelegramBotSettingsTestStatus = 'notTested' | 'ok' | 'failed' | 'missingToken';

export interface AdminTelegramBotSettingsSummary {
  hasBotToken: boolean;
  botTokenSource: TelegramBotSettingsSecretSource | string;
  hasWebhookSecret: boolean;
  webhookSecretSource: TelegramBotSettingsSecretSource | string;
  alertsEnabled: boolean;
  commandsEnabled: boolean;
  alertChatId?: string | null;
  alertChatIdSource: TelegramBotSettingsSecretSource | string;
  allowedAdminChatIds: string[];
  outboundProxyConfigured: boolean;
  botId?: string | null;
  botUsername?: string | null;
  botFirstName?: string | null;
  lastTestStatus: TelegramBotSettingsTestStatus | string;
  lastTestedAt?: string | null;
  lastTestErrorCode?: string | null;
  lastTestDurationMs?: number | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface AdminTelegramBotSettingsResponse {
  telegramBot: AdminTelegramBotSettingsSummary;
}

export interface UpdateTelegramBotSettingsRequest {
  botToken?: string;
  webhookSecret?: string;
  clearBotToken?: boolean;
  clearWebhookSecret?: boolean;
  alertChatId?: string | null;
  allowedAdminChatIds?: string[];
  alertsEnabled?: boolean;
  commandsEnabled?: boolean;
}

export interface AdminTenantBrandSettingsSummary {
  settingKey: string;
  tenantSlug: string;
  displayName: string;
  legalName?: string | null;
  supportEmail?: string | null;
  supportTelegram?: string | null;
  supportUrl?: string | null;
  logoUrl?: string | null;
  dashboardTitle: string;
  clientAppTitle: string;
  primaryColor: string;
  accentColor: string;
  publicBrandingEnabled: boolean;
  clientSupportMessage?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTenantBrandSettingsRequest {
  tenantSlug?: string;
  displayName?: string;
  legalName?: string | null;
  supportEmail?: string | null;
  supportTelegram?: string | null;
  supportUrl?: string | null;
  logoUrl?: string | null;
  dashboardTitle?: string;
  clientAppTitle?: string;
  primaryColor?: string;
  accentColor?: string;
  publicBrandingEnabled?: boolean;
  clientSupportMessage?: string | null;
}

export interface AdminTenantBrandSettingsResponse {
  branding: AdminTenantBrandSettingsSummary;
}

export interface AdminTelegramBotTestResponse {
  ok: boolean;
  status: TelegramBotSettingsTestStatus | string;
  durationMs?: number | null;
  botUsername?: string | null;
  errorCode?: string | null;
  telegramBot: AdminTelegramBotSettingsSummary;
}

export interface ClientRoutePreferenceSummary {
  routeGroup: string;
  assignmentKey: string;
  mode: ClientRoutePreferenceMode | string;
  detectedCountryCode?: string | null;
  detectedCountrySource?: ClientRouteCountryDetectionSource | string | null;
  preferredExitCountryCode?: string | null;
  preferredOutboundId?: string | null;
  preferredOutboundName?: string | null;
  scoreProfile: RouteScoreProfile | string;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
  lastDetectedAt?: string | null;
  updatedAt?: string | null;
}

export interface ClientRewardedAdStatus {
  enabled: boolean;
  rewardBytes: number;
  dailyLimit: number;
  watchedToday: number;
  remainingToday: number;
  nextResetAt: string;
  provider: string;
  verificationMode: string;
}

export interface ClientRewardedAdStatusResponse {
  rewardedAds: ClientRewardedAdStatus;
}

export interface ClaimRewardedAdRequest {
  provider?: string | null;
  adSessionId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RewardedAdProviderWebhookRequest {
  provider?: string | null;
  clientConfigId: string;
  adSessionId?: string | null;
  idempotencyKey?: string | null;
  providerEventId?: string | null;
  adUnitId?: string | null;
  placementId?: string | null;
  rewardAmount?: number | null;
  rewardCurrency?: string | null;
  eventTimestamp?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ClientRewardedAdGrantSummary {
  id: string;
  customerAccountId: string;
  clientConfigId: string;
  grantDay: string;
  dailyGrantNumber: number;
  provider: string;
  adSessionId?: string | null;
  idempotencyKey: string;
  rewardBytes: number;
  accountQuotaBeforeBytes?: number | null;
  accountQuotaAfterBytes: number;
  clientQuotaBeforeBytes?: number | null;
  clientQuotaAfterBytes?: number | null;
  verificationMode: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ClientRewardedAdClaimResponse {
  grant: ClientRewardedAdGrantSummary;
  rewardedAds: ClientRewardedAdStatus;
  profile: ClientPortalProfileResponse;
  duplicate: boolean;
}

export interface RewardedAdWebhookHandlerResponse {
  ok: true;
  action: 'granted' | 'duplicate';
  provider: string;
  clientConfigId: string;
  adSessionId?: string | null;
  idempotencyKey: string;
  grant: ClientRewardedAdGrantSummary;
  duplicate: boolean;
}

export interface ClientRouteCountryOption {
  countryCode: string;
  routeGroup: string;
  availableOutboundCount: number;
  healthyOutboundCount: number;
  bestHealthStatus: OutboundHealthStatus | string;
  minUsageMultiplier: number;
}

export interface ClientSubscriptionEndpointSummary {
  outboundId: string;
  name: string;
  type: OutboundType | string;
  routeGroup: string;
  countryCode?: string | null;
  region?: string | null;
  healthStatus: OutboundHealthStatus | string;
  usageMultiplier: number;
  chargeLabel: string;
  address?: string | null;
  host?: string | null;
  port?: number | null;
  transport?: string | null;
  updatedAt?: string | null;
  usableBytesAtMultiplier?: number | null;
}

export type ClientSubscriptionConfigFormat =
  | 'wireguard-profile'
  | 'vless-uri'
  | 'l2tp-profile'
  | 'ikev2-profile'
  | 'manual-profile';

export type ClientSubscriptionConfigRenderStatus =
  | 'rendered'
  | 'blocked_secret_required'
  | 'blocked_secret_unavailable'
  | 'blocked_secret_invalid'
  | 'missing_public_config'
  | 'unsupported_protocol';

export interface ClientSubscriptionConfigLinkSummary {
  outboundId: string;
  name: string;
  type: OutboundType | string;
  routeGroup: string;
  countryCode?: string | null;
  region?: string | null;
  usageMultiplier: number;
  chargeLabel: string;
  address?: string | null;
  host?: string | null;
  port?: number | null;
  transport?: string | null;
  format: ClientSubscriptionConfigFormat | string;
  renderStatus: ClientSubscriptionConfigRenderStatus | string;
  uri?: string | null;
  configText?: string | null;
  profile?: Record<string, string | number | boolean | null>;
  credentialId?: string | null;
  renderedAt?: string | null;
  sensitive?: boolean;
  missingFields: string[];
  warnings: string[];
  requiresClientSecret: boolean;
  updatedAt?: string | null;
  usableBytesAtMultiplier?: number | null;
}

export interface ClientSplitTunnelAppSummary {
  id: string;
  label: string;
  androidPackage?: string | null;
  iosBundleId?: string | null;
}

export interface ClientSplitTunnelNativeProfile {
  version: 1;
  generatedAt: string;
  clientConfigId: string;
  routeGroup: string;
  mode: ClientSplitTunnelMode | string;
  selectedApps: ClientSplitTunnelAppSummary[];
  privacy: {
    localOnly: boolean;
    installedAppInventoryShared: boolean;
    trafficDestinationsShared: boolean;
  };
  nativeTargets: {
    androidVpnService: boolean;
    iosManagedPerAppVpn: boolean;
  };
}

export interface ClientRouteOutboundOption {
  id: string;
  name: string;
  type: OutboundType | string;
  routeGroup: string;
  countryCode?: string | null;
  region?: string | null;
  healthStatus: OutboundHealthStatus | string;
  available: boolean;
  usageMultiplier: number;
  chargeLabel: string;
  usableBytesAtMultiplier?: number | null;
  subscriptionEndpoint?: ClientSubscriptionEndpointSummary | null;
}

export interface UpdateClientRoutePreferenceRequest {
  routeGroup?: string;
  mode?: ClientRoutePreferenceMode;
  detectedCountryCode?: string | null;
  preferredExitCountryCode?: string | null;
  preferredOutboundId?: string | null;
  scoreProfile?: RouteScoreProfile | string;
  autoDetectCountry?: boolean;
}

export interface AdminClientConfigSummary {
  id: string;
  customerAccountId: string;
  label: string;
  protocol: string;
  externalPanel?: string | null;
  externalPanelUserId?: string | null;
  externalPanelConfigId?: string | null;
  deviceLimit?: number | null;
  quotaLimitBytes?: number | null;
  effectiveQuotaLimitBytes?: number | null;
  usedBytes: number;
  remainingBytes?: number | null;
  status: ClientConfigStatus | string;
  notes?: string | null;
  routePreference?: AdminClientRoutePreferenceSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCustomerAccountSummary {
  id: string;
  resellerAccountId?: string | null;
  resellerDisplayName?: string | null;
  displayName?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  hasPaidNumberHash: boolean;
  status: CustomerAccountStatus | string;
  quotaScope: CustomerQuotaScope | string;
  quotaLimitBytes?: number | null;
  perClientLimitBytes?: number | null;
  usedBytes: number;
  remainingBytes?: number | null;
  clientCount: number;
  activeClientCount: number;
  /** Distinct protocols across this customer's client configs (e.g. ['vless','wireguard']). */
  protocols: string[];
  notes?: string | null;
  loginEmail?: string | null;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCustomerAccountDetail extends AdminCustomerAccountSummary {
  clientConfigs: AdminClientConfigSummary[];
  /** Plaintext password returned ONCE at creation/reset; never stored or re-returned. */
  generatedPassword?: string;
}

export interface ClientLoginRequest {
  identifier: string;
  password: string;
}

export interface ClientLoginResponse {
  token: string;
  account: {
    id: string;
    displayName?: string | null;
    quotaLimitBytes?: number | null;
    usedBytes: number;
    remainingBytes?: number | null;
  };
}

export type ResellerAccountStatus = 'active' | 'suspended' | 'disabled';
export type ResellerWalletEntryType = 'topup' | 'sale_debit' | 'adjustment' | 'refund';
export type ResellerWalletEntrySource = 'manual_topup' | 'client_sale' | 'manual_adjustment' | 'refund';

export interface AdminResellerAccountSummary {
  id: string;
  adminUserId: string;
  displayName: string;
  contactName?: string | null;
  telegramUsername?: string | null;
  status: ResellerAccountStatus | string;
  sellerMarginBps: number;
  sellerMarginPercent: number;
  afrowsShareBps: number;
  afrowsSharePercent: number;
  currency: string;
  balanceAmount: number;
  creditLimitAmount: number;
  availableBalanceAmount: number;
  customerAccountCount: number;
  activeCustomerAccountCount: number;
  ledgerEntryCount: number;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResellerWalletLedgerEntry {
  id: string;
  resellerAccountId: string;
  entryType: ResellerWalletEntryType | string;
  amount: number;
  balanceBeforeAmount: number;
  balanceAfterAmount: number;
  currency: string;
  source: ResellerWalletEntrySource | string;
  sourceId?: string | null;
  volumePackageId?: string | null;
  volumePackageName?: string | null;
  customerAccountId?: string | null;
  customerDisplayName?: string | null;
  clientConfigId?: string | null;
  clientConfigLabel?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface AdminResellerPackageQuote {
  resellerAccountId: string;
  volumePackageId: string;
  packageName: string;
  currency: string;
  customerPriceAmount: number;
  sellerMarginBps: number;
  sellerMarginAmount: number;
  walletDebitAmount: number;
  balanceBeforeAmount: number;
  balanceAfterAmount: number;
  creditLimitAmount: number;
  canDebit: boolean;
  blockedReason?: string | null;
}

export interface AdminResellerWorkspaceSummary {
  reseller: AdminResellerAccountSummary;
  settings: AdminBillingSettingsSummary;
  packages: AdminVolumePackageSummary[];
  accounts: AdminCustomerAccountSummary[];
  paymentOrders: AdminPaymentOrderSummary[];
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  generatedAt: string;
}

export interface CreateResellerAccountRequest {
  adminUserId: string;
  displayName: string;
  contactName?: string | null;
  telegramUsername?: string | null;
  status?: ResellerAccountStatus;
  sellerMarginBps?: number;
  currency?: string;
  creditLimitAmount?: number;
  notes?: string | null;
}

export interface UpdateResellerAccountRequest {
  displayName?: string;
  contactName?: string | null;
  telegramUsername?: string | null;
  status?: ResellerAccountStatus;
  sellerMarginBps?: number;
  currency?: string;
  creditLimitAmount?: number;
  notes?: string | null;
}

export interface TopUpResellerWalletRequest {
  amount: number;
  idempotencyKey?: string | null;
  sourceId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DebitResellerWalletForPackageRequest {
  volumePackageId: string;
  customerAccountId?: string | null;
  clientConfigId?: string | null;
  idempotencyKey?: string | null;
  sourceId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateResellerPackageSaleRequest {
  volumePackageId: string;
  customerAccountId?: string | null;
  customerAccount?: CreateCustomerAccountRequest | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminClientConfigEntryLinkResponse {
  /** the native afrows-in VLESS entry link for this client config (null if the inbound env isn't configured) */
  link: string | null;
}

export interface AdminClientConfigsExportResponse {
  customerAccountId: string;
  generatedAt: string;
  exportFormat: 'afrows_client_configs_export_v1';
  configCount: number;
  configs: AdminClientConfigSummary[];
  warnings: string[];
}

export type CurrentPanelKind = 'marzban' | 'xui' | 'sanayi' | 'generic';
export type CurrentPanelImportCandidateStatus = 'active' | 'disabled' | 'expired' | 'limited' | 'unknown';

export interface CurrentPanelImportPreviewRequest {
  panelKind?: CurrentPanelKind | string;
  sourceName?: string | null;
  payload: unknown;
  defaultProtocol?: ProtocolKind | string;
}

export interface CurrentPanelImportCandidate {
  externalPanel: string;
  externalPanelUserId?: string | null;
  externalPanelConfigId?: string | null;
  username?: string | null;
  displayName?: string | null;
  label: string;
  protocol: ProtocolKind | string;
  status: CurrentPanelImportCandidateStatus | string;
  quotaBytes?: number | null;
  usedBytes?: number | null;
  remainingBytes?: number | null;
  expiresAt?: string | null;
  deviceLimit?: number | null;
  reasonCodes: string[];
}

export interface CurrentPanelImportConfigsRequest extends CurrentPanelImportPreviewRequest {
  customerAccountId: string;
}

export interface CurrentPanelUsageSyncRequest extends CurrentPanelImportPreviewRequest {
  customerAccountId: string;
}

export interface CurrentPanelImportSkippedCandidate {
  label: string;
  externalPanel: string;
  externalPanelUserId?: string | null;
  externalPanelConfigId?: string | null;
  reasonCodes: string[];
}

export interface CurrentPanelImportRejectedRow {
  index: number;
  reasonCodes: string[];
  rawType?: string | null;
}

export interface AdminCurrentPanelImportPreviewResponse {
  panelKind: CurrentPanelKind | string;
  sourceName?: string | null;
  generatedAt: string;
  adapterVersion: string;
  candidateCount: number;
  activeCount: number;
  disabledCount: number;
  expiredCount: number;
  limitedCount: number;
  totalQuotaBytes?: number | null;
  totalUsedBytes?: number | null;
  candidates: CurrentPanelImportCandidate[];
  rejectedRows: CurrentPanelImportRejectedRow[];
  warnings: string[];
}

export interface AdminCurrentPanelImportConfigsResponse {
  customerAccountId: string;
  panelKind: CurrentPanelKind | string;
  generatedAt: string;
  adapterVersion: string;
  candidateCount: number;
  importedCount: number;
  skippedCount: number;
  baselineUsageEventCount: number;
  baselineUsedBytes: number;
  importedConfigs: AdminClientConfigSummary[];
  skippedCandidates: CurrentPanelImportSkippedCandidate[];
  warnings: string[];
}

export interface AdminCurrentPanelUsageSyncResponse {
  customerAccountId: string;
  panelKind: CurrentPanelKind | string;
  generatedAt: string;
  adapterVersion: string;
  candidateCount: number;
  matchedCount: number;
  syncedCount: number;
  skippedCount: number;
  usageEventCount: number;
  syncedUsedBytesDelta: number;
  updatedConfigs: AdminClientConfigSummary[];
  skippedCandidates: CurrentPanelImportSkippedCandidate[];
  warnings: string[];
}

export type CurrentPanelVolumeChargeScope = 'account_quota' | 'selected_clients' | 'account_and_selected_clients';
export type CurrentPanelExternalWriteStatus = 'not_configured' | 'not_executed';

export interface CurrentPanelVolumeChargeRequest {
  customerAccountId: string;
  volumeBytesDelta: number;
  scope?: CurrentPanelVolumeChargeScope;
  clientConfigIds?: string[];
  idempotencyKey?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminCurrentPanelVolumeChargeClientQuotaChange {
  clientConfigId: string;
  quotaLimitBeforeBytes?: number | null;
  quotaLimitAfterBytes: number;
}

export interface AdminCurrentPanelVolumeChargeEventSummary {
  id: string;
  customerAccountId: string;
  scope: CurrentPanelVolumeChargeScope | string;
  volumeBytesDelta: number;
  accountQuotaLimitBeforeBytes?: number | null;
  accountQuotaLimitAfterBytes?: number | null;
  clientConfigIds: string[];
  clientQuotaChanges: AdminCurrentPanelVolumeChargeClientQuotaChange[];
  externalPanelWriteStatus: CurrentPanelExternalWriteStatus | string;
  idempotencyKey?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface AdminCurrentPanelVolumeChargeResponse {
  chargeEvent: AdminCurrentPanelVolumeChargeEventSummary;
  account: AdminCustomerAccountSummary;
  updatedClients: AdminClientConfigSummary[];
  duplicate: boolean;
  externalPanelWrite: {
    attempted: false;
    status: CurrentPanelExternalWriteStatus | string;
    reasonCode: string;
  };
  warnings: string[];
}

export interface CreateCustomerAccountRequest {
  resellerAccountId?: string | null;
  displayName?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  paidNumber?: string | null;
  status?: CustomerAccountStatus;
  quotaScope?: CustomerQuotaScope;
  quotaLimitBytes?: number | null;
  perClientLimitBytes?: number | null;
  usedBytes?: number;
  notes?: string | null;
  loginEmail?: string | null;
  password?: string | null;
}

export interface UpdateCustomerAccountRequest {
  resellerAccountId?: string | null;
  displayName?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  paidNumber?: string | null;
  clearPaidNumber?: boolean;
  status?: CustomerAccountStatus;
  quotaScope?: CustomerQuotaScope;
  quotaLimitBytes?: number | null;
  perClientLimitBytes?: number | null;
  usedBytes?: number;
  notes?: string | null;
  loginEmail?: string | null;
  password?: string | null;
}

export interface CreateClientConfigRequest {
  label: string;
  protocol?: string;
  externalPanel?: string | null;
  externalPanelUserId?: string | null;
  externalPanelConfigId?: string | null;
  deviceLimit?: number | null;
  quotaLimitBytes?: number | null;
  usedBytes?: number;
  status?: ClientConfigStatus;
  notes?: string | null;
}

export interface UpdateClientConfigRequest {
  label?: string;
  protocol?: string;
  externalPanel?: string | null;
  externalPanelUserId?: string | null;
  externalPanelConfigId?: string | null;
  deviceLimit?: number | null;
  quotaLimitBytes?: number | null;
  usedBytes?: number;
  status?: ClientConfigStatus;
  notes?: string | null;
}

export type ClientSubscriptionCredentialProtocol = 'wireguard' | 'vless' | 'l2tp' | 'ikev2';

export interface AdminClientSubscriptionCredentialSummary {
  id: string;
  clientConfigId: string;
  customerAccountId: string;
  outboundId: string;
  outboundName?: string | null;
  protocol: ClientSubscriptionCredentialProtocol | string;
  name?: string | null;
  status: 'active' | 'revoked' | string;
  publicMetadata: Record<string, unknown>;
  hasSecretMaterial: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  lastRotatedAt?: string | null;
  revokedAt?: string | null;
}

export interface UpsertClientSubscriptionCredentialRequest {
  outboundId: string;
  protocol?: ClientSubscriptionCredentialProtocol | string;
  name?: string | null;
  secretMaterial: Record<string, unknown>;
  publicMetadata?: Record<string, unknown> | null;
}

export interface UpsertClientRoutePreferenceRequest {
  routeGroup?: string;
  mode?: ClientRoutePreferenceMode;
  detectedCountryCode?: string | null;
  detectedCountrySource?: ClientRouteCountryDetectionSource | null;
  preferredExitCountryCode?: string | null;
  preferredOutboundId?: string | null;
  scoreProfile?: RouteScoreProfile | string;
  autoDetectCountry?: boolean;
  allowClientOverride?: boolean;
  routeLocked?: boolean;
  stickySessionProtection?: boolean;
}

export interface AdminClientUsageEventSummary {
  id: string;
  customerAccountId: string;
  clientConfigId: string;
  source: ClientUsageEventSource | string;
  direction: ClientUsageDirection | string;
  usedBytesDelta: number;
  rawUsedBytesDelta?: number | null;
  usageMultiplier: number;
  ratedOutboundId?: string | null;
  ratedOutboundName?: string | null;
  rxBytes?: number | null;
  txBytes?: number | null;
  observedAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  idempotencyKey?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface CreateClientUsageEventRequest {
  source?: ClientUsageEventSource;
  direction?: ClientUsageDirection;
  usedBytesDelta?: number;
  outboundId?: string | null;
  rxBytes?: number | null;
  txBytes?: number | null;
  observedAt?: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  idempotencyKey?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export type VolumePackageStatus = 'active' | 'archived';

export interface AdminBillingSettingsSummary {
  settingKey: string;
  currency: string;
  pricePerGb: number;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRewardedAdSettingsSummary {
  settingKey: string;
  enabled: boolean;
  rewardBytes: number;
  rewardMb: number;
  dailyLimit: number;
  provider: string;
  verificationMode: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVolumePackageSummary {
  id: string;
  name: string;
  slug: string;
  volumeBytes: number;
  volumeGb: number;
  durationDays?: number | null;
  pricePerGb: number;
  totalPrice: number;
  currency: string;
  status: VolumePackageStatus | string;
  sortOrder: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBillingSettingsRequest {
  currency?: string;
  pricePerGb?: number;
}

export interface UpdateRewardedAdSettingsRequest {
  enabled?: boolean;
  rewardBytes?: number;
  dailyLimit?: number;
  provider?: string;
  verificationMode?: string;
}

export interface CreateVolumePackageRequest {
  name: string;
  slug?: string;
  volumeGb: number;
  durationDays?: number | null;
  pricePerGb?: number;
  totalPrice?: number;
  currency?: string;
  status?: VolumePackageStatus;
  sortOrder?: number;
  notes?: string | null;
}

export interface UpdateVolumePackageRequest {
  name?: string;
  slug?: string;
  volumeGb?: number;
  durationDays?: number | null;
  pricePerGb?: number;
  totalPrice?: number;
  currency?: string;
  status?: VolumePackageStatus;
  sortOrder?: number;
  notes?: string | null;
}

export type PaymentMethodStatus = 'active' | 'disabled';
export type PaymentCheckoutMode = 'manual' | 'hosted_redirect' | 'external_link' | 'provider_sdk';
export type PaymentProvider = 'paypal' | 'manual' | 'bank_transfer' | 'card' | 'crypto' | 'local_gateway';
export type PaymentProviderAdapterStatus = 'implemented' | 'manual_settlement' | 'verification_adapter_required';
export type PaymentProviderSettlementMode = 'auto_capture' | 'manual_verification' | 'hosted_gateway';

export interface AdminPaymentProviderAdapterSummary {
  provider: PaymentProvider | string;
  checkoutMode: PaymentCheckoutMode | string;
  settlementMode: PaymentProviderSettlementMode | string;
  status: PaymentProviderAdapterStatus | string;
  supportsHostedCheckout: boolean;
  supportsPaymentReference: boolean;
  supportsWebhookVerification: boolean;
  requiresSecretRef: boolean;
  publicConfigKeys: string[];
  safetyNotes: string[];
}

export interface AdminPaymentMethodSummary {
  id: string;
  name: string;
  slug: string;
  provider: PaymentProvider | string;
  checkoutMode: PaymentCheckoutMode | string;
  currency: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  status: PaymentMethodStatus | string;
  sortOrder: number;
  supportsAutoCapture: boolean;
  publicConfig: Record<string, unknown>;
  instructions?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodRequest {
  name: string;
  slug?: string;
  provider?: PaymentProvider | string;
  checkoutMode?: PaymentCheckoutMode;
  currency?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  status?: PaymentMethodStatus;
  sortOrder?: number;
  supportsAutoCapture?: boolean;
  publicConfig?: Record<string, unknown> | null;
  instructions?: string | null;
}

export interface UpdatePaymentMethodRequest {
  name?: string;
  slug?: string;
  provider?: PaymentProvider | string;
  checkoutMode?: PaymentCheckoutMode;
  currency?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  status?: PaymentMethodStatus;
  sortOrder?: number;
  supportsAutoCapture?: boolean;
  publicConfig?: Record<string, unknown> | null;
  instructions?: string | null;
}

export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentOrderAllocationStatus = 'not_applicable' | 'pending' | 'allocated';

export interface AdminPaymentOrderSummary {
  id: string;
  customerAccountId: string;
  customerDisplayName?: string | null;
  customerTelegramUsername?: string | null;
  volumePackageId?: string | null;
  paymentMethodId?: string | null;
  paymentMethodName?: string | null;
  paymentMethodSlug?: string | null;
  packageName: string;
  packageSlug: string;
  volumeBytes: number;
  volumeGb: number;
  durationDays?: number | null;
  pricePerGb: number;
  amount: number;
  currency: string;
  status: PaymentOrderStatus | string;
  provider: PaymentProvider | string;
  providerOrderId?: string | null;
  providerCaptureId?: string | null;
  checkoutUrl?: string | null;
  idempotencyKey?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
  expiresAt?: string | null;
  allocationStatus?: PaymentOrderAllocationStatus | string;
  allocationId?: string | null;
  allocatedAt?: string | null;
  allocatedVolumeBytes?: number | null;
  allocationDelaySeconds?: number | null;
  metadata: Record<string, unknown>;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentOrderRequest {
  customerAccountId: string;
  volumePackageId: string;
  paymentMethodId: string;
  providerOrderId?: string | null;
  checkoutUrl?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface UpdatePaymentOrderStatusRequest {
  status: PaymentOrderStatus;
  providerOrderId?: string | null;
  providerCaptureId?: string | null;
  checkoutUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface AllocatePaymentOrderRequest {
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminPaymentOrderAllocationSummary {
  id: string;
  paymentOrderId: string;
  customerAccountId: string;
  allocationScope: 'account_quota' | string;
  volumeBytesDelta: number;
  quotaLimitBeforeBytes?: number | null;
  quotaLimitAfterBytes: number;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface AdminTelegramPurchaseFulfillmentSummary {
  paymentOrderId: string;
  customerAccountId: string;
  attempted: boolean;
  status: 'sent' | 'skipped' | 'failed' | string;
  reasonCodes: string[];
  telegramChatIdAvailable: boolean;
  clientConfigId?: string | null;
  configDelivered: boolean;
  usageStatusLink?: string | null;
  messageStatus?: 'sent' | 'skipped' | 'failed' | string | null;
  messageReason?: string | null;
}

export interface AdminAllocatePaymentOrderResponse {
  allocation: AdminPaymentOrderAllocationSummary;
  paymentOrder: AdminPaymentOrderSummary;
  account: AdminCustomerAccountSummary;
  duplicate: boolean;
  telegramFulfillment?: AdminTelegramPurchaseFulfillmentSummary;
}

export interface CreatePayPalCheckoutRequest {
  returnUrl?: string | null;
  cancelUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface CapturePayPalPaymentOrderRequest {
  providerOrderId?: string | null;
  idempotencyKey?: string | null;
}

export interface AdminPayPalPaymentOrderResponse {
  paymentOrder: AdminPaymentOrderSummary;
  providerOrderId?: string | null;
  providerCaptureId?: string | null;
  checkoutUrl?: string | null;
  action: string;
}

export interface CreatePaymentProviderCheckoutRequest {
  returnUrl?: string | null;
  cancelUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface AdminPaymentProviderCheckoutResponse {
  paymentOrder: AdminPaymentOrderSummary;
  provider: PaymentProvider | string;
  paymentReference: string;
  checkoutUrl?: string | null;
  instructions?: string | null;
  adapterStatus: PaymentProviderAdapterStatus | string;
  action: string;
}

export interface PayPalWebhookHandlerResponse {
  ok: true;
  action: string;
  eventId?: string | null;
  eventType?: string | null;
  paymentOrderId?: string | null;
  providerOrderId?: string | null;
  providerCaptureId?: string | null;
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

export interface AgentServerSummary {
  id: string;
  externalId: string;
  hostname?: string | null;
  platform?: string | null;
  status: string;
}

export interface IssuedAgentTokenSummary {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  createdAt: string;
}

export interface AgentRegistrationResponse {
  server: AgentServerSummary;
  token: IssuedAgentTokenSummary;
}

export interface RotateAgentTokenRequest {
  tokenName?: string;
}

export interface AgentTokenRotationResponse {
  server: AgentServerSummary;
  token: IssuedAgentTokenSummary;
  revokedTokenCount: number;
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

export type ServerCredentialKind = 'ssh_private_key' | 'ssh_password' | 'api_token';

export type ServerCredentialStatus = 'active' | 'revoked' | 'disabled';

export interface ServerAccessProfileSummary {
  id: string;
  address: string;
  sshPort: number;
  username: string;
  accessMethod: ServerAccessMethod | string;
  bootstrapState: ServerBootstrapState | string;
  hasCredentialRef: boolean;
  hasActiveCredential: boolean;
  credentialName?: string | null;
  credentialKind?: ServerCredentialKind | string | null;
  credentialStatus?: ServerCredentialStatus | string | null;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertServerAccessProfileRequest {
  address: string;
  sshPort?: number;
  username?: string;
  accessMethod?: ServerAccessMethod;
  bootstrapState?: ServerBootstrapState;
  lastTestStatus?: string | null;
  notes?: string | null;
}

export interface UpdateServerRequest {
  externalId?: string;
  hostname?: string | null;
  platform?: string | null;
  country?: string | null;
  region?: string | null;
  role?: string | null;
  tags?: string[];
  status?: string;
  accessProfile?: UpsertServerAccessProfileRequest;
}

export interface CreateServerCredentialRequest {
  name: string;
  kind: ServerCredentialKind;
  secret: string;
}

export interface AdminServerCredentialSummary {
  id: string;
  serverId: string;
  name: string;
  kind: ServerCredentialKind | string;
  status: ServerCredentialStatus | string;
  lastUsedAt?: string | null;
  lastRotatedAt?: string | null;
  revokedAt?: string | null;
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

export type ServerInterfaceStatus = 'up' | 'down' | 'degraded' | 'unknown';
export type TunnelStatus = 'up' | 'down' | 'degraded' | 'unknown';
export type TunnelType = 'wireguard' | 'vless' | 'l2tp' | 'ikev2' | 'custom';

export interface AdminServerInterfaceSummary {
  id: string;
  serverId: string;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  name: string;
  operator?: string | null;
  kind: string;
  status: ServerInterfaceStatus | string;
  macAddress?: string | null;
  addressCidr?: string | null;
  linkedTunnelId?: string | null;
  linkedTunnelName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerInterfaceRequest {
  serverId: string;
  name: string;
  operator?: string | null;
  kind?: string;
  status?: ServerInterfaceStatus;
  macAddress?: string | null;
  addressCidr?: string | null;
  notes?: string | null;
}

export interface UpdateServerInterfaceRequest {
  serverId?: string;
  name?: string;
  operator?: string | null;
  kind?: string;
  status?: ServerInterfaceStatus;
  macAddress?: string | null;
  addressCidr?: string | null;
  notes?: string | null;
}

export interface AdminTunnelSummary {
  id: string;
  serverId: string;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  name: string;
  type: TunnelType | string;
  remoteEndpoint?: string | null;
  interfaceName?: string | null;
  localInterfaceId?: string | null;
  localInterfaceName?: string | null;
  interfaceOperator?: string | null;
  routeGroup: string;
  status: TunnelStatus | string;
  lockable: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTunnelRequest {
  serverId: string;
  name: string;
  type?: TunnelType;
  remoteEndpoint?: string | null;
  interfaceName?: string | null;
  localInterfaceId?: string | null;
  routeGroup?: string;
  status?: TunnelStatus;
  lockable?: boolean;
  notes?: string | null;
}

export interface UpdateTunnelRequest {
  serverId?: string;
  name?: string;
  type?: TunnelType;
  remoteEndpoint?: string | null;
  interfaceName?: string | null;
  localInterfaceId?: string | null;
  routeGroup?: string;
  status?: TunnelStatus;
  lockable?: boolean;
  notes?: string | null;
}

export interface StoreServerCredentialResponse {
  server: AdminServerDetail;
  credential: AdminServerCredentialSummary;
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
  usageMultiplier: number;
  maxUsers?: number | null;
  lastCheckedAt?: string | null;
  lastHealthyAt?: string | null;
  // live metrics (latest measured; null until first probe/test)
  latestLatencyMs?: number | null;
  latestJitterMs?: number | null;
  latestDownMbps?: number | null;
  latestUpMbps?: number | null;
  lastSpeedTestAt?: string | null;
  /** true while a speed test is queued/running (speed_test_requested_at set) */
  pendingTest?: boolean;
  /** set when this outbound is a config that belongs to a subscription */
  subscriptionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOutboundSubscriptionUserInfo {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
}

export interface AdminOutboundSubscriptionSummary {
  id: string;
  name: string;
  routeGroup: string;
  profileTitle?: string | null;
  updateIntervalHours?: number | null;
  userInfo: AdminOutboundSubscriptionUserInfo;
  enabled: boolean;
  configCount: number;
  lastFetchedAt?: string | null;
  lastStatus: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminConnectionSummary {
  id: string;
  /** display name — customer name, or client email, or wg peer label */
  label: string;
  protocol: string; // vless | wireguard
  transport: string; // ws | tcp | wireguard
  inboundTag: string;
  customerName?: string | null;
  status?: string | null;
  online: boolean;
  usedBytes: number;
}

export interface AdminConnectionsResponse {
  connections: AdminConnectionSummary[];
  available: boolean;
}

export interface AdminOperationsOverview {
  /** false when box metrics/xray aren't reachable (e.g. dev) */
  available: boolean;
  cpuPercent: number | null;
  memPercent: number | null;
  /** free storage % on the root filesystem (matches the dashboard's "lowest storage") */
  diskFreePercent: number | null;
  /** users currently online on the xray inbounds */
  activeUsers: number;
  downloadBps: number;
  uploadBps: number;
  downloadTotalBytes: number;
  uploadTotalBytes: number;
}

export interface AdminInboundSummary {
  /** xray inbound tag (e.g. afrows-in, afrows-in-tcp) */
  tag: string;
  protocol: string;
  listen: string;
  port: number;
  network: string;
  security: string;
  /** camouflage/host header (ws Host, tcp http-header host) */
  host?: string | null;
  path?: string | null;
  sni?: string | null;
  /** number of users currently configured on this inbound */
  clientCount: number;
  uplinkBytes: number;
  downlinkBytes: number;
}

export interface AdminInboundsResponse {
  inbounds: AdminInboundSummary[];
  /** false when the box config/xray isn't reachable (e.g. dev) */
  available: boolean;
}

export interface AdminOutboundTestResult {
  outboundId: string;
  status: 'ok' | 'failed' | 'queued';
  latencyMs?: number | null;
  jitterMs?: number | null;
  downMbps?: number | null;
  upMbps?: number | null;
  measuredAt?: string | null;
  message?: string | null;
}

export interface AdminOutboundsAutoTestState {
  enabled: boolean;
  intervalSeconds: number;
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

export interface AdminAuditLogSummary {
  id: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type BackupStatusKind = 'not_configured' | 'healthy' | 'warning' | 'critical';
export type BackupJobStatus = 'unknown' | 'succeeded' | 'failed' | 'running';
export type BackupIssueSeverity = 'warning' | 'critical';

export interface AdminBackupIssueSummary {
  code: string;
  severity: BackupIssueSeverity;
}

export interface AdminBackupRetentionSummary {
  dailyDays: number;
  weeklyWeeks: number;
  monthlyMonths: number;
}

export interface AdminBackupStatusSummary {
  status: BackupStatusKind;
  latestJobStatus: BackupJobStatus;
  monitoringEnabled: boolean;
  statusFileConfigured: boolean;
  statusFileReadable: boolean;
  statusFileUpdatedAt?: string | null;
  latestBackupAt?: string | null;
  latestSuccessfulBackupAt?: string | null;
  latestFailedBackupAt?: string | null;
  latestBackupAgeHours?: number | null;
  maxBackupAgeHours: number;
  encrypted?: boolean | null;
  encryptionRequired: boolean;
  restoreTestedAt?: string | null;
  restoreTestAgeDays?: number | null;
  restoreTestMaxAgeDays: number;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  destinationType?: string | null;
  destinationLabel?: string | null;
  retention: AdminBackupRetentionSummary;
  artifacts: string[];
  issues: AdminBackupIssueSummary[];
  updatedAt: string;
}

export type BackupRestoreReadinessStatus = 'ready' | 'warning' | 'blocked';
export type BackupRestoreExecutionStatus = 'disabled' | 'ready';
export type BackupRestoreCheckStatus = 'passed' | 'warning' | 'blocked' | 'future';
export type BackupRestorePlanStepKind =
  | 'verify'
  | 'snapshot'
  | 'maintenance'
  | 'database'
  | 'configuration'
  | 'migration'
  | 'health'
  | 'audit';

export interface AdminBackupRestoreCheckSummary {
  id: string;
  code: string;
  status: BackupRestoreCheckStatus | string;
  blocksRestore: boolean;
  reasonCodes: string[];
}

export interface AdminBackupRestorePlanStepSummary {
  id: string;
  order: number;
  kind: BackupRestorePlanStepKind | string;
  code: string;
  destructive: boolean;
  requiresOfflineWindow: boolean;
  executionEnabled: boolean;
  reasonCodes: string[];
}

export interface AdminBackupRestorePlanSummary {
  generatedAt: string;
  readinessStatus: BackupRestoreReadinessStatus | string;
  executionStatus: BackupRestoreExecutionStatus | string;
  executionEnabled: boolean;
  canExecuteRestore: boolean;
  backupStatus: BackupStatusKind;
  latestSuccessfulBackupAt?: string | null;
  restoreTestedAt?: string | null;
  targetArtifacts: string[];
  blockerReasonCodes: string[];
  warningReasonCodes: string[];
  reasonCodes: string[];
  checks: AdminBackupRestoreCheckSummary[];
  steps: AdminBackupRestorePlanStepSummary[];
  safetyNotes: string[];
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

export type ProtocolServerApplyStatus =
  | 'notRequired'
  | 'blocked'
  | 'planningOnly'
  | 'dryRunReady'
  | 'applyReady';

export type ProtocolServerApplyStepStatus =
  | 'ready'
  | 'blocked'
  | 'future'
  | 'notRequired';

export type ProtocolServerApplyPreflightGateStatus =
  | 'passed'
  | 'blocked'
  | 'future'
  | 'warning'
  | 'notRequired';

export type ProtocolServerApplyPreflightGateKind =
  | 'featureFlag'
  | 'adapter'
  | 'dryRunSafety'
  | 'configMaterial'
  | 'commandPolicy'
  | 'outbound'
  | 'outboundHealth'
  | 'defaultInactive'
  | 'secret'
  | 'serverAccess'
  | 'serverCredential'
  | 'commandRunner'
  | 'rollback'
  | 'audit'
  | 'healthVerification';

export type ProtocolServerApplyStepKind =
  | 'preflight'
  | 'secret'
  | 'serverAccess'
  | 'package'
  | 'config'
  | 'service'
  | 'health'
  | 'rollback';

export type ProtocolServerApplyReason =
  | 'featureFlagDisabled'
  | 'featureFlagReady'
  | 'serverMissing'
  | 'serverAccessMissing'
  | 'serverAccessReady'
  | 'serverAccessMethodUnsupported'
  | 'serverCredentialRefMissing'
  | 'serverCredentialReady'
  | 'serverCredentialInactive'
  | 'serverCredentialKindUnsupported'
  | 'serverCredentialDecryptReady'
  | 'serverCredentialDecryptDisabled'
  | 'secretMissing'
  | 'secretReady'
  | 'secretDecryptReady'
  | 'secretDecryptDisabled'
  | 'configMaterialReady'
  | 'configMaterialMissing'
  | 'commandPolicyReady'
  | 'commandPolicyViolation'
  | 'adapterDryRunOnly'
  | 'adapterMissing'
  | 'adapterReady'
  | 'protocolSupported'
  | 'healthVerifyRequired'
  | 'postApplyHealthRequired'
  | 'auditRequired'
  | 'auditReady'
  | 'defaultInactive'
  | 'maintenanceMode'
  | 'outboundMissing'
  | 'outboundReady'
  | 'outboundEnabled'
  | 'outboundHealthReady'
  | 'outboundHealthUnknown'
  | 'outboundHealthDegraded'
  | 'dryRunSafe'
  | 'dryRunUnsafe'
  | 'liveApplyRequested'
  | 'liveApplyAccepted'
  | 'liveApplySucceeded'
  | 'liveApplyFailed'
  | 'liveApplyBlocked'
  | 'liveExecutorReady'
  | 'liveExecutorMissing'
  | 'liveExecutorDisabled'
  | 'commandRunnerDryRunOnly'
  | 'rollbackRequired'
  | 'rollbackReady'
  | 'dataPlaneReady';

export type ProtocolServerApplyAdapterStatus =
  | 'ready'
  | 'disabled'
  | 'missing'
  | 'unsupported'
  | 'dryRunOnly';

export type ProtocolServerApplyCommandRunnerMode =
  | 'disabled'
  | 'dryRunOnly'
  | 'live';

export interface AdminProtocolServerApplyCommandRunnerSummary {
  id: string;
  label: string;
  mode: ProtocolServerApplyCommandRunnerMode | string;
  liveExecutionEnabled: boolean;
  dryRunOnly: boolean;
  implemented: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
}

export interface AdminProtocolServerApplyAccessBoundarySummary {
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  accessProfileReady: boolean;
  credentialRefPresent: boolean;
  credentialRecordActive: boolean;
  credentialDecryptAllowed: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
}

export interface AdminProtocolServerApplyAdapterSummary {
  id: string;
  label: string;
  status: ProtocolServerApplyAdapterStatus | string;
  protocol?: ProtocolKind | string | null;
  enabled: boolean;
  implemented: boolean;
  dataPlaneReady: boolean;
  supportedProtocols: string[];
  reasonCodes: Array<ProtocolServerApplyReason | string>;
  dryRunSupported: boolean;
  commandRunner: AdminProtocolServerApplyCommandRunnerSummary;
  serverAccessBoundary: AdminProtocolServerApplyAccessBoundarySummary;
}

export interface AdminProtocolServerApplyPreflightGate {
  id: string;
  kind: ProtocolServerApplyPreflightGateKind | string;
  status: ProtocolServerApplyPreflightGateStatus | string;
  blocksDryRun: boolean;
  blocksDataPlane: boolean;
  observedValue?: string | null;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
}

export interface AdminProtocolServerApplyPreflightSummary {
  status: ProtocolServerApplyStatus | string;
  canRecordDryRun: boolean;
  canExecuteDataPlane: boolean;
  passedGateCount: number;
  blockedGateCount: number;
  futureGateCount: number;
  warningGateCount: number;
  blockedReasonCodes: Array<ProtocolServerApplyReason | string>;
  liveApplyBlockedReasonCodes: Array<ProtocolServerApplyReason | string>;
  gates: AdminProtocolServerApplyPreflightGate[];
}

export interface AdminProtocolServerApplyStep {
  id: string;
  kind: ProtocolServerApplyStepKind | string;
  status: ProtocolServerApplyStepStatus | string;
  commandPreviewCount: number;
  dataPlaneMutation: boolean;
  secretSafe: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
}

export interface AdminProtocolServerApplyCommand {
  id: string;
  kind: ProtocolServerApplyStepKind | string;
  command: string;
  requiresRoot: boolean;
  dataPlaneMutation: boolean;
  secretSafe: boolean;
  allowlisted: boolean;
  timeoutSeconds: number;
}

export interface AdminProtocolServerApplyConfigChange {
  id: string;
  kind: ProtocolServerApplyStepKind | string;
  filePath: string;
  action: 'create' | 'update' | 'validate' | string;
  dataPlaneMutation: boolean;
  secretSafe: boolean;
}

export interface AdminProtocolServerApplyExecutionStepSummary {
  id: string;
  kind: ProtocolServerApplyStepKind | string;
  status: 'succeeded' | 'failed' | 'skipped' | string;
  exitCode?: number | null;
  durationMs: number;
  dataPlaneMutation: boolean;
  timedOut: boolean;
}

export interface AdminProtocolServerApplyExecutionSummary {
  status: 'accepted' | 'succeeded' | 'failed' | 'rolledBack' | string;
  executor: 'openssh' | string;
  startedAt: string;
  finishedAt: string;
  stagedConfigPath: string;
  configPath: string;
  commandCount: number;
  successfulCommandCount: number;
  failedCommandId?: string | null;
  rollbackAttempted: boolean;
  rollbackSucceeded?: boolean | null;
  dataPlaneMutationExecuted: boolean;
  steps: AdminProtocolServerApplyExecutionStepSummary[];
}

export interface AdminProtocolServerApplyPlanSummary {
  status: ProtocolServerApplyStatus | string;
  generatedAt: string;
  protocol: ProtocolKind | string;
  profile: ProtocolProfile | string;
  routeGroup: string;
  outboundId?: string | null;
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  featureFlagEnabled: boolean;
  adapterImplemented: boolean;
  dataPlaneReady: boolean;
  canExecute: boolean;
  configMaterialReady: boolean;
  configMaterialMissingFields: string[];
  commandPolicyReady: boolean;
  commandPolicyViolations: string[];
  requiresSecret: boolean;
  hasSecretRef: boolean;
  secretDecryptAllowed: boolean;
  requiresServerAccess: boolean;
  hasServerAccess: boolean;
  commandCount: number;
  configChangeCount: number;
  secretSafe: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
  adapter: AdminProtocolServerApplyAdapterSummary;
  preflight: AdminProtocolServerApplyPreflightSummary;
  steps: AdminProtocolServerApplyStep[];
  commands: AdminProtocolServerApplyCommand[];
  configChanges: AdminProtocolServerApplyConfigChange[];
}

export type ProtocolServerApplyMode = 'dryRun' | 'live';

export interface AdminProtocolServerApplyDryRunSnapshot {
  generatedAt: string;
  protocolSetupId: string;
  protocol: ProtocolKind | string;
  profile: ProtocolProfile | string;
  routeGroup: string;
  outboundId?: string | null;
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  applyMode: ProtocolServerApplyMode | string;
  applyStatus: string;
  liveApply: boolean;
  dataPlaneMutationExecuted: boolean;
  featureFlagEnabled: boolean;
  adapterImplemented: boolean;
  dataPlaneReady: boolean;
  canExecute: boolean;
  configMaterialReady: boolean;
  configMaterialMissingFields: string[];
  commandPolicyReady: boolean;
  commandPolicyViolations: string[];
  requiresSecret: boolean;
  hasSecretRef: boolean;
  secretDecryptAllowed: boolean;
  requiresServerAccess: boolean;
  hasServerAccess: boolean;
  commandCount: number;
  configChangeCount: number;
  secretSafe: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
  adapter: AdminProtocolServerApplyAdapterSummary;
  preflight: AdminProtocolServerApplyPreflightSummary;
  steps: AdminProtocolServerApplyStep[];
  commands: AdminProtocolServerApplyCommand[];
  configChanges: AdminProtocolServerApplyConfigChange[];
  execution?: AdminProtocolServerApplyExecutionSummary | null;
}

export interface AdminProtocolServerApplyEventSummary {
  id: string;
  protocolSetupId: string;
  protocolSetupName?: string | null;
  protocol?: ProtocolKind | string | null;
  profile?: ProtocolProfile | string | null;
  routeGroup?: string | null;
  outboundId?: string | null;
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  applyMode: ProtocolServerApplyMode | string;
  applyStatus: string;
  featureFlagEnabled: boolean;
  adapterImplemented: boolean;
  canExecute: boolean;
  commandCount: number;
  configChangeCount: number;
  secretSafe: boolean;
  reasonCodes: Array<ProtocolServerApplyReason | string>;
  dryRunSnapshot?: AdminProtocolServerApplyDryRunSnapshot | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface AdminProtocolServerApplyEventDetail extends AdminProtocolServerApplyEventSummary {
  dryRunSnapshot: AdminProtocolServerApplyDryRunSnapshot | null;
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
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  targetServerAccessReady?: boolean;
  provisionedOutboundId?: string | null;
  provisionedAt?: string | null;
  serverApplyPlan?: AdminProtocolServerApplyPlanSummary | null;
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
  targetServerId?: string | null;
}

export interface RecordProtocolServerApplyRequest {
  applyMode?: 'dryRun';
}

export interface RequestProtocolServerApplyRequest {
  applyMode?: 'live';
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
  | 'mtu'
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
  pathMtuBytes?: number | null;
  recommendedTunnelMtuBytes?: number | null;
  configuredMtuBytes?: number | null;
  mtuStatus?: RouteMtuStatus | string | null;
  mtuRecommendation?: RouteMtuRecommendation | string | null;
  mtuSessionSafe?: boolean | null;
  mtuReasonCodes?: string[];
  loadPercent?: number | null;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  serverCountry?: string | null;
  serverRegion?: string | null;
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

export type AdminReportRiskLevel = 'good' | 'watch' | 'risk' | 'critical';

export interface AdminReportServerSummary {
  total: number;
  healthy: number;
  degraded: number;
  critical: number;
  unknown: number;
}

export interface AdminReportOutboundSummary {
  total: number;
  healthy: number;
  degraded: number;
  critical: number;
  maintenance: number;
  disabled: number;
}

export interface AdminReportAlertSummary {
  open: number;
  critical: number;
  warning: number;
}

export interface AdminReportBackupSummary {
  status: BackupStatusKind | string;
  issueCount: number;
  criticalIssueCount: number;
  warningIssueCount: number;
  latestSuccessfulBackupAt?: string | null;
  restoreTestedAt?: string | null;
}

export interface AdminReportRouteQualitySummary {
  routeGroup: string;
  rangeHours: number;
  windowCount: number;
  recommendationCount: number;
  bestWindowCount: number;
  degradedWindowCount: number;
  upcomingDegradedWindowCount: number;
  insufficientData: boolean;
  topRecommendations: RouteQualityRecommendation[];
}

export interface AdminReportsSummaryResponse {
  generatedAt: string;
  rangeHours: number;
  riskLevel: AdminReportRiskLevel | string;
  riskScore: number;
  reasonCodes: string[];
  servers: AdminReportServerSummary;
  outbounds: AdminReportOutboundSummary;
  alerts: AdminReportAlertSummary;
  backups: AdminReportBackupSummary;
  routeQuality: AdminReportRouteQualitySummary;
}

export interface RouteHealthHistoryPoint {
  routeGroup: string;
  bucketStart: string;
  serverExternalId: string;
  serverHostname?: string | null;
  outboundId?: string | null;
  outboundKey?: string | null;
  outboundName?: string | null;
  operator?: string | null;
  protocol: RouteProbeProtocol | string;
  scoreProfile?: RouteScoreProfile | string | null;
  sampleCount: number;
  averageScore: number;
  averageLatencyMs?: number | null;
  averageJitterMs?: number | null;
  averagePacketLossPercent?: number | null;
  degradedSamplePercent: number;
  criticalSamplePercent: number;
  healthStatus: HealthState;
}

export interface AdminRouteHealthHistoryResponse {
  routeGroup: string;
  rangeHours: number;
  generatedAt: string;
  points: RouteHealthHistoryPoint[];
}

export type AdminIncidentTimelineEventKind =
  | 'alert_opened'
  | 'alert_resolved'
  | 'route_decision'
  | 'route_assignment';

export type AdminIncidentTimelineSeverity = 'critical' | 'warning' | 'info';

export interface AdminIncidentTimelineEvent {
  id: string;
  kind: AdminIncidentTimelineEventKind | string;
  severity: AdminIncidentTimelineSeverity | string;
  title: string;
  detail: string;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  routeGroup?: string | null;
  outboundName?: string | null;
  actorId?: string | null;
  occurredAt: string;
  status?: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface AdminIncidentTimelineResponse {
  generatedAt: string;
  rangeHours: number;
  events: AdminIncidentTimelineEvent[];
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
  pathMtuBytes?: number | null;
  recommendedTunnelMtuBytes?: number | null;
  configuredMtuBytes?: number | null;
  mtuStatus?: RouteMtuStatus | string | null;
  mtuRecommendation?: RouteMtuRecommendation | string | null;
  mtuSessionSafe?: boolean | null;
  mtuReasonCodes?: string[];
  loadPercent?: number | null;
  serverCountry?: string | null;
  serverRegion?: string | null;
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
  | 'preferenceMismatch'
  | 'belowHysteresis';

export interface AdminRouteDecisionCandidateReviewSummary extends AdminRouteDecisionCandidateSummary {
  disposition: RouteDecisionCandidateDisposition | string;
  scoreDeltaFromCurrent?: number | null;
  reviewReasonCodes: string[];
  scoreReasons?: RouteScoreReason[];
}

export interface AdminRouteDecisionClientPreferenceSummary {
  source: 'clientRoutePreference';
  clientConfigId: string;
  routeGroup: string;
  assignmentKey: string;
  mode: ClientRoutePreferenceMode | string;
  detectedCountryCode?: string | null;
  detectedCountrySource?: ClientRouteCountryDetectionSource | string | null;
  preferredExitCountryCode?: string | null;
  preferredOutboundId?: string | null;
  preferredOutboundName?: string | null;
  scoreProfile?: RouteScoreProfile | string | null;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
  preferredCountryCandidateCount: number;
  preferredCountryAvailable: boolean;
  preferredOutboundAvailable: boolean;
  reasonCodes: string[];
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

export type RouteDecisionSwitchRolloutEvaluationStatus =
  | 'notRequired'
  | 'blocked'
  | 'planningOnly'
  | 'hold'
  | 'canaryReady'
  | 'expandReady'
  | 'rollbackRecommended';

export type RouteDecisionSwitchRolloutEvaluationAction =
  | 'none'
  | 'manualReview'
  | 'hold'
  | 'startCanary'
  | 'expandCanary'
  | 'rollback';

export type RouteDecisionSwitchRolloutEvaluationReason =
  | 'noSwitchNeeded'
  | 'rolloutBlocked'
  | 'dataPlaneDisabled'
  | 'preflightBlocked'
  | 'guardPassed'
  | 'healthUnknown'
  | 'lossGuardTriggered'
  | 'jitterGuardTriggered'
  | 'latencyGuardTriggered'
  | 'scoreTooLow'
  | 'routeConsistencyHold'
  | 'canaryReady'
  | 'expansionReady'
  | 'gamingSensitive'
  | 'manualReviewRequired';

export interface AdminRouteDecisionSwitchRolloutEvaluationSummary {
  status: RouteDecisionSwitchRolloutEvaluationStatus | string;
  recommendedAction: RouteDecisionSwitchRolloutEvaluationAction | string;
  evaluatedAt: string;
  dataPlaneReady: boolean;
  guardPassed: boolean;
  routeConsistencyHoldActive: boolean;
  canaryPercent: number;
  nextPercent: number;
  maxPercent: number;
  holdSecondsRemaining: number;
  observedLossPercent?: number | null;
  observedJitterMs?: number | null;
  observedLatencyMs?: number | null;
  observedScore?: number | null;
  reasonCodes: Array<RouteDecisionSwitchRolloutEvaluationReason | string>;
}

export type RouteDecisionSwitchOrchestrationStatus =
  | 'notRequired'
  | 'blocked'
  | 'assignmentOnly'
  | 'planningOnly'
  | 'holding'
  | 'canaryReady'
  | 'expandReady'
  | 'rollbackRecommended'
  | 'dataPlaneReady';

export type RouteDecisionSwitchOrchestrationPhase =
  | 'noChange'
  | 'guard'
  | 'assignment'
  | 'pinExisting'
  | 'canary'
  | 'drain'
  | 'verify'
  | 'expand'
  | 'rollback';

export type RouteDecisionSwitchOrchestrationAction =
  | 'none'
  | 'recordDecision'
  | 'hold'
  | 'startCanary'
  | 'expandCanary'
  | 'rollback'
  | 'manualReview';

export type RouteDecisionSwitchOrchestrationStageStatus =
  | 'ready'
  | 'future'
  | 'blocked'
  | 'hold'
  | 'notRequired';

export type RouteDecisionSwitchOrchestrationReason =
  | 'noSwitchNeeded'
  | 'routeLock'
  | 'manualMode'
  | 'cooldownActive'
  | 'assignmentOnly'
  | 'dataPlaneDisabled'
  | 'preflightBlocked'
  | 'rolloutBlocked'
  | 'guardPassed'
  | 'healthUnknown'
  | 'rollbackGuard'
  | 'stickySessions'
  | 'newSessionsOnly'
  | 'drainSafe'
  | 'canaryRequired'
  | 'routeConsistencyHold'
  | 'gamingSensitive'
  | 'auditRequired'
  | 'dataPlaneReady';

export interface AdminRouteDecisionSwitchOrchestrationStage {
  id: string;
  phase: RouteDecisionSwitchOrchestrationPhase | string;
  code: string;
  status: RouteDecisionSwitchOrchestrationStageStatus | string;
  trafficScope: RouteDecisionSwitchRolloutTrafficScope | string;
  sessionImpact: RouteDecisionSwitchEngineSessionImpact | string;
  targetPercent: number;
  targetOutboundId?: string | null;
  dataPlaneMutation: boolean;
  estimatedSeconds?: number | null;
  reasonCodes: Array<RouteDecisionSwitchOrchestrationReason | string>;
}

export interface AdminRouteDecisionSwitchOrchestrationSummary {
  status: RouteDecisionSwitchOrchestrationStatus | string;
  phase: RouteDecisionSwitchOrchestrationPhase | string;
  recommendedAction: RouteDecisionSwitchOrchestrationAction | string;
  generatedAt: string;
  dataPlaneReady: boolean;
  canExecuteDataPlane: boolean;
  assignmentOnly: boolean;
  routeLocked: boolean;
  cooldownActive: boolean;
  preserveExistingSessions: boolean;
  switchNewSessionsOnly: boolean;
  activeSessionsProtected: boolean;
  activeSessionsMayMove: boolean;
  canaryPercent: number;
  nextPercent: number;
  holdSecondsRemaining: number;
  rollbackRequired: boolean;
  stageCount: number;
  reasonCodes: Array<RouteDecisionSwitchOrchestrationReason | string>;
  stages: AdminRouteDecisionSwitchOrchestrationStage[];
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
  clientRoutePreference?: AdminRouteDecisionClientPreferenceSummary | null;
  currentCandidate?: AdminRouteDecisionCandidateSummary | null;
  recommendedCandidate?: AdminRouteDecisionCandidateSummary | null;
  candidateReviews: AdminRouteDecisionCandidateReviewSummary[];
  profileRecommendations: AdminRouteDecisionProfileRecommendation[];
  loadBalancing: AdminRouteDecisionLoadBalancingSummary;
  sessionSafety: AdminRouteDecisionSessionSafetySummary;
  switchEngine: AdminRouteDecisionSwitchEngineSummary;
  switchPreflight: AdminRouteDecisionSwitchPreflightSummary;
  switchRollout: AdminRouteDecisionSwitchRolloutSummary;
  switchRolloutEvaluation: AdminRouteDecisionSwitchRolloutEvaluationSummary;
  switchOrchestration: AdminRouteDecisionSwitchOrchestrationSummary;
  applyPlan: AdminRouteDecisionApplyPlanSummary;
  scoreDelta?: number | null;
  action: RouteDecisionAction;
  reasonCodes: string[];
  candidateCount: number;
  healthyCandidateCount: number;
  managedCandidateCount: number;
}

export interface AdminRouteCanaryStatusResponse {
  routeGroup: string;
  assignmentKey: string;
  generatedAt: string;
  mode: RouteSelectionMode | string;
  autoRouteEnabled: boolean;
  routeLocked: boolean;
  cooldownActive: boolean;
  cooldownUntil?: string | null;
  selectedScoreProfile?: RouteScoreProfile | string;
  action: RouteDecisionAction;
  recommendedAction: RouteDecisionSwitchOrchestrationAction | string;
  dataPlaneReady: boolean;
  canExecuteDataPlane: boolean;
  assignmentOnly: boolean;
  guardReady: boolean;
  canaryReady: boolean;
  currentCandidate?: AdminRouteDecisionCandidateSummary | null;
  recommendedCandidate?: AdminRouteDecisionCandidateSummary | null;
  switchRollout: AdminRouteDecisionSwitchRolloutSummary;
  switchRolloutEvaluation: AdminRouteDecisionSwitchRolloutEvaluationSummary;
  switchOrchestration: AdminRouteDecisionSwitchOrchestrationSummary;
  reasonCodes: string[];
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
  switchRolloutEvaluation?: AdminRouteDecisionSwitchRolloutEvaluationSummary | null;
  switchOrchestration?: AdminRouteDecisionSwitchOrchestrationSummary | null;
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

export interface AdminProtocolServerApplyEventsResponse {
  events: AdminProtocolServerApplyEventSummary[];
}

export interface AdminProtocolServerApplyEventDetailResponse {
  event: AdminProtocolServerApplyEventDetail;
}

export interface ProvisionProtocolSetupResponse {
  protocolSetup: AdminProtocolSetupSummary;
  outbound: AdminOutboundSummary;
  serverApplyPlan: AdminProtocolServerApplyPlanSummary;
}

export interface RecordProtocolServerApplyResponse {
  event: AdminProtocolServerApplyEventDetail;
  protocolSetup: AdminProtocolSetupSummary;
  serverApplyPlan: AdminProtocolServerApplyPlanSummary;
}

export interface RequestProtocolServerApplyResponse {
  event: AdminProtocolServerApplyEventDetail;
  protocolSetup: AdminProtocolSetupSummary;
  serverApplyPlan: AdminProtocolServerApplyPlanSummary;
  liveApplyRequested: boolean;
  liveApplyAccepted: boolean;
  dataPlaneMutationExecuted: boolean;
  blockedReasonCodes: Array<ProtocolServerApplyReason | string>;
}

export interface AdminServersResponse {
  servers: AdminServerSummary[];
}

export interface AdminCustomerAccountsResponse {
  accounts: AdminCustomerAccountSummary[];
}

export interface AdminResellerAccountsResponse {
  resellers: AdminResellerAccountSummary[];
}

export interface AdminResellerWalletLedgerResponse {
  entries: AdminResellerWalletLedgerEntry[];
}

export interface AdminResellerWalletActionResponse {
  reseller: AdminResellerAccountSummary;
  ledgerEntry: AdminResellerWalletLedgerEntry;
}

export interface AdminResellerPackageQuoteResponse {
  quote: AdminResellerPackageQuote;
}

export interface AdminResellerPackageSaleResponse {
  allocation: AdminPaymentOrderAllocationSummary;
  customerAccount: AdminCustomerAccountDetail;
  duplicate: boolean;
  ledgerEntry: AdminResellerWalletLedgerEntry;
  paymentOrder: AdminPaymentOrderSummary;
  quote: AdminResellerPackageQuote;
  reseller: AdminResellerAccountSummary;
}

export interface AdminResellerWorkspaceResponse {
  workspace: AdminResellerWorkspaceSummary;
}

export interface AdminClientRoutePreferenceResponse {
  routePreference: AdminClientRoutePreferenceSummary;
}

export interface AdminClientAccessTokensResponse {
  tokens: ClientAccessTokenSummary[];
}

export interface AdminClientSubscriptionCredentialsResponse {
  credentials: AdminClientSubscriptionCredentialSummary[];
}

export interface AdminClientSubscriptionCredentialResponse {
  credential: AdminClientSubscriptionCredentialSummary;
}

export interface AdminIssueClientAccessTokenResponse {
  token: IssuedClientAccessTokenSummary;
}

export interface AdminClientUsageEventsResponse {
  events: AdminClientUsageEventSummary[];
}

export interface AdminRecordClientUsageResponse {
  usageEvent: AdminClientUsageEventSummary;
  clientConfig: AdminClientConfigSummary;
  account: AdminCustomerAccountSummary;
  duplicate: boolean;
}

export interface ClientPortalProfileResponse {
  account: ClientPortalAccountSummary;
  clientConfig: ClientPortalConfigSummary;
  routePreference: ClientRoutePreferenceSummary;
}

export interface ClientRoutePreferenceResponse {
  routePreference: ClientRoutePreferenceSummary;
}

export interface ClientRouteOptionsResponse {
  routeGroup: string;
  countries: ClientRouteCountryOption[];
  outbounds: ClientRouteOutboundOption[];
}

export interface ClientSubscriptionSummary {
  clientConfigId: string;
  routeGroup: string;
  generatedAt: string;
  chargedRemainingBytes?: number | null;
  endpoints: ClientSubscriptionEndpointSummary[];
  configLinks: ClientSubscriptionConfigLinkSummary[];
}

export interface ClientSubscriptionResponse {
  subscription: ClientSubscriptionSummary;
}

export interface AdminBillingSettingsResponse {
  settings: AdminBillingSettingsSummary;
}

export interface AdminRewardedAdSettingsResponse {
  rewardedAds: AdminRewardedAdSettingsSummary;
}

export interface AdminVolumePackagesResponse {
  packages: AdminVolumePackageSummary[];
}

export interface AdminPaymentMethodsResponse {
  paymentMethods: AdminPaymentMethodSummary[];
}

export interface AdminPaymentOrdersResponse {
  paymentOrders: AdminPaymentOrderSummary[];
}

export interface AdminBillingCatalogResponse {
  settings: AdminBillingSettingsSummary;
  packages: AdminVolumePackageSummary[];
  paymentMethods: AdminPaymentMethodSummary[];
  paymentProviderAdapters: AdminPaymentProviderAdapterSummary[];
}

export interface AdminOutboundsResponse {
  outbounds: AdminOutboundSummary[];
}

export interface AdminServerInterfacesResponse {
  interfaces: AdminServerInterfaceSummary[];
}

export interface AdminTunnelsResponse {
  tunnels: AdminTunnelSummary[];
}

export interface RouteFailoverEventsResponse {
  events: RouteFailoverEventSummary[];
}

export interface AdminAlertsResponse {
  alerts: AdminAlertSummary[];
}

export interface AdminAuditLogsResponse {
  auditLogs: AdminAuditLogSummary[];
}

export interface AdminBackupStatusResponse {
  backup: AdminBackupStatusSummary;
}

export interface AdminBackupRestorePlanResponse {
  restorePlan: AdminBackupRestorePlanSummary;
}
