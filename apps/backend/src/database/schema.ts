import { relations, sql } from 'drizzle-orm';
import {
  bigserial,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const servers = pgTable(
  'servers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: text('external_id').notNull(),
    hostname: text('hostname'),
    platform: text('platform'),
    country: text('country'),
    region: text('region'),
    role: text('role'),
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    status: text('status').notNull().default('unknown'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex('servers_external_id_idx').on(table.externalId),
    statusIdx: index('servers_status_idx').on(table.status),
  }),
);

export const serverMetrics = pgTable(
  'server_metrics',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    cpuPercent: real('cpu_percent'),
    ramPercent: real('ram_percent'),
    diskFreePercent: real('disk_free_percent'),
    inboundBps: real('inbound_bps'),
    outboundBps: real('outbound_bps'),
    pingMs: real('ping_ms'),
    jitterMs: real('jitter_ms'),
    packetLossPercent: real('packet_loss_percent'),
    healthScore: integer('health_score').notNull(),
    raw: jsonb('raw').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    serverObservedIdx: index('server_metrics_server_observed_idx').on(table.serverId, table.observedAt),
    observedIdx: index('server_metrics_observed_idx').on(table.observedAt),
  }),
);

export const routeQualityHourly = pgTable(
  'route_quality_hourly',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeGroup: text('route_group').notNull().default('main'),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    outboundId: uuid('outbound_id'),
    outboundKey: text('outbound_key').notNull().default('unassigned'),
    outboundName: text('outbound_name'),
    operator: text('operator').notNull().default('unknown'),
    protocol: text('protocol').notNull(),
    scoreProfile: text('score_profile').notNull().default('balanced'),
    bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
    hourOfDay: integer('hour_of_day').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    sampleCount: integer('sample_count').notNull(),
    averageScore: real('average_score').notNull(),
    averageLatencyMs: real('average_latency_ms'),
    averageJitterMs: real('average_jitter_ms'),
    averagePacketLossPercent: real('average_packet_loss_percent'),
    degradedSamplePercent: real('degraded_sample_percent').notNull().default(0),
    criticalSamplePercent: real('critical_sample_percent').notNull().default(0),
    firstObservedAt: timestamp('first_observed_at', { withTimezone: true }).notNull(),
    lastObservedAt: timestamp('last_observed_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('route_quality_hourly_unique_idx').on(
      table.routeGroup,
      table.serverId,
      table.outboundKey,
      table.operator,
      table.protocol,
      table.scoreProfile,
      table.bucketStart,
    ),
    routeBucketIdx: index('route_quality_hourly_route_bucket_idx').on(table.routeGroup, table.bucketStart),
    serverProtocolIdx: index('route_quality_hourly_server_protocol_idx').on(
      table.serverId,
      table.protocol,
      table.bucketStart,
    ),
    patternIdx: index('route_quality_hourly_pattern_idx').on(
      table.routeGroup,
      table.protocol,
      table.dayOfWeek,
      table.hourOfDay,
    ),
    profilePatternIdx: index('route_quality_hourly_profile_pattern_idx').on(
      table.routeGroup,
      table.scoreProfile,
      table.dayOfWeek,
      table.hourOfDay,
    ),
    outboundPatternIdx: index('route_quality_hourly_outbound_pattern_idx').on(
      table.routeGroup,
      table.outboundKey,
      table.operator,
      table.dayOfWeek,
      table.hourOfDay,
    ),
  }),
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    severity: text('severity').notNull(),
    status: text('status').notNull().default('open'),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    statusSeverityIdx: index('alerts_status_severity_idx').on(table.status, table.severity),
    sourceIdx: index('alerts_source_idx').on(table.sourceType, table.sourceId),
    openSourceTitleIdx: uniqueIndex('alerts_open_source_title_idx')
      .on(table.sourceType, table.sourceId, table.title)
      .where(sql`status = 'open'`),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionCreatedIdx: index('audit_logs_action_created_idx').on(table.action, table.createdAt),
    targetIdx: index('audit_logs_target_idx').on(table.targetType, table.targetId),
  }),
);

export const adminUsers = pgTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    usernameNormalized: text('username_normalized').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    source: text('source').notNull().default('database'),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usernameNormalizedIdx: uniqueIndex('admin_users_username_normalized_idx').on(table.usernameNormalized),
    roleStatusIdx: index('admin_users_role_status_idx').on(table.role, table.status),
    createdAtIdx: index('admin_users_created_at_idx').on(table.createdAt),
  }),
);

export const agentTokens = pgTable(
  'agent_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: jsonb('scopes').notNull().default(sql`'["metrics:write"]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('agent_tokens_token_hash_idx').on(table.tokenHash),
    serverIdx: index('agent_tokens_server_idx').on(table.serverId),
    serverActiveIdx: index('agent_tokens_server_active_idx').on(table.serverId, table.createdAt).where(sql`revoked_at IS NULL`),
  }),
);

