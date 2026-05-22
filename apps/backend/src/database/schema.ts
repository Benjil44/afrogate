import { relations, sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
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

export const serversRelations = relations(servers, ({ many }) => ({
  metrics: many(serverMetrics),
  agentTokens: many(agentTokens),
  accessProfiles: many(serverAccessProfiles),
  credentials: many(serverCredentials),
  outbounds: many(outbounds),
}));

export const serverMetricsRelations = relations(serverMetrics, ({ one }) => ({
  server: one(servers, {
    fields: [serverMetrics.serverId],
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
