import { BadRequestException, Injectable } from '@nestjs/common';
import type { AdminAuditLogSummary } from '@afrogate/shared';
import type { AuditActor } from '../security/auth-request';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';

export interface AuditLogFilters {
  action?: string | null;
  actorId?: string | null;
  actorType?: string | null;
  limit?: string | number | null;
  targetId?: string | null;
  targetType?: string | null;
}

interface AuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
}

const AUDIT_LOG_DEFAULT_LIMIT = 100;
const AUDIT_LOG_MAX_LIMIT = 200;
const AUDIT_FILTER_MAX_LENGTH = 160;
const AUDIT_METADATA_MAX_DEPTH = 4;
const AUDIT_METADATA_MAX_ARRAY_ITEMS = 20;
const AUDIT_METADATA_MAX_OBJECT_KEYS = 50;
const AUDIT_METADATA_MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = '[redacted]';
const TRUNCATED_VALUE = '[truncated]';
const sensitiveMetadataKeyPattern = /authorization|credential|password|private[_-]?key|secret|session|token|webhook/i;

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(
    actor: AuditActor | undefined,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {},
    executor: DatabaseQueryExecutor = this.database,
  ): Promise<void> {
    await executor.query(
      `
        INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        actor?.type ?? 'system',
        actor?.id ?? null,
        action,
        targetType,
        targetId,
        JSON.stringify(metadata),
      ],
    );
  }

  async listAuditLogs(filters: AuditLogFilters = {}): Promise<AdminAuditLogSummary[]> {
    const values: unknown[] = [];
    const clauses: string[] = [];
    const addFilter = (column: string, value: string | null | undefined) => {
      const normalized = this.normalizeTextFilter(value);
      if (!normalized) return;

      values.push(normalized);
      clauses.push(`${column} = $${values.length}`);
    };

    addFilter('action', filters.action);
    addFilter('actor_type', filters.actorType);
    addFilter('actor_id', filters.actorId);
    addFilter('target_type', filters.targetType);
    addFilter('target_id', filters.targetId);

    const limit = this.normalizeLimit(filters.limit);
    values.push(limit);

    const result = await this.database.query<AuditLogRow>(
      `
        SELECT
          id,
          actor_type AS "actorType",
          actor_id AS "actorId",
          action,
          target_type AS "targetType",
          target_id AS "targetId",
          metadata,
          created_at AS "createdAt"
        FROM audit_logs
        ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: this.sanitizeMetadataRecord(row.metadata),
      createdAt: this.serializeTimestamp(row.createdAt),
    }));
  }

  async recordBestEffort(
    actor: AuditActor | undefined,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {},
    executor: DatabaseQueryExecutor = this.database,
  ): Promise<void> {
    if (!process.env.DATABASE_URL) return;

    try {
      await this.record(actor, action, targetType, targetId, metadata, executor);
    } catch {
      // Login and local diagnostics must keep working when PostgreSQL is not configured yet.
    }
  }

  private normalizeLimit(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return AUDIT_LOG_DEFAULT_LIMIT;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Audit log limit must be a number');

    return Math.max(1, Math.min(AUDIT_LOG_MAX_LIMIT, Math.trunc(parsed)));
  }

  private normalizeTextFilter(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;

    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > AUDIT_FILTER_MAX_LENGTH) {
      throw new BadRequestException('Audit log filter is too long');
    }

    return normalized;
  }

  private sanitizeMetadataRecord(metadata: Record<string, unknown> | null): Record<string, unknown> {
    const sanitized = this.sanitizeMetadataValue(metadata);

    if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') return {};

    return sanitized as Record<string, unknown>;
  }

  private sanitizeMetadataValue(value: unknown, depth = 0): unknown {
    if (depth > AUDIT_METADATA_MAX_DEPTH) return TRUNCATED_VALUE;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return this.truncateMetadataString(value);
    if (Array.isArray(value)) {
      const items = value
        .slice(0, AUDIT_METADATA_MAX_ARRAY_ITEMS)
        .map((item) => this.sanitizeMetadataValue(item, depth + 1));

      return value.length > AUDIT_METADATA_MAX_ARRAY_ITEMS ? [...items, TRUNCATED_VALUE] : items;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      const sanitizedEntries = entries.slice(0, AUDIT_METADATA_MAX_OBJECT_KEYS).map(([key, nestedValue]) => [
        key,
        sensitiveMetadataKeyPattern.test(key) ? REDACTED_VALUE : this.sanitizeMetadataValue(nestedValue, depth + 1),
      ]);
      const sanitized = Object.fromEntries(sanitizedEntries) as Record<string, unknown>;

      if (entries.length > AUDIT_METADATA_MAX_OBJECT_KEYS) sanitized.__truncated = true;

      return sanitized;
    }

    return String(value);
  }

  private truncateMetadataString(value: string): string {
    if (value.length <= AUDIT_METADATA_MAX_STRING_LENGTH) return value;

    return `${value.slice(0, AUDIT_METADATA_MAX_STRING_LENGTH)}...`;
  }

  private serializeTimestamp(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }
}