export const serverCredentials = pgTable(
  'server_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    encryptedPayload: text('encrypted_payload').notNull(),
    keyId: text('key_id').notNull(),
    fingerprint: text('fingerprint'),
    status: text('status').notNull().default('active'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverIdx: index('server_credentials_server_idx').on(table.serverId),
    statusIdx: index('server_credentials_status_idx').on(table.status),
  }),
);

export const secretRecords = pgTable(
  'secret_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    secretRef: text('secret_ref').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    scope: text('scope').notNull().default('settings'),
    routeGroup: text('route_group'),
    protocol: text('protocol'),
    encryptedPayload: text('encrypted_payload').notNull(),
    keyId: text('key_id').notNull(),
    fingerprint: text('fingerprint'),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    refIdx: uniqueIndex('secret_records_ref_idx').on(table.secretRef),
    scopeIdx: index('secret_records_scope_idx').on(table.scope, table.routeGroup),
    statusIdx: index('secret_records_status_idx').on(table.status),
    protocolIdx: index('secret_records_protocol_idx').on(table.protocol),
  }),
);

export const telegramBotSettings = pgTable(
  'telegram_bot_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    settingKey: text('setting_key').notNull().default('default'),
    botTokenSecretRef: text('bot_token_secret_ref'),
    webhookSecretRef: text('webhook_secret_ref'),
    alertChatId: text('alert_chat_id'),
    allowedAdminChatIds: jsonb('allowed_admin_chat_ids').notNull().default(sql`'[]'::jsonb`),
    alertsEnabled: boolean('alerts_enabled').notNull().default(false),
    commandsEnabled: boolean('commands_enabled').notNull().default(false),
    botId: text('bot_id'),
    botUsername: text('bot_username'),
    botFirstName: text('bot_first_name'),
    lastTestStatus: text('last_test_status'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestErrorCode: text('last_test_error_code'),
    lastTestDurationMs: integer('last_test_duration_ms'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    settingKeyIdx: uniqueIndex('telegram_bot_settings_key_idx').on(table.settingKey),
    botTokenRefIdx: index('telegram_bot_settings_token_ref_idx').on(table.botTokenSecretRef),
    webhookRefIdx: index('telegram_bot_settings_webhook_ref_idx').on(table.webhookSecretRef),
  }),
);

export const tenantBrandSettings = pgTable(
  'tenant_brand_settings',
  {
    settingKey: text('setting_key').primaryKey(),
    tenantSlug: text('tenant_slug').notNull().default('default'),
    displayName: text('display_name').notNull().default('AfroGate'),
    legalName: text('legal_name'),
    supportEmail: text('support_email'),
    supportTelegram: text('support_telegram'),
    supportUrl: text('support_url'),
    logoUrl: text('logo_url'),
    dashboardTitle: text('dashboard_title').notNull().default('AfroGate'),
    clientAppTitle: text('client_app_title').notNull().default('AfroGate Client'),
    primaryColor: text('primary_color').notNull().default('#176B87'),
    accentColor: text('accent_color').notNull().default('#0E9F8F'),
    publicBrandingEnabled: boolean('public_branding_enabled').notNull().default(true),
    clientSupportMessage: text('client_support_message'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSlugIdx: uniqueIndex('tenant_brand_settings_slug_idx').on(table.tenantSlug),
  }),
);

export const serverAccessProfiles = pgTable(
  'server_access_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    sshPort: integer('ssh_port').notNull().default(22),
    username: text('username').notNull().default('afrogate'),
    accessMethod: text('access_method').notNull().default('ssh_key'),
    credentialRef: text('credential_ref'),
    bootstrapState: text('bootstrap_state').notNull().default('not_started'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestStatus: text('last_test_status'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverIdx: uniqueIndex('server_access_profiles_server_idx').on(table.serverId),
    bootstrapStateIdx: index('server_access_profiles_bootstrap_state_idx').on(table.bootstrapState),
  }),
);

export const serverInterfaces = pgTable(
  'server_interfaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    operator: text('operator'),
    kind: text('kind').notNull().default('ethernet'),
    status: text('status').notNull().default('unknown'),
    macAddress: text('mac_address'),
    addressCidr: text('address_cidr'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverNameIdx: uniqueIndex('server_interfaces_server_name_unique').on(table.serverId, table.name),
    serverIdx: index('server_interfaces_server_idx').on(table.serverId),
    operatorIdx: index('server_interfaces_operator_idx').on(table.operator),
    statusIdx: index('server_interfaces_status_idx').on(table.status),
  }),
);

