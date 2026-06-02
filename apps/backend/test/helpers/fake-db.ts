import type { DatabaseQueryExecutor } from '../../src/database/database.service.ts';

export interface FakeQueryCall {
  text: string;
  values: unknown[];
}

export interface FakeExecutor extends DatabaseQueryExecutor {
  /** Every query the code-under-test issued, in order (SQL + bound params). */
  readonly calls: FakeQueryCall[];
}

type RowSet = { rows: unknown[] };

/**
 * In-memory fake of DatabaseQueryExecutor for DB-integration-style unit tests.
 * `responses` are returned to successive `query()` calls in order (default: empty
 * rows). Every call's SQL + params are recorded on `.calls` so tests can assert
 * that ids are bound as parameters rather than interpolated. A response may be a
 * function to throw (e.g. simulate a unique-constraint violation).
 */
export function createFakeExecutor(responses: Array<RowSet | (() => never)> = []): FakeExecutor {
  const calls: FakeQueryCall[] = [];
  let index = 0;
  return {
    calls,
    async query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      const next = responses[index++];
      if (typeof next === 'function') next();
      const rows = (next?.rows ?? []) as R[];
      return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as Awaited<
        ReturnType<DatabaseQueryExecutor['query']>
      > & { rows: R[] };
    },
  } as FakeExecutor;
}

/**
 * Minimal stand-in for DatabaseService.transaction: runs the callback with a
 * fake executor (no real BEGIN/COMMIT). Use to exercise transaction-wrapped flows.
 */
export function createFakeDatabase(responses: Array<RowSet | (() => never)> = []): {
  executor: FakeExecutor;
  transaction: <T>(callback: (executor: DatabaseQueryExecutor) => Promise<T>) => Promise<T>;
} {
  const executor = createFakeExecutor(responses);
  return {
    executor,
    transaction: (callback) => callback(executor),
  };
}

/** Helper to build a unique-constraint-violation thrower (Postgres code 23505). */
export function uniqueViolation(): () => never {
  return () => {
    const error = new Error('duplicate key value violates unique constraint') as Error & { code: string };
    error.code = '23505';
    throw error;
  };
}
