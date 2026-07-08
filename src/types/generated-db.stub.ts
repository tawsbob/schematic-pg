import type { QueryResultRow } from 'pg';

export interface DbClient extends Record<string, unknown> {
  $queryRaw<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  $executeRaw(sql: string, params?: unknown[]): Promise<number>;
}

export function createDbClient(_pool: unknown): DbClient {
  return {
    async $queryRaw() {
      return [];
    },
    async $executeRaw() {
      return 0;
    },
  };
}
