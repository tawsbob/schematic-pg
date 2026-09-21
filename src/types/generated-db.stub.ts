import type { QueryResultRow } from 'pg';

export type TxClient = {
  $queryRaw<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  $executeRaw(sql: string, params?: unknown[]): Promise<number>;
} & Record<string, unknown>;

export interface DbClient extends Record<string, unknown> {
  $queryRaw<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  $executeRaw(sql: string, params?: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T>;
}

export function createDbClient(_pool: unknown): DbClient {
  return {
    async $queryRaw() {
      return [];
    },
    async $executeRaw() {
      return 0;
    },
    async $transaction(fn) {
      return fn(this);
    },
  };
}
