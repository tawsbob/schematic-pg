import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { parse } from '../../schema-dsl/index.js';
import { assertDockerPostgres } from '../../__tests__/helpers/integration.js';
import { MigrationPlanner } from '../migration-planner.js';
import { MigrationSqlGenerator } from '../migration-sql-generator.js';
import { SqlGenerator } from '../sql-generator.js';

const baseSchema = `extensions {
  pg_cron
}

functions {
  function expireSessions(): VOID {
    language: sql
    execute: """
      DELETE FROM cron_test_marker WHERE kind = 'expire'
    """
  }

  function bumpMarker(): VOID {
    language: sql
    execute: """
      UPDATE cron_test_marker SET hits = hits + 1 WHERE kind = 'run'
    """
  }
}

cron {
  job expireSessions {
    schedule: "0 * * * *"
    call: expireSessions
  }

  job nightlyVacuum {
    schedule: "0 3 * * *"
    execute: "VACUUM ANALYZE"
  }

  job purgeOldRows {
    schedule: "30 seconds"
    execute: """
      DELETE FROM cron_test_marker
      WHERE kind = 'purge'
    """
  }
}`;

const replacedScheduleSchema = `extensions {
  pg_cron
}

functions {
  function expireSessions(): VOID {
    language: sql
    execute: """
      DELETE FROM cron_test_marker WHERE kind = 'expire'
    """
  }

  function bumpMarker(): VOID {
    language: sql
    execute: """
      UPDATE cron_test_marker SET hits = hits + 1 WHERE kind = 'run'
    """
  }
}

cron {
  job expireSessions {
    schedule: "30 * * * *"
    call: expireSessions
  }

  job nightlyVacuum {
    schedule: "0 3 * * *"
    execute: "VACUUM ANALYZE"
  }

  job purgeOldRows {
    schedule: "30 seconds"
    execute: """
      DELETE FROM cron_test_marker
      WHERE kind = 'purge'
    """
  }
}`;

const callOnlySchema = `extensions {
  pg_cron
}

functions {
  function bumpMarker(): VOID {
    language: sql
    execute: """
      UPDATE cron_test_marker SET hits = hits + 1 WHERE kind = 'run'
    """
  }
}

cron {
  job bumpMarker {
    schedule: "1 seconds"
    call: bumpMarker
  }
}`;

const emptyCronSchema = `extensions {
  pg_cron
}

functions {
  function bumpMarker(): VOID {
    language: sql
    execute: """
      UPDATE cron_test_marker SET hits = hits + 1 WHERE kind = 'run'
    """
  }
}

cron {}`;

interface CronJobRow {
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
}

