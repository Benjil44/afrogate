import { relations, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  bigserial,
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
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
    displayName: text('display_name').notNull().default('Afrows'),
    legalName: text('legal_name'),
    supportEmail: text('support_email'),
    supportTelegram: text('support_telegram'),
    supportUrl: text('support_url'),
    logoUrl: text('logo_url'),
    dashboardTitle: text('dashboard_title').notNull().default('Afrows'),
    clientAppTitle: text('client_app_title').notNull().default('Afrows Client'),
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
    username: text('username').notNull().default('afrows'),
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
    // Speed-test columns added by migration 0029 (double precision, nullable).
    latestDownMbps: doublePrecision('latest_down_mbps'),
    latestUpMbps: doublePrecision('latest_up_mbps'),
    lastSpeedTestAt: timestamp('last_speed_test_at', { withTimezone: true }),
    speedTestRequestedAt: timestamp('speed_test_requested_at', { withTimezone: true }),
    // Subscription linkage added by migration 0032. FK modeled in Phase 1B.1 now
    // that outbound_subscriptions is an entity: subscription_id -> outbound_subscriptions(id) CASCADE.
    subscriptionId: uuid('subscription_id').references((): AnyPgColumn => outboundSubscriptions.id, {
      onDelete: 'cascade',
    }),
    subscriptionKey: text('subscription_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverIdx: index('outbounds_server_idx').on(table.serverId),
    routePriorityIdx: index('outbounds_route_priority_idx').on(table.routeGroup, table.priority),
    enabledIdx: index('outbounds_enabled_idx').on(table.enabled),
    healthStatusIdx: index('outbounds_health_status_idx').on(table.healthStatus),
    subscriptionIdx: index('outbounds_subscription_idx').on(table.subscriptionId),
    subscriptionKeyIdx: uniqueIndex('outbounds_subscription_key_uidx')
      .on(table.subscriptionId, table.subscriptionKey)
      .where(sql`subscription_id IS NOT NULL`),
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

export const resellerAccounts = pgTable(
  'reseller_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: text('admin_user_id').notNull(),
    displayName: text('display_name').notNull(),
    contactName: text('contact_name'),
    telegramUsername: text('telegram_username'),
    status: text('status').notNull().default('active'),
    sellerMarginBps: integer('seller_margin_bps').notNull().default(2500),
    currency: text('currency').notNull().default('toman'),
    balanceAmount: bigint('balance_amount', { mode: 'number' }).notNull().default(0),
    creditLimitAmount: bigint('credit_limit_amount', { mode: 'number' }).notNull().default(0),
    notes: text('notes'),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    adminUserIdx: uniqueIndex('reseller_accounts_admin_user_unique').on(table.adminUserId),
    statusIdx: index('reseller_accounts_status_idx').on(table.status),
    createdAtIdx: index('reseller_accounts_created_at_idx').on(table.createdAt),
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
    resellerAccountId: uuid('reseller_account_id').references(() => resellerAccounts.id, { onDelete: 'set null' }),
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
    // Registration/wallet/referral columns added by migration 0053; egress tier by 0036.
    phone: text('phone'),
    gemsBalance: bigint('gems_balance', { mode: 'number' }).notNull().default(0),
    referralCode: text('referral_code'),
    referredBy: uuid('referred_by').references((): AnyPgColumn => customerAccounts.id),
    egressTier: text('egress_tier').notNull().default('normal'),
    // Auth credentials for mobile-app account login (migration 0030). password_hash is a
    // hash, never plaintext; login_email is unique case-insensitively (see loginEmailIdx).
    loginEmail: text('login_email'),
    passwordHash: text('password_hash'),
    passwordSetAt: timestamp('password_set_at', { withTimezone: true }),
    // Admin entitlement to the gaming egress tier (migration 0043); the ACTIVE on/off is egressTier.
    gamingEntitled: boolean('gaming_entitled').notNull().default(false),
    // Subscription lifecycle. expiresAt: NULL = never expires, past = cannot log in (migration 0044).
    // deletedAt: NULL = live, non-NULL = archived/soft-deleted (migration 0051).
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Operator labels for filtering/segmentation (migration 0044); Postgres text[] array (NOT jsonb).
    tags: text('tags').array().notNull().default([]),
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
    resellerAccountIdx: index('customer_accounts_reseller_account_idx').on(table.resellerAccountId, table.createdAt),
    referralCodeIdx: uniqueIndex('customer_accounts_referral_code_key')
      .on(table.referralCode)
      .where(sql`referral_code IS NOT NULL`),
    referredByIdx: index('customer_accounts_referred_by_idx')
      .on(table.referredBy)
      .where(sql`referred_by IS NOT NULL`),
    // Case-insensitive unique login (functional index on lower(login_email)), migration 0030.
    loginEmailIdx: uniqueIndex('customer_accounts_login_email_key')
      .on(sql`lower(${table.loginEmail})`)
      .where(sql`login_email IS NOT NULL`),
    // Partial index over live (non-archived) rows for the Customers listing, migration 0051.
    activeCreatedIdx: index('customer_accounts_active_created_idx')
      .on(table.createdAt.desc())
      .where(sql`deleted_at IS NULL`),
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

export const resellerWalletLedger = pgTable(
  'reseller_wallet_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resellerAccountId: uuid('reseller_account_id')
      .notNull()
      .references(() => resellerAccounts.id, { onDelete: 'restrict' }),
    entryType: text('entry_type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceBeforeAmount: bigint('balance_before_amount', { mode: 'number' }).notNull(),
    balanceAfterAmount: bigint('balance_after_amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    source: text('source').notNull(),
    sourceId: text('source_id'),
    volumePackageId: uuid('volume_package_id').references(() => volumePackages.id, { onDelete: 'set null' }),
    customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
    clientConfigId: uuid('client_config_id').references(() => clientConfigs.id, { onDelete: 'set null' }),
    idempotencyKey: text('idempotency_key'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex('reseller_wallet_ledger_idempotency_unique')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND idempotency_key <> ''`),
    resellerCreatedIdx: index('reseller_wallet_ledger_reseller_created_idx').on(table.resellerAccountId, table.createdAt),
    customerIdx: index('reseller_wallet_ledger_customer_idx').on(table.customerAccountId, table.createdAt),
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

// ===========================================================================
// Phase 1A: financial / audit tables (migration-authoritative).
// These are accessed exclusively via raw SQL (never the Drizzle query builder),
// so the entities are a schema-of-record + a source for derived row types. As
// with every other entity in this file, DB-level CHECK constraints (status
// enums, amount positivity) are NOT mirrored here — they stay enforced by the
// migrations. No relations() are added: the raw-SQL codebase does not use the
// Drizzle relational query API, so they would be decorative. FKs (incl. ON
// DELETE) ARE modeled at the column level, which is the authoritative structure.
// ===========================================================================

// Postgres bytea — drizzle-orm has no builtin. Buffer-backed; type metadata only
// (the receipt blob is read/written via raw SQL through an authenticated endpoint).
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// Telegram self-service card-to-card top-up requests (migration 0052).
// State machine: awaiting_receipt -> pending -> approved | rejected (CHECK in DB).
export const telegramTopupRequests = pgTable(
  'telegram_topup_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'cascade' }),
    telegramId: text('telegram_id'),
    telegramChatId: text('telegram_chat_id'),
    volumePackageId: uuid('volume_package_id').references(() => volumePackages.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }),
    currency: text('currency'),
    receiptFileId: text('receipt_file_id'),
    status: text('status').notNull().default('awaiting_receipt'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
  },
  (table) => ({
    statusCreatedIdx: index('telegram_topup_requests_status_created_idx').on(table.status, table.createdAt.desc()),
    telegramStatusIdx: index('telegram_topup_requests_telegram_status_idx').on(
      table.telegramId,
      table.status,
      table.createdAt.desc(),
    ),
  }),
);
export type TelegramTopupRequestRow = typeof telegramTopupRequests.$inferSelect;
export type TelegramTopupRequestInsert = typeof telegramTopupRequests.$inferInsert;

// Append-only gems ledger — source-of-truth audit trail behind the cached
// customer_accounts.gems_balance (migration 0053). Signed delta (+ earn / - spend).
export const gemsLedger = pgTable(
  'gems_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerAccountId: uuid('customer_account_id')
      .notNull()
      .references(() => customerAccounts.id, { onDelete: 'cascade' }),
    delta: bigint('delta', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    ref: text('ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountCreatedIdx: index('gems_ledger_account_created_idx').on(table.customerAccountId, table.createdAt.desc()),
    reasonRefIdx: index('gems_ledger_reason_ref_idx').on(table.reason, table.ref),
  }),
);
export type GemsLedgerRow = typeof gemsLedger.$inferSelect;
export type GemsLedgerInsert = typeof gemsLedger.$inferInsert;

// Reseller card-to-card wallet top-up requests (migration 0054). On approval the
// backend writes reseller_wallet_ledger and links it via wallet_ledger_id.
// State machine: pending -> approved | rejected (CHECK in DB); amount > 0 (CHECK).
export const resellerWalletTopupRequests = pgTable(
  'reseller_wallet_topup_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resellerAccountId: uuid('reseller_account_id')
      .notNull()
      .references(() => resellerAccounts.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    receiptBytes: bytea('receipt_bytes'),
    receiptContentType: text('receipt_content_type'),
    status: text('status').notNull().default('pending'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    walletLedgerId: uuid('wallet_ledger_id').references(() => resellerWalletLedger.id, { onDelete: 'set null' }),
  },
  (table) => ({
    statusCreatedIdx: index('reseller_wallet_topup_requests_status_created_idx').on(table.status, table.createdAt.desc()),
    resellerCreatedIdx: index('reseller_wallet_topup_requests_reseller_created_idx').on(
      table.resellerAccountId,
      table.createdAt.desc(),
    ),
  }),
);
export type ResellerWalletTopupRequestRow = typeof resellerWalletTopupRequests.$inferSelect;
export type ResellerWalletTopupRequestInsert = typeof resellerWalletTopupRequests.$inferInsert;

// ===========================================================================
// Phase 1B.1: outbound-subscription + WireGuard / device-sighting tables
// (migration-authoritative). Raw-SQL runtime; entities are schema-of-record +
// derived types only. DB-level CHECK constraints (desired_state enum, rx/tx >= 0)
// stay DB-enforced and are NOT mirrored, per this file's convention. FKs (incl.
// ON DELETE) ARE modeled at the column level.
// ===========================================================================

// One subscription URL expands into many child `outbounds` rows (migration 0032).
export const outboundSubscriptions = pgTable('outbound_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  routeGroup: text('route_group').notNull().default('default'),
  profileTitle: text('profile_title'),
  updateIntervalHours: integer('update_interval_hours'),
  userinfo: jsonb('userinfo').notNull().default(sql`'{}'::jsonb`),
  enabled: boolean('enabled').notNull().default(true),
  configCount: integer('config_count').notNull().default(0),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  lastStatus: text('last_status').notNull().default('unknown'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export type OutboundSubscriptionSelect = typeof outboundSubscriptions.$inferSelect;
export type OutboundSubscriptionInsert = typeof outboundSubscriptions.$inferInsert;

// WireGuard peers — one row per client_config delivered over kernel WireGuard
// (migrations 0033 base, 0034 metered counters, 0047 endpoint_ip). 16 columns.
export const wireguardPeers = pgTable(
  'wireguard_peers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    interface: text('interface').notNull().default('wg0'),
    clientPublicKey: text('client_public_key').notNull(),
    encryptedPrivateKey: text('encrypted_private_key').notNull(),
    clientAddress: text('client_address').notNull(),
    presharedKey: text('preshared_key'),
    rxBytes: bigint('rx_bytes', { mode: 'number' }).notNull().default(0),
    txBytes: bigint('tx_bytes', { mode: 'number' }).notNull().default(0),
    lastHandshakeAt: timestamp('last_handshake_at', { withTimezone: true }),
    desiredState: text('desired_state').notNull().default('present'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    meteredRxBytes: bigint('metered_rx_bytes', { mode: 'number' }).notNull().default(0),
    meteredTxBytes: bigint('metered_tx_bytes', { mode: 'number' }).notNull().default(0),
    endpointIp: text('endpoint_ip'),
  },
  (table) => ({
    clientConfigUnique: uniqueIndex('wireguard_peers_client_config_unique').on(table.clientConfigId),
    pubkeyUnique: uniqueIndex('wireguard_peers_pubkey_unique').on(table.interface, table.clientPublicKey),
    addressUnique: uniqueIndex('wireguard_peers_address_unique').on(table.interface, table.clientAddress),
    desiredStateIdx: index('wireguard_peers_desired_state_idx').on(table.interface, table.desiredState),
  }),
);
export type WireguardPeerRow = typeof wireguardPeers.$inferSelect;
export type WireguardPeerInsert = typeof wireguardPeers.$inferInsert;

// Per-(config, source IP) device sightings for device/IP visibility (migration 0047).
export const clientDeviceSightings = pgTable(
  'client_device_sightings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientConfigId: uuid('client_config_id')
      .notNull()
      .references(() => clientConfigs.id, { onDelete: 'cascade' }),
    sourceIp: text('source_ip').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    hits: bigint('hits', { mode: 'number' }).notNull().default(1),
  },
  (table) => ({
    uniq: uniqueIndex('client_device_sightings_uniq').on(table.clientConfigId, table.sourceIp),
    lastSeenIdx: index('client_device_sightings_last_seen_idx').on(table.lastSeenAt),
  }),
);
export type ClientDeviceSightingSelect = typeof clientDeviceSightings.$inferSelect;
export type ClientDeviceSightingInsert = typeof clientDeviceSightings.$inferInsert;

// ===========================================================================
// Phase 1B.2A: operator-managed MikroTik routers (migrations 0038 base, 0041
// tunnel keys, 0042 egress_enabled, 0045 role + customer link). 18 columns.
// text (caller-supplied) PK, not uuid. Raw-SQL runtime; DB-level CHECKs (kind,
// rest_port range, role) stay DB-enforced, not mirrored, per file convention.
// NOTE (future dependency, NOT modeled here): mikrotik_gateway_usage_cursor
//   .router_id -> mikrotik_routers(id) ON DELETE CASCADE — deferred to Phase 1B.2B.
// ===========================================================================
export const mikrotikRouters = pgTable(
  'mikrotik_routers',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    kind: text('kind').notNull().default('other'),
    host: text('host').notNull(),
    restPort: integer('rest_port').notNull().default(80),
    restUser: text('rest_user').notNull().default('claude'),
    restPasswordEnc: text('rest_password_enc'),
    webfigUrl: text('webfig_url'),
    gamingSourceIp: text('gaming_source_ip'),
    gamingEnabled: boolean('gaming_enabled').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    tunnelPublicKey: text('tunnel_public_key'),
    tunnelPrivateKeyEnc: text('tunnel_private_key_enc'),
    egressEnabled: boolean('egress_enabled').notNull().default(false),
    role: text('role').notNull().default('gateway'),
    customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  },
  (table) => ({
    customerIdx: index('mikrotik_routers_customer_idx').on(table.customerAccountId),
  }),
);
export type MikrotikRouterRow = typeof mikrotikRouters.$inferSelect;
export type MikrotikRouterInsert = typeof mikrotikRouters.$inferInsert;

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

export const resellerAccountsRelations = relations(resellerAccounts, ({ many }) => ({
  customerAccounts: many(customerAccounts),
  walletLedger: many(resellerWalletLedger),
}));

export const customerAccountsRelations = relations(customerAccounts, ({ many, one }) => ({
  resellerAccount: one(resellerAccounts, {
    fields: [customerAccounts.resellerAccountId],
    references: [resellerAccounts.id],
  }),
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

export const resellerWalletLedgerRelations = relations(resellerWalletLedger, ({ one }) => ({
  resellerAccount: one(resellerAccounts, {
    fields: [resellerWalletLedger.resellerAccountId],
    references: [resellerAccounts.id],
  }),
  volumePackage: one(volumePackages, {
    fields: [resellerWalletLedger.volumePackageId],
    references: [volumePackages.id],
  }),
  customerAccount: one(customerAccounts, {
    fields: [resellerWalletLedger.customerAccountId],
    references: [customerAccounts.id],
  }),
  clientConfig: one(clientConfigs, {
    fields: [resellerWalletLedger.clientConfigId],
    references: [clientConfigs.id],
  }),
}));
