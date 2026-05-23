import { Injectable } from '@nestjs/common';
import type { AuthActor } from '../security/auth-request';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(
    actor: AuthActor | undefined,
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
}
