import type { Pool, PoolClient } from 'pg';

const RESET_SQL = `
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job;
  END IF;
END
$$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgrest;
GRANT ALL ON SCHEMA public TO public;
`.trim();

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function resetPublicSchema(client: Queryable): Promise<void> {
  await client.query(RESET_SQL);
}
