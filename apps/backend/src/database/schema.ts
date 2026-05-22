import { relations, sql } from 'drizzle-orm';
import {
  bigserial,
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

export const serversRelations = relations(servers, ({ many }) => ({
  metrics: many(serverMetrics),
  agentTokens: many(agentTokens),
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
