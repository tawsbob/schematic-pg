import type { QueryResultRow } from 'pg';
import type { Queryable } from './queryable.js';
export interface RawClient {
    /**
     * Runs an arbitrary SQL query and returns the raw result rows.
     *
     * Rows are returned EXACTLY as `pg` produces them: `snake_case` column names
     * and driver type coercion, with no `camelCase` mapping. Values MUST be passed
     * through the positional `params` array (`$1`, `$2`, …) — never interpolate
     * user input into the `sql` string.
     */
    $queryRaw<T extends QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    /**
     * Runs an arbitrary SQL statement and returns the number of affected rows.
     *
     * Values MUST be passed through the positional `params` array (`$1`, `$2`, …)
     * — never interpolate user input into the `sql` string.
     */
    $executeRaw(sql: string, params?: unknown[]): Promise<number>;
}
/** Builds the parameterized raw-query escape hatch bound to a single executor. */
export declare function createRawClient(executor: Queryable): RawClient;