export const tunnels = pgTable(
  'tunnels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default('wireguard'),
    remoteEndpoint: text('remote_endpoint'),
    interfaceName: text('interface_name'),
    localInterfaceId: uuid('local_interface_id').references(() => serverInterfaces.id, { onDelete: 'set null' }),
    routeGroup: text('route_group').notNull().default('main'),
    status: text('status').notNull().default('unknown'),
    lockable: boolean('lockable').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverNameIdx: uniqueIndex('tunnels_server_name_unique').on(table.serverId, table.name),
    serverIdx: index('tunnels_server_idx').on(table.serverId),
    routeStatusIdx: index('tunnels_route_status_idx').on(table.routeGroup, table.status),
    localInterfaceIdx: index('tunnels_local_interface_idx').on(table.localInterfaceId),
  }),
);

export const outbounds = pgTable(
  'outbounds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    routeGroup: text('route_group').notNull().default('default'),
    priority: integer('priority').notNull().default(1000),
    enabled: boolean('enabled').notNull().default(true),
    maintenanceMode: boolean('maintenance_mode').notNull().default(false),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    secretRef: text('secret_ref'),
    healthStatus: text('health_status').notNull().default('unknown'),
    healthIntervalSeconds: integer('health_interval_seconds').notNull().default(60),
    failThreshold: integer('fail_threshold').notNull().default(3),
    recoveryThreshold: integer('recovery_threshold').notNull().default(3),
    cooldownSeconds: integer('cooldown_seconds').notNull().default(120),
    weight: integer('weight').notNull().default(100),
    usageMultiplier: integer('usage_multiplier').notNull().default(1),
    maxUsers: integer('max_users'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastHealthyAt: timestamp('last_healthy_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverIdx: index('outbounds_server_idx').on(table.serverId),
    routePriorityIdx: index('outbounds_route_priority_idx').on(table.routeGroup, table.priority),
    enabledIdx: index('outbounds_enabled_idx').on(table.enabled),
    healthStatusIdx: index('outbounds_health_status_idx').on(table.healthStatus),
  }),
);

export const outboundHealthChecks = pgTable(
  'outbound_health_checks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    outboundId: uuid('outbound_id')
      .notNull()
      .references(() => outbounds.id, { onDelete: 'cascade' }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status').notNull(),
    latencyMs: real('latency_ms'),
    jitterMs: real('jitter_ms'),
    packetLossPercent: real('packet_loss_percent'),
    message: text('message'),
    details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    outboundCheckedIdx: index('outbound_health_checks_outbound_checked_idx').on(table.outboundId, table.checkedAt),
    statusCheckedIdx: index('outbound_health_checks_status_checked_idx').on(table.status, table.checkedAt),
  }),
);

export const routeFailoverEvents = pgTable(
  'route_failover_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    routeGroup: text('route_group').notNull(),
    fromOutboundId: uuid('from_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    toOutboundId: uuid('to_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    triggerMetric: jsonb('trigger_metric').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routeCreatedIdx: index('route_failover_events_route_created_idx').on(table.routeGroup, table.createdAt),
    toOutboundIdx: index('route_failover_events_to_outbound_idx').on(table.toOutboundId),
  }),
);

export const protocolSetups = pgTable(
  'protocol_setups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    protocol: text('protocol').notNull(),
    profile: text('profile').notNull().default('balanced'),
    routeGroup: text('route_group').notNull().default('main'),
    port: integer('port').notNull(),
    status: text('status').notNull().default('draft'),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    secretRef: text('secret_ref'),
    targetServerId: uuid('target_server_id').references(() => servers.id, { onDelete: 'set null' }),
    provisionedOutboundId: uuid('provisioned_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routeNameIdx: uniqueIndex('protocol_setups_route_name_idx').on(table.routeGroup, table.name),
    protocolIdx: index('protocol_setups_protocol_idx').on(table.protocol),
    statusIdx: index('protocol_setups_status_idx').on(table.status),
    targetServerIdx: index('protocol_setups_target_server_idx').on(table.targetServerId),
    provisionedOutboundIdx: index('protocol_setups_provisioned_outbound_idx').on(table.provisionedOutboundId),
  }),
);

export const protocolApplyEvents = pgTable(
  'protocol_apply_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    protocolSetupId: uuid('protocol_setup_id')
      .notNull()
      .references(() => protocolSetups.id, { onDelete: 'cascade' }),
    outboundId: uuid('outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    targetServerId: uuid('target_server_id').references(() => servers.id, { onDelete: 'set null' }),
    applyMode: text('apply_mode').notNull().default('dryRun'),
    applyStatus: text('apply_status').notNull().default('recorded'),
    featureFlagEnabled: boolean('feature_flag_enabled').notNull().default(false),
    adapterImplemented: boolean('adapter_implemented').notNull().default(false),
    canExecute: boolean('can_execute').notNull().default(false),
    commandCount: integer('command_count').notNull().default(0),
    configChangeCount: integer('config_change_count').notNull().default(0),
    secretSafe: boolean('secret_safe').notNull().default(true),
    reasonCodes: jsonb('reason_codes').notNull().default(sql`'[]'::jsonb`),
    dryRunSnapshot: jsonb('dry_run_snapshot').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    setupCreatedIdx: index('protocol_apply_events_setup_created_idx').on(table.protocolSetupId, table.createdAt),
    targetCreatedIdx: index('protocol_apply_events_target_created_idx').on(table.targetServerId, table.createdAt),
    outboundIdx: index('protocol_apply_events_outbound_idx').on(table.outboundId),
  }),
);

