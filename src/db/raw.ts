import type { QueryResultRow } from 'pg';
import { type DatabaseError, mapPgError } from './errors.js';
import type { Queryable } from './queryable.js';

/**
 * Label used when surfacing raw-query errors. A raw query has no single owning
 * model, so error mapping runs without a `column -> field` translation map.
 */
const RAW_QUERY_LABEL = '$queryRaw';
const EMPTY_COLUMN_TO_FIELD: Map<string, string> = new Map();
const NO_PARAMS: unknown[] = [];

/** Maps a driver error to the project's typed `DatabaseError` subclasses. */
function wrapRawError(error: unknown): DatabaseError {
  return mapPgError(error, RAW_QUERY_LABEL, EMPTY_COLUMN_TO_FIELD);
}

export interface RawClient {
  /**
   * Runs an arbitrary SQL query and returns the raw result rows.
   *
   * Rows are returned EXACTLY as `pg` produces them: `snake_case` column names
   * and driver type coercion, with no `camelCase` mapping. Values MUST be passed
   * through the positional `params` array (`$1`, `$2`, …) — never interpolate
   * user input into the `sql` string.
   */
  $queryRaw<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;

  /**
   * Runs an arbitrary SQL statement and returns the number of affected rows.
   *
   * Values MUST be passed through the positional `params` array (`$1`, `$2`, …)
   * — never interpolate user input into the `sql` string.
   */
  $executeRaw(sql: string, params?: unknown[]): Promise<number>;
}

/** Builds the parameterized raw-query escape hatch bound to a single executor. */
export function createRawClient(executor: Queryable): RawClient {
  return {
    async $queryRaw<T extends QueryResultRow = Record<string, unknown>>(
      sql: string,
      params: unknown[] = NO_PARAMS,
    ): Promise<T[]> {
      try {
        const result = await executor.query<T>(sql, params);
        return result.rows;
      } catch (error) {
        throw wrapRawError(error);
      }
    },

    async $executeRaw(sql: string, params: unknown[] = NO_PARAMS): Promise<number> {
      try {
        const result = await executor.query<QueryResultRow>(sql, params);
        return result.rowCount ?? 0;
      } catch (error) {
        throw wrapRawError(error);
      }
    },
  };
}
