import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import * as schema from './schema';

export type AfroGateDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5000),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
  });

  readonly db: AfroGateDatabase = drizzle(this.pool, { schema });

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
