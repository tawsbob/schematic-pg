import type { QueryResult, QueryResultRow } from 'pg';

/** Minimal executor satisfied by both pg `Pool` and `PoolClient`. */
export interface Queryable {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}
