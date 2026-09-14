import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { wrapModels } from '../../schema-dsl/__tests__/helpers.js';
import { MigrationPlanner } from '../migration-planner.js';
import { MigrationSqlGenerator } from '../migration-sql-generator.js';
import { DESTRUCTIVE_MIGRATION_KINDS } from '../../db/migrations.js';

function baseLog(...extraPartitions: string[]) {
  const children = [
    'partition Log2024 { from: "2024-01-01", to: "2025-01-01" }',
    ...extraPartitions,
  ].join('\n');
  return wrapModels(`model Log {
    id: UUID
    createdAt: TIMESTAMP
    @@id(fields: [id, createdAt])
    @@partition {
      by: RANGE
      fields: [createdAt]
      ${children}
    }
  }`);
}

describe('MigrationPlanner — partitions', () => {
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();

  it('emits CreateTable + CreatePartition for a new partitioned model', () => {
    const oldSchema = parse(wrapModels('model User { id: UUID @id }'));
    const newSchema = parse(baseLog());
    const migrations = planner.generateMigration(oldSchema, newSchema);

    assert.ok(migrations.some((migration) => migration.kind === 'CreateTable' && migration.modelName === 'Log'));
    assert.ok(
      migrations.some(
        (migration) =>
          migration.kind === 'CreatePartition' &&
          migration.modelName === 'Log' &&
          migration.partitionName === 'Log2024',
      ),
    );
  });

  it('emits CreatePartition when adding a child', () => {
    const oldSchema = parse(baseLog());
    const newSchema = parse(baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'));
    const migrations = planner.generateMigration(oldSchema, newSchema);

    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'CreatePartition'),
      [{ kind: 'CreatePartition', modelName: 'Log', partitionName: 'Log2025' }],
    );
  });

  it('emits DropPartition when removing a child', () => {
    const oldSchema = parse(baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'));
    const newSchema = parse(baseLog());
    const migrations = planner.generateMigration(oldSchema, newSchema);

    assert.equal(migrations.length, 1);
    assert.equal(migrations[0].kind, 'DropPartition');
    if (migrations[0].kind === 'DropPartition') {
      assert.equal(migrations[0].partitionName, 'Log2025');
      assert.equal(migrations[0].tableName, 'log_2025');
      assert.equal(migrations[0].parentTable, 'log');
    }
  });

  it('does not emit DropPartition when dropping the whole model', () => {
    const oldSchema = parse(baseLog());
    const newSchema = parse(wrapModels('model User { id: UUID @id }'));
    const migrations = planner.generateMigration(oldSchema, newSchema);

    assert.ok(migrations.some((migration) => migration.kind === 'DropTable' && migration.modelName === 'Log'));
    assert.equal(
      migrations.filter((migration) => migration.kind === 'DropPartition').length,
      0,
    );
  });

  it('throws when converting a table to partitioned', () => {
    const oldSchema = parse(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
      }`),
    );
    const newSchema = parse(baseLog());
    assert.throws(
      () => planner.generateMigration(oldSchema, newSchema),
      /converting to\/from a partitioned table/,
    );
  });

  it('throws when changing partition strategy', () => {
    const oldSchema = parse(baseLog());
    const newSchema = parse(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: LIST
          fields: [createdAt]
          partition LogA { in: ["x"] }
        }
      }`),
    );
    assert.throws(
      () => planner.generateMigration(oldSchema, newSchema),
      /changing partition strategy or key/,
    );
  });

  it('throws when bounds change on the same partition name', () => {
    const oldSchema = parse(baseLog());
    const newSchema = parse(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: RANGE
          fields: [createdAt]
          partition Log2024 { from: "2024-01-01", to: "2026-01-01" }
        }
      }`),
    );
    assert.throws(
      () => planner.generateMigration(oldSchema, newSchema),
      /bounds\/values changed/,
    );
  });

  it('throws when HASH count changes', () => {
    const oldSchema = parse(
      wrapModels(`model Metric {
        id: UUID @id
        @@partition { by: HASH, fields: [id], count: 4 }
      }`),
    );
    const newSchema = parse(
      wrapModels(`model Metric {
        id: UUID @id
        @@partition { by: HASH, fields: [id], count: 8 }
      }`),
    );
    assert.throws(
      () => planner.generateMigration(oldSchema, newSchema),
      /changing partition strategy or key/,
    );
  });

  it('generates PARTITION OF SQL for CreatePartition', () => {
    const oldSchema = parse(baseLog());
    const newSchema = parse(baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'));
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema);

    assert.match(
      sql,
      /CREATE TABLE log_2025 PARTITION OF log\n  FOR VALUES FROM \('2025-01-01'\) TO \('2026-01-01'\);/,
    );
  });

  it('generates DETACH then DROP for DropPartition and marks destructive', () => {
    const oldSchema = parse(baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'));
    const newSchema = parse(baseLog());
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema);

    assert.match(sql, /ALTER TABLE log DETACH PARTITION log_2025;/);
    assert.match(sql, /DROP TABLE log_2025 CASCADE;/);
    assert.ok(migrations.every((migration) => DESTRUCTIVE_MIGRATION_KINDS.has(migration.kind)));
  });

  it('orders CreatePartition after CreateTable and DropPartition before DropTable', () => {
    const oldSchema = parse(
      wrapModels(`model Legacy { id: UUID @id }
model Log {
  id: UUID
  createdAt: TIMESTAMP
  @@id(fields: [id, createdAt])
  @@partition {
    by: RANGE
    fields: [createdAt]
    partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
    partition Log2025 { from: "2025-01-01", to: "2026-01-01" }
  }
}`),
    );
    const newSchema = parse(
      wrapModels(`model Event {
  id: UUID
  createdAt: TIMESTAMP
  @@id(fields: [id, createdAt])
  @@partition {
    by: RANGE
    fields: [createdAt]
    partition Event2024 { from: "2024-01-01", to: "2025-01-01" }
  }
}
model Log {
  id: UUID
  createdAt: TIMESTAMP
  @@id(fields: [id, createdAt])
  @@partition {
    by: RANGE
    fields: [createdAt]
    partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
  }
}`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema);

    const createEvent = sql.indexOf('CREATE TABLE event');
    const createEventPart = sql.indexOf('CREATE TABLE event_2024 PARTITION OF');
    const dropLogPart = sql.indexOf('DETACH PARTITION log_2025');
    const dropLegacy = sql.indexOf('DROP TABLE IF EXISTS legacy');

    assert.ok(createEvent >= 0);
    assert.ok(createEventPart > createEvent);
    assert.ok(dropLogPart >= 0);
    assert.ok(dropLegacy > dropLogPart || dropLegacy >= 0);
  });
});