export const customerAccounts = pgTable(
  'customer_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayName: text('display_name'),
    telegramId: text('telegram_id'),
    telegramUsername: text('telegram_username'),
    paidNumberHash: text('paid_number_hash'),
    status: text('status').notNull().default('active'),
    quotaScope: text('quota_scope').notNull().default('account_shared'),
    quotaLimitBytes: bigint('quota_limit_bytes', { mode: 'number' }),
    perClientLimitBytes: bigint('per_client_limit_bytes', { mode: 'number' }),
    usedBytes: bigint('used_bytes', { mode: 'number' }).notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    telegramIdIdx: uniqueIndex('customer_accounts_telegram_id_unique')
      .on(table.telegramId)
      .where(sql`telegram_id IS NOT NULL AND telegram_id <> ''`),
    paidNumberHashIdx: uniqueIndex('customer_accounts_paid_number_hash_unique')
      .on(table.paidNumberHash)
      .where(sql`paid_number_hash IS NOT NULL AND paid_number_hash <> ''`),
    statusIdx: index('customer_accounts_status_idx').on(table.status),
    quotaScopeIdx: index('customer_accounts_quota_scope_idx').on(table.quotaScope),
  }),
);

export const clientConfigs = pgTable(
  'client_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    protocol: text('protocol').notNull().default('custom'),
    externalPanel: text('external_panel'),
    externalPanelUserId: text('external_panel_user_id'),
    externalPanelConfigId: text('external_panel_config_id'),
    deviceLimit: integer('device_limit'),
    quotaLimitBytes: bigint('quota_limit_bytes', { mode: 'number' }),
    usedBytes: bigint('used_bytes', { mode: 'number' }).notNull().default(0),
    status: text('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('client_configs_customer_account_idx').on(table.customerAccountId),
    statusIdx: index('client_configs_status_idx').on(table.status),
    protocolIdx: index('client_configs_protocol_idx').on(table.protocol),
    externalPanelIdx: index('client_configs_external_panel_idx').on(table.externalPanel, table.externalPanelUserId),
    externalConfigIdx: uniqueIndex('client_configs_external_config_unique')
      .on(table.externalPanel, table.externalPanelConfigId)
      .where(sql`external_panel IS NOT NULL
        AND external_panel <> ''
        AND external_panel_config_id IS NOT NULL
        AND external_panel_config_id <> ''`),
  }),
);

