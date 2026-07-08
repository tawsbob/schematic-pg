import type { Pool, PoolClient } from 'pg';
export declare function runInTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T>;
