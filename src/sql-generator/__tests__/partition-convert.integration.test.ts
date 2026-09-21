import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { parse } from '../../schema-dsl/index.js';
import { wrapModels } from '../../schema-dsl/__tests__/helpers.js';
import {
  assertDockerPostgres,
} from '../../__tests__/helpers/integration.js';
import { MigrationPlanner } from '../migration-planner.js';
import { MigrationSqlGenerator } from '../migration-sql-generator.js';
import { generateTableWithPartitions } from '../generators/tables.js';
import { getEnumNames, getModelNames } from '../utils/ast-helpers.js';

const heapSource = wrapModels(`model Log {
  id: UUID
  createdAt: TIMESTAMP
  message: TEXT
  @@id(fields: [id, createdAt])
}`);

const partitionedSource = wrapModels(`model Log {
  id: UUID
  createdAt: TIMESTAMP
  message: TEXT
  @@id(fields: [id, createdAt])
  @@partition {
    by: RANGE
    fields: [createdAt]
    partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
    partition Log2025 { from: "2025-01-01", to: "2026-01-01" }
  }
}`);

describe('partition convert integration (Docker)', { concurrency: 1 }, () => {
  let pool: Pool;
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();

  before(async () => {
    pool = await assertDockerPostgres();
  });

  after(async () => {
    await pool.end();
  });

  async function resetLogTables(): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS log CASCADE');
    await pool.query('DROP TABLE IF EXISTS log_pre_partition CASCADE');
  }

  function convertSql(oldSource: string, newSource: string): string {
    const oldSchema = parse(oldSource);
    const newSchema = parse(newSource);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    return sqlGenerator.generate(migrations, newSchema, oldSchema);
  }

  it('converts a heap table to partitioned and preserves rows', async () => {
    await resetLogTables();

    const heapSchema = parse(heapSource);
    const enumNames = getEnumNames(heapSchema);
    const modelNames = getModelNames(heapSchema);
    const createSql = generateTableWithPartitions(
      heapSchema.models[0]!,
      enumNames,
      modelNames,
    ).join('\n');

    await pool.query(createSql);
    await pool.query(`
      INSERT INTO log (id, created_at, message) VALUES
        ('11111111-1111-1111-1111-111111111111', '2024-06-15', 'mid-2024'),
        ('22222222-2222-2222-2222-222222222222', '2025-03-01', 'early-2025')
    `);

    const sql = convertSql(heapSource, partitionedSource);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    const relkind = await pool.query<{ relkind: string }>(
      `SELECT c.relkind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'log'`,
    );
    assert.equal(relkind.rows[0]?.relkind, 'p');

    const children = await pool.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_inherits i
       JOIN pg_class c ON c.oid = i.inhrelid
       JOIN pg_class p ON p.oid = i.inhparent
       WHERE p.relname = 'log'
       ORDER BY c.relname`,
    );
    assert.deepEqual(
      children.rows.map((row) => row.relname),
      ['log_2024', 'log_2025'],
    );

    const rows = await pool.query<{ message: string }>(
      'SELECT message FROM log ORDER BY created_at',
    );
    assert.deepEqual(
      rows.rows.map((row) => row.message),
      ['mid-2024', 'early-2025'],
    );

    const child2024 = await pool.query('SELECT message FROM log_2024');
    assert.deepEqual(
      child2024.rows.map((row) => (row as { message: string }).message),
      ['mid-2024'],
    );
  });

  it('rolls back when a row matches no partition', async () => {
    await resetLogTables();

    const heapSchema = parse(heapSource);
    const enumNames = getEnumNames(heapSchema);
    const modelNames = getModelNames(heapSchema);
    const createSql = generateTableWithPartitions(
      heapSchema.models[0]!,
      enumNames,
      modelNames,
    ).join('\n');

    await pool.query(createSql);
    await pool.query(`
      INSERT INTO log (id, created_at, message) VALUES
        ('33333333-3333-3333-3333-333333333333', '2023-01-01', 'out-of-range')
    `);

    const sql = convertSql(heapSource, partitionedSource);
    await pool.query('BEGIN');
    await assert.rejects(async () => {
      await pool.query(sql);
    });
    await pool.query('ROLLBACK');

    const relkind = await pool.query<{ relkind: string }>(
      `SELECT c.relkind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'log'`,
    );
    assert.equal(relkind.rows[0]?.relkind, 'r');

    const rows = await pool.query<{ message: string }>('SELECT message FROM log');
    assert.deepEqual(
      rows.rows.map((row) => row.message),
      ['out-of-range'],
    );
  });

  it('converts a partitioned table back to a heap table', async () => {
    await resetLogTables();

    const partitionedSchema = parse(partitionedSource);
    const enumNames = getEnumNames(partitionedSchema);
    const modelNames = getModelNames(partitionedSchema);
    const createSql = generateTableWithPartitions(
      partitionedSchema.models[0]!,
      enumNames,
      modelNames,
    ).join('\n');

    await pool.query(createSql);
    await pool.query(`
      INSERT INTO log (id, created_at, message) VALUES
        ('44444444-4444-4444-4444-444444444444', '2024-02-01', 'keep-me')
    `);

    const sql = convertSql(partitionedSource, heapSource);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    const relkind = await pool.query<{ relkind: string }>(
      `SELECT c.relkind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'log'`,
    );
    assert.equal(relkind.rows[0]?.relkind, 'r');

    const children = await pool.query(
      `SELECT 1
       FROM pg_inherits i
       JOIN pg_class p ON p.oid = i.inhparent
       WHERE p.relname = 'log'`,
    );
    assert.equal(children.rowCount, 0);

    const rows = await pool.query<{ message: string }>('SELECT message FROM log');
    assert.deepEqual(
      rows.rows.map((row) => row.message),
      ['keep-me'],
    );
  });
});