export const clientUsageEvents = pgTable(
  'client_usage_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'cascade' }),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('admin'),
    direction: text('direction').notNull().default('combined'),
    usedBytesDelta: bigint('used_bytes_delta', { mode: 'number' }).notNull(),
    rawUsedBytesDelta: bigint('raw_used_bytes_delta', { mode: 'number' }).notNull(),
    usageMultiplier: integer('usage_multiplier').notNull().default(1),
    ratedOutboundId: uuid('rated_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    rxBytes: bigint('rx_bytes', { mode: 'number' }),
    txBytes: bigint('tx_bytes', { mode: 'number' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    windowStart: timestamp('window_start', { withTimezone: true }),
    windowEnd: timestamp('window_end', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
    externalReference: text('external_reference'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdempotencyIdx: uniqueIndex('client_usage_events_source_idempotency_unique')
      .on(table.source, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND idempotency_key <> ''`),
    clientObservedIdx: index('client_usage_events_client_observed_idx').on(table.clientConfigId, table.observedAt),
    accountObservedIdx: index('client_usage_events_account_observed_idx').on(table.customerAccountId, table.observedAt),
    createdIdx: index('client_usage_events_created_idx').on(table.createdAt),
  }),
);

export const rewardedAdSettings = pgTable('rewarded_ad_settings', {
  settingKey: text('setting_key').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  rewardBytes: bigint('reward_bytes', { mode: 'number' }).notNull().default(104_857_600),
  dailyLimit: integer('daily_limit').notNull().default(20),
  provider: text('provider').notNull().default('mvp_rewarded_ad'),
  verificationMode: text('verification_mode').notNull().default('client_callback_mvp'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rewardedAdGrants = pgTable(
  'rewarded_ad_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'restrict' }),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'restrict' }),
    grantDay: date('grant_day').notNull(),
    dailyGrantNumber: integer('daily_grant_number').notNull(),
    provider: text('provider').notNull().default('mvp_rewarded_ad'),
    adSessionId: text('ad_session_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    rewardBytes: bigint('reward_bytes', { mode: 'number' }).notNull(),
    accountQuotaBeforeBytes: bigint('account_quota_before_bytes', { mode: 'number' }),
    accountQuotaAfterBytes: bigint('account_quota_after_bytes', { mode: 'number' }).notNull(),
    clientQuotaBeforeBytes: bigint('client_quota_before_bytes', { mode: 'number' }),
    clientQuotaAfterBytes: bigint('client_quota_after_bytes', { mode: 'number' }),
    verificationMode: text('verification_mode').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientProviderIdempotencyIdx: uniqueIndex('rewarded_ad_grants_client_provider_idempotency_unique')
      .on(table.clientConfigId, table.provider, table.idempotencyKey),
    providerSessionIdx: uniqueIndex('rewarded_ad_grants_provider_session_unique')
      .on(table.provider, table.adSessionId)
      .where(sql`ad_session_id IS NOT NULL AND ad_session_id <> ''`),
    clientDayCreatedIdx: index('rewarded_ad_grants_client_day_created_idx').on(
      table.clientConfigId,
      table.grantDay,
      table.createdAt,
    ),
    accountCreatedIdx: index('rewarded_ad_grants_account_created_idx').on(table.customerAccountId, table.createdAt),
  }),
);

export const clientRoutePreferences = pgTable(
  'client_route_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    routeGroup: text('route_group').notNull().default('main'),
    mode: text('mode').notNull().default('auto'),
    detectedCountryCode: text('detected_country_code'),
    detectedCountrySource: text('detected_country_source'),
    preferredExitCountryCode: text('preferred_exit_country_code'),
    preferredOutboundId: uuid('preferred_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    scoreProfile: text('score_profile').notNull().default('balanced'),
    autoDetectCountry: boolean('auto_detect_country').notNull().default(true),
    allowClientOverride: boolean('allow_client_override').notNull().default(true),
    routeLocked: boolean('route_locked').notNull().default(false),
    stickySessionProtection: boolean('sticky_session_protection').notNull().default(true),
    lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientRouteIdx: uniqueIndex('client_route_preferences_client_route_unique').on(table.clientConfigId, table.routeGroup),
    preferredCountryIdx: index('client_route_preferences_preferred_country_idx').on(
      table.routeGroup,
      table.preferredExitCountryCode,
    ),
    detectedCountryIdx: index('client_route_preferences_detected_country_idx').on(
      table.routeGroup,
      table.detectedCountryCode,
    ),
    preferredOutboundIdx: index('client_route_preferences_preferred_outbound_idx').on(table.preferredOutboundId),
  }),
);

export const clientAccessTokens = pgTable(
  'client_access_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: jsonb('scopes').notNull().default(sql`'["client:read", "route:write", "reward:claim"]'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    hashIdx: uniqueIndex('client_access_tokens_hash_unique').on(table.tokenHash),
    clientIdx: index('client_access_tokens_client_idx').on(table.clientConfigId, table.createdAt),
    activeIdx: index('client_access_tokens_active_idx').on(table.clientConfigId).where(sql`revoked_at IS NULL`),
  }),
);

export const clientSubscriptionCredentials = pgTable(
  'client_subscription_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    outboundId: uuid('outbound_id')
      .notNull()
      .references(() => outbounds.id, { onDelete: 'cascade' }),
    name: text('name'),
    protocol: text('protocol').notNull(),
    encryptedPayload: text('encrypted_payload').notNull(),
    keyId: text('key_id').notNull(),
    fingerprint: text('fingerprint'),
    publicMetadata: jsonb('public_metadata').notNull().default(sql`'{}'::jsonb`),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeUnique: uniqueIndex('client_subscription_credentials_active_unique')
      .on(table.clientConfigId, table.outboundId, table.protocol)
      .where(sql`revoked_at IS NULL`),
    clientIdx: index('client_subscription_credentials_client_idx').on(table.clientConfigId, table.createdAt),
    outboundIdx: index('client_subscription_credentials_outbound_idx').on(table.outboundId),
    statusIdx: index('client_subscription_credentials_status_idx').on(table.status, table.revokedAt),
  }),
);

export const billingSettings = pgTable('billing_settings', {
  settingKey: text('setting_key').primaryKey(),
  currency: text('currency').notNull().default('toman'),
  pricePerGb: bigint('price_per_gb', { mode: 'number' }).notNull().default(0),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const volumePackages = pgTable(
  'volume_packages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    volumeBytes: bigint('volume_bytes', { mode: 'number' }).notNull(),
    durationDays: integer('duration_days'),
    pricePerGb: bigint('price_per_gb', { mode: 'number' }).notNull().default(0),
    totalPrice: bigint('total_price', { mode: 'number' }).notNull().default(0),
    currency: text('currency').notNull().default('toman'),
    status: text('status').notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(1000),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('volume_packages_slug_unique').on(table.slug),
    statusSortIdx: index('volume_packages_status_sort_idx').on(table.status, table.sortOrder, table.createdAt),
    volumeIdx: index('volume_packages_volume_idx').on(table.volumeBytes),
  }),
);

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    provider: text('provider').notNull().default('manual'),
    checkoutMode: text('checkout_mode').notNull().default('manual'),
    currency: text('currency').notNull().default('toman'),
    minAmount: bigint('min_amount', { mode: 'number' }),
    maxAmount: bigint('max_amount', { mode: 'number' }),
    status: text('status').notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(1000),
    supportsAutoCapture: boolean('supports_auto_capture').notNull().default(false),
    publicConfig: jsonb('public_config').notNull().default(sql`'{}'::jsonb`),
    instructions: text('instructions'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('payment_methods_slug_unique').on(table.slug),
    statusSortIdx: index('payment_methods_status_sort_idx').on(table.status, table.sortOrder, table.createdAt),
    providerIdx: index('payment_methods_provider_idx').on(table.provider),
  }),
);

