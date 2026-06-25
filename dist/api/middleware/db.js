import { Pool } from 'pg';
import { getDatabaseUrl } from '../../db/config.js';
export function createDbMiddleware(options) {
    const pool = options.pool ?? new Pool({ connectionString: getDatabaseUrl() });
    const client = options.createDbClient(pool);
    return async (c, next) => {
        c.set('db', client);
        await next();
    };
}
