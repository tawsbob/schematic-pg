import type { Pool, PoolClient } from 'pg';

const RESET_SQL = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgrest;
GRANT ALL ON SCHEMA public TO public;
`.trim();

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function resetPublicSchema(client: Queryable): Promise<void> {
  await client.query(RESET_SQL);
}