export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'restrict' }),
    volumePackageId: uuid('volume_package_id').references(() => volumePackages.id, { onDelete: 'set null' }),
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
    packageName: text('package_name').notNull(),
    packageSlug: text('package_slug').notNull(),
    volumeBytes: bigint('volume_bytes', { mode: 'number' }).notNull(),
    durationDays: integer('duration_days'),
    pricePerGb: bigint('price_per_gb', { mode: 'number' }).notNull().default(0),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull().default('pending'),
    provider: text('provider').notNull().default('manual'),
    providerOrderId: text('provider_order_id'),
    providerCaptureId: text('provider_capture_id'),
    checkoutUrl: text('checkout_url'),
    idempotencyKey: text('idempotency_key'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex('payment_orders_idempotency_unique')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND idempotency_key <> ''`),
    providerOrderIdx: uniqueIndex('payment_orders_provider_order_unique')
      .on(table.provider, table.providerOrderId)
      .where(sql`provider_order_id IS NOT NULL AND provider_order_id <> ''`),
    statusCreatedIdx: index('payment_orders_status_created_idx').on(table.status, table.createdAt),
    customerCreatedIdx: index('payment_orders_customer_created_idx').on(table.customerAccountId, table.createdAt),
    methodCreatedIdx: index('payment_orders_method_created_idx').on(table.paymentMethodId, table.createdAt),
    providerStatusIdx: index('payment_orders_provider_status_idx').on(table.provider, table.status, table.createdAt),
  }),
);

export const paymentOrderAllocations = pgTable(
  'payment_order_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentOrderId: uuid('payment_order_id')
      .notNull()
      .references(() => paymentOrders.id, { onDelete: 'restrict' }),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'restrict' }),
    allocationScope: text('allocation_scope').notNull().default('account_quota'),
    volumeBytesDelta: bigint('volume_bytes_delta', { mode: 'number' }).notNull(),
    quotaLimitBeforeBytes: bigint('quota_limit_before_bytes', { mode: 'number' }),
    quotaLimitAfterBytes: bigint('quota_limit_after_bytes', { mode: 'number' }).notNull(),
    idempotencyKey: text('idempotency_key'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: uniqueIndex('payment_order_allocations_order_unique').on(table.paymentOrderId),
    idempotencyIdx: uniqueIndex('payment_order_allocations_idempotency_unique')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND idempotency_key <> ''`),
    customerCreatedIdx: index('payment_order_allocations_customer_created_idx').on(table.customerAccountId, table.createdAt),
    createdIdx: index('payment_order_allocations_created_idx').on(table.createdAt),
  }),
);

