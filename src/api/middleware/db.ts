import { Pool } from 'pg';
import type { MiddlewareHandler } from 'hono';
import type { DbClient } from '../../types/generated-db.stub.js';
import { getDatabaseUrl } from '../../db/config.js';
import type { AppEnv } from '../types.js';

export function createDbMiddleware(options: {
  pool?: Pool;
  createDbClient: (pool: Pool) => DbClient;
}): MiddlewareHandler<AppEnv> {
  const pool = options.pool ?? new Pool({ connectionString: getDatabaseUrl() });
  const client = options.createDbClient(pool);

  return async (c, next) => {
    c.set('db', client);
    await next();
  };
}
