import { Pool } from 'pg';
import type { MiddlewareHandler } from 'hono';
import type { DbClient } from '../../types/generated-db.stub.js';
import type { AppEnv } from '../types.js';
export declare function createDbMiddleware(options: {
    pool?: Pool;
    createDbClient: (pool: Pool) => DbClient;
}): MiddlewareHandler<AppEnv>;