describe('cron jobs integration (Docker + pg_cron)', { concurrency: 1 }, () => {
  let pool: Pool;
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();
  const ddl = new SqlGenerator();

  before(async () => {
    pool = await assertDockerPostgres();
    await assertPgCronReady(pool);
  });

  after(async () => {
    await cleanupCronArtifacts(pool);
    await pool.end();
  });

  async function applySchema(source: string): Promise<void> {
    const schema = parse(source);
    const sql = ddl.generate(schema);
    await pool.query(sql);
  }

  async function applyDiff(oldSource: string, newSource: string): Promise<string> {
    const oldSchema = parse(oldSource);
    const newSchema = parse(newSource);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema, oldSchema);
    if (sql.trim().length > 0) {
      await pool.query(sql);
    }
    return sql;
  }

  async function listJobs(names?: string[]): Promise<CronJobRow[]> {
    if (names && names.length > 0) {
      const result = await pool.query<CronJobRow>(
        `SELECT jobname, schedule, command, active
         FROM cron.job
         WHERE jobname = ANY($1::text[])
         ORDER BY jobname`,
        [names],
      );
      return result.rows;
    }

    const result = await pool.query<CronJobRow>(
      `SELECT jobname, schedule, command, active
       FROM cron.job
       ORDER BY jobname`,
    );
    return result.rows;
  }

  it('creates the pg_cron extension without WITH SCHEMA public', async () => {
    await cleanupCronArtifacts(pool);
    await applySchema(baseSchema);

    const extension = await pool.query<{ extname: string; nspname: string }>(
      `SELECT e.extname, n.nspname
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'pg_cron'`,
    );
    assert.equal(extension.rows.length, 1);
    assert.notEqual(extension.rows[0]?.nspname, 'public');

    const cronJob = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'cron' AND table_name = 'job'`,
    );
    assert.equal(cronJob.rows.length, 1);
  });

  it('schedules execute and call jobs from generated SQL', async () => {
    await cleanupCronArtifacts(pool);
    await applySchema(baseSchema);

    const jobs = await listJobs([
      'expire_sessions',
      'nightly_vacuum',
      'purge_old_rows',
    ]);

    assert.equal(jobs.length, 3);

    const byName = new Map(jobs.map((job) => [job.jobname, job]));
    assert.equal(byName.get('expire_sessions')?.schedule, '0 * * * *');
    assert.equal(byName.get('expire_sessions')?.command, 'SELECT expire_sessions()');
    assert.equal(byName.get('nightly_vacuum')?.schedule, '0 3 * * *');
    assert.equal(byName.get('nightly_vacuum')?.command, 'VACUUM ANALYZE');
    assert.equal(byName.get('purge_old_rows')?.schedule, '30 seconds');
    assert.match(byName.get('purge_old_rows')?.command ?? '', /DELETE FROM cron_test_marker/);
    assert.equal(byName.get('purge_old_rows')?.active, true);
  });

  it('replaces a job schedule via migration diff', async () => {
    await cleanupCronArtifacts(pool);
    await applySchema(baseSchema);

    const sql = await applyDiff(baseSchema, replacedScheduleSchema);
    assert.match(sql, /cron\.schedule/);
    assert.match(sql, /expire_sessions/);

    const jobs = await listJobs(['expire_sessions']);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.schedule, '30 * * * *');
    assert.equal(jobs[0]?.command, 'SELECT expire_sessions()');
  });

  it('drops cron jobs before dropping called functions', async () => {
    await cleanupCronArtifacts(pool);
    await applySchema(callOnlySchema);

    const before = await listJobs(['bump_marker']);
    assert.equal(before.length, 1);

    const sql = await applyDiff(callOnlySchema, emptyCronSchema);
    const dropCronIndex = sql.indexOf("WHERE jobname = 'bump_marker'");
    const dropFunctionIndex = sql.indexOf('DROP FUNCTION IF EXISTS bump_marker()');
    assert.ok(dropCronIndex >= 0);
    // emptyCronSchema still keeps bumpMarker function — only drop the job
    assert.equal(dropFunctionIndex, -1);

    const after = await listJobs(['bump_marker']);
    assert.equal(after.length, 0);

    const fn = await pool.query(
      `SELECT 1 FROM pg_proc WHERE proname = 'bump_marker'`,
    );
    assert.equal(fn.rows.length, 1);
  });

  it('drops a called function only after unscheduling its job', async () => {
    await cleanupCronArtifacts(pool);
    await applySchema(callOnlySchema);

    const noJobsNoFn = `extensions {
  pg_cron
}

cron {}`;

    const oldSchema = parse(callOnlySchema);
    const newSchema = parse(noJobsNoFn);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema, oldSchema);

    const dropCronIndex = sql.indexOf("WHERE jobname = 'bump_marker'");
    const dropFunctionIndex = sql.indexOf('DROP FUNCTION IF EXISTS bump_marker()');
    assert.ok(dropCronIndex >= 0);
    assert.ok(dropFunctionIndex > dropCronIndex);

    await pool.query(sql);

    const jobs = await listJobs(['bump_marker']);
    assert.equal(jobs.length, 0);

    const fn = await pool.query(
      `SELECT 1 FROM pg_proc WHERE proname = 'bump_marker'`,
    );
    assert.equal(fn.rows.length, 0);
  });

  it('runs a short-interval call job against the database', async () => {
    await cleanupCronArtifacts(pool);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cron_test_marker (
        kind TEXT PRIMARY KEY,
        hits INTEGER NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`
      INSERT INTO cron_test_marker (kind, hits) VALUES ('run', 0)
      ON CONFLICT (kind) DO UPDATE SET hits = 0
    `);

    await applySchema(callOnlySchema);

    const started = Date.now();
    let hits = 0;
    while (Date.now() - started < 8000) {
      const result = await pool.query<{ hits: number }>(
        `SELECT hits FROM cron_test_marker WHERE kind = 'run'`,
      );
      hits = Number(result.rows[0]?.hits ?? 0);
      if (hits > 0) {
        break;
      }
      await sleep(500);
    }

    assert.ok(hits > 0, `expected bumpMarker cron job to run, hits=${hits}`);
  });
});

async function assertPgCronReady(pool: Pool): Promise<void> {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `pg_cron is not available. Rebuild Postgres with: npm run docker:reset\n${message}`,
    );
  }

  const preload = await pool.query<{ setting: string }>(
    `SHOW shared_preload_libraries`,
  );
  const setting = preload.rows[0]?.setting ?? '';
  if (!setting.includes('pg_cron')) {
    // Some clients see an empty GUC briefly after recreate; verify the worker via cron schema.
    const cronSchema = await pool.query(
      `SELECT 1 FROM pg_namespace WHERE nspname = 'cron'`,
    );
    if (cronSchema.rows.length === 0) {
      throw new Error(
        `shared_preload_libraries must include pg_cron (got ${JSON.stringify(setting)}). Rebuild with: npm run docker:reset`,
      );
    }
  }

  const databaseName = await pool.query<{ setting: string }>(`SHOW cron.database_name`);
  const configured = databaseName.rows[0]?.setting ?? '';
  if (configured.length > 0 && configured !== 'postgrest') {
    throw new Error(
      `cron.database_name is "${configured}", expected "postgrest". Rebuild with: npm run docker:reset`,
    );
  }
}

async function cleanupCronArtifacts(pool: Pool): Promise<void> {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_cron`);
    await pool.query(`
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname IN (
        'expire_sessions',
        'nightly_vacuum',
        'purge_old_rows',
        'bump_marker'
      )
    `);
  } catch {
    // Extension may be missing before the image is rebuilt.
  }

  await pool.query('DROP FUNCTION IF EXISTS expire_sessions()').catch(() => undefined);
  await pool.query('DROP FUNCTION IF EXISTS bump_marker()').catch(() => undefined);
  await pool.query('DROP TABLE IF EXISTS cron_test_marker CASCADE').catch(() => undefined);
  await pool.query(`
    CREATE TABLE cron_test_marker (
      kind TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