export const quotaChargeEvents = pgTable(
  'quota_charge_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'restrict' }),
    chargeScope: text('charge_scope').notNull().default('account_quota'),
    volumeBytesDelta: bigint('volume_bytes_delta', { mode: 'number' }).notNull(),
    accountQuotaBeforeBytes: bigint('account_quota_before_bytes', { mode: 'number' }),
    accountQuotaAfterBytes: bigint('account_quota_after_bytes', { mode: 'number' }),
    clientConfigIds: jsonb('client_config_ids').notNull().default(sql`'[]'::jsonb`),
    clientQuotaChanges: jsonb('client_quota_changes').notNull().default(sql`'[]'::jsonb`),
    externalPanelWriteStatus: text('external_panel_write_status').notNull().default('not_executed'),
    idempotencyKey: text('idempotency_key'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex('quota_charge_events_idempotency_unique')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND idempotency_key <> ''`),
    customerCreatedIdx: index('quota_charge_events_customer_created_idx').on(table.customerAccountId, table.createdAt),
    createdIdx: index('quota_charge_events_created_idx').on(table.createdAt),
  }),
);

export const routeSettings = pgTable(
  'route_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    routeGroup: text('route_group').notNull(),
    mode: text('mode').notNull().default('automatic'),
    selectedOutboundId: uuid('selected_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    loadBalanceStrategy: text('load_balance_strategy').notNull().default('balanced'),
    protocolProfile: text('protocol_profile').notNull().default('balanced'),
    speedProfile: text('speed_profile').notNull().default('balanced'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routeGroupIdx: uniqueIndex('route_settings_route_group_idx').on(table.routeGroup),
    modeIdx: index('route_settings_mode_idx').on(table.mode),
    selectedOutboundIdx: index('route_settings_selected_outbound_idx').on(table.selectedOutboundId),
  }),
);

export const routeAssignments = pgTable(
  'route_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    routeGroup: text('route_group').notNull().default('main'),
    assignmentKey: text('assignment_key').notNull().default('default'),
    assignmentLabel: text('assignment_label'),
    currentOutboundId: uuid('current_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    lockedOutboundId: uuid('locked_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    autoRouteEnabled: boolean('auto_route_enabled').notNull().default(true),
    routeLocked: boolean('route_locked').notNull().default(false),
    protocolProfile: text('protocol_profile').notNull().default('balanced'),
    speedProfile: text('speed_profile').notNull().default('balanced'),
    hysteresisScoreDelta: integer('hysteresis_score_delta').notNull().default(15),
    cooldownSeconds: integer('cooldown_seconds').notNull().default(180),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    lastDecisionEventId: uuid('last_decision_event_id'),
    lastDecisionAt: timestamp('last_decision_at', { withTimezone: true }),
    decisionState: text('decision_state').notNull().default('monitoring'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routeKeyIdx: uniqueIndex('route_assignments_route_key_idx').on(table.routeGroup, table.assignmentKey),
    currentOutboundIdx: index('route_assignments_current_outbound_idx').on(table.currentOutboundId),
    lockedOutboundIdx: index('route_assignments_locked_outbound_idx').on(table.lockedOutboundId),
    cooldownIdx: index('route_assignments_cooldown_idx').on(table.routeGroup, table.cooldownUntil),
  }),
);

export const routeDecisionEvents = pgTable(
  'route_decision_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    routeGroup: text('route_group').notNull(),
    assignmentKey: text('assignment_key').notNull().default('default'),
    decisionKind: text('decision_kind').notNull(),
    decisionState: text('decision_state').notNull(),
    scoreProfile: text('score_profile'),
    fromOutboundId: uuid('from_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    toOutboundId: uuid('to_outbound_id').references(() => outbounds.id, { onDelete: 'set null' }),
    fromScore: integer('from_score'),
    toScore: integer('to_score'),
    scoreDelta: integer('score_delta'),
    hysteresisScoreDelta: integer('hysteresis_score_delta'),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    routeLocked: boolean('route_locked').notNull().default(false),
    autoRouteEnabled: boolean('auto_route_enabled').notNull().default(true),
    reasonCodes: jsonb('reason_codes').notNull().default(sql`'[]'::jsonb`),
    decisionContext: jsonb('decision_context').notNull().default(sql`'{}'::jsonb`),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routeCreatedIdx: index('route_decision_events_route_created_idx').on(table.routeGroup, table.createdAt),
    assignmentCreatedIdx: index('route_decision_events_assignment_created_idx').on(
      table.routeGroup,
      table.assignmentKey,
      table.createdAt,
    ),
    toOutboundIdx: index('route_decision_events_to_outbound_idx').on(table.toOutboundId),
  }),
);

export const serversRelations = relations(servers, ({ many }) => ({
  metrics: many(serverMetrics),
  agentTokens: many(agentTokens),
  accessProfiles: many(serverAccessProfiles),
  credentials: many(serverCredentials),
  interfaces: many(serverInterfaces),
  tunnels: many(tunnels),
  outbounds: many(outbounds),
}));

export const serverMetricsRelations = relations(serverMetrics, ({ one }) => ({
  server: one(servers, {
    fields: [serverMetrics.serverId],
    references: [servers.id],
  }),
}));

export const routeQualityHourlyRelations = relations(routeQualityHourly, ({ one }) => ({
  server: one(servers, {
    fields: [routeQualityHourly.serverId],
    references: [servers.id],
  }),
}));

export const agentTokensRelations = relations(agentTokens, ({ one }) => ({
  server: one(servers, {
    fields: [agentTokens.serverId],
    references: [servers.id],
  }),
}));

export const serverCredentialsRelations = relations(serverCredentials, ({ one }) => ({
  server: one(servers, {
    fields: [serverCredentials.serverId],
    references: [servers.id],
  }),
}));

export const serverAccessProfilesRelations = relations(serverAccessProfiles, ({ one }) => ({
  server: one(servers, {
    fields: [serverAccessProfiles.serverId],
    references: [servers.id],
  }),
}));

export const serverInterfacesRelations = relations(serverInterfaces, ({ many, one }) => ({
  server: one(servers, {
    fields: [serverInterfaces.serverId],
    references: [servers.id],
  }),
  tunnels: many(tunnels),
}));

export const tunnelsRelations = relations(tunnels, ({ one }) => ({
  server: one(servers, {
    fields: [tunnels.serverId],
    references: [servers.id],
  }),
  localInterface: one(serverInterfaces, {
    fields: [tunnels.localInterfaceId],
    references: [serverInterfaces.id],
  }),
}));

export const outboundsRelations = relations(outbounds, ({ many, one }) => ({
  server: one(servers, {
    fields: [outbounds.serverId],
    references: [servers.id],
  }),
  healthChecks: many(outboundHealthChecks),
}));

export const outboundHealthChecksRelations = relations(outboundHealthChecks, ({ one }) => ({
  outbound: one(outbounds, {
    fields: [outboundHealthChecks.outboundId],
    references: [outbounds.id],
  }),
}));

export const customerAccountsRelations = relations(customerAccounts, ({ many }) => ({
  clientConfigs: many(clientConfigs),
  usageEvents: many(clientUsageEvents),
  rewardedAdGrants: many(rewardedAdGrants),
  paymentOrders: many(paymentOrders),
  paymentOrderAllocations: many(paymentOrderAllocations),
  quotaChargeEvents: many(quotaChargeEvents),
}));

export const clientConfigsRelations = relations(clientConfigs, ({ many, one }) => ({
  customerAccount: one(customerAccounts, {
    fields: [clientConfigs.customerAccountId],
    references: [customerAccounts.id],
  }),
  usageEvents: many(clientUsageEvents),
  rewardedAdGrants: many(rewardedAdGrants),
  routePreferences: many(clientRoutePreferences),
  accessTokens: many(clientAccessTokens),
  subscriptionCredentials: many(clientSubscriptionCredentials),
}));

export const clientUsageEventsRelations = relations(clientUsageEvents, ({ one }) => ({
  customerAccount: one(customerAccounts, {
    fields: [clientUsageEvents.customerAccountId],
    references: [customerAccounts.id],
  }),
  clientConfig: one(clientConfigs, {
    fields: [clientUsageEvents.clientConfigId],
    references: [clientConfigs.id],
  }),
}));

export const rewardedAdGrantsRelations = relations(rewardedAdGrants, ({ one }) => ({
  customerAccount: one(customerAccounts, {
    fields: [rewardedAdGrants.customerAccountId],
    references: [customerAccounts.id],
  }),
  clientConfig: one(clientConfigs, {
    fields: [rewardedAdGrants.clientConfigId],
    references: [clientConfigs.id],
  }),
}));

export const clientRoutePreferencesRelations = relations(clientRoutePreferences, ({ one }) => ({
  clientConfig: one(clientConfigs, {
    fields: [clientRoutePreferences.clientConfigId],
    references: [clientConfigs.id],
  }),
  preferredOutbound: one(outbounds, {
    fields: [clientRoutePreferences.preferredOutboundId],
    references: [outbounds.id],
  }),
}));

export const clientAccessTokensRelations = relations(clientAccessTokens, ({ one }) => ({
  clientConfig: one(clientConfigs, {
    fields: [clientAccessTokens.clientConfigId],
    references: [clientConfigs.id],
  }),
}));

export const clientSubscriptionCredentialsRelations = relations(clientSubscriptionCredentials, ({ one }) => ({
  clientConfig: one(clientConfigs, {
    fields: [clientSubscriptionCredentials.clientConfigId],
    references: [clientConfigs.id],
  }),
  outbound: one(outbounds, {
    fields: [clientSubscriptionCredentials.outboundId],
    references: [outbounds.id],
  }),
}));

export const volumePackagesRelations = relations(volumePackages, ({ many }) => ({
  paymentOrders: many(paymentOrders),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ many }) => ({
  paymentOrders: many(paymentOrders),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  customerAccount: one(customerAccounts, {
    fields: [paymentOrders.customerAccountId],
    references: [customerAccounts.id],
  }),
  volumePackage: one(volumePackages, {
    fields: [paymentOrders.volumePackageId],
    references: [volumePackages.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [paymentOrders.paymentMethodId],
    references: [paymentMethods.id],
  }),
  allocation: one(paymentOrderAllocations, {
    fields: [paymentOrders.id],
    references: [paymentOrderAllocations.paymentOrderId],
  }),
}));

export const paymentOrderAllocationsRelations = relations(paymentOrderAllocations, ({ one }) => ({
  paymentOrder: one(paymentOrders, {
    fields: [paymentOrderAllocations.paymentOrderId],
    references: [paymentOrders.id],
  }),
  customerAccount: one(customerAccounts, {
    fields: [paymentOrderAllocations.customerAccountId],
    references: [customerAccounts.id],
  }),
}));

export const quotaChargeEventsRelations = relations(quotaChargeEvents, ({ one }) => ({
  customerAccount: one(customerAccounts, {
    fields: [quotaChargeEvents.customerAccountId],
    references: [customerAccounts.id],
  }),
}));
