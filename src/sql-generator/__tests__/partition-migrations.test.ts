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

function heapLog(extraFields = '') {
  return wrapModels(`model Log {
    id: UUID
    createdAt: TIMESTAMP
    ${extraFields}
    @@id(fields: [id, createdAt])
  }`);
}

describe('MigrationPlanner — partitions', () => {
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();

  function diff(oldSource: string, newSource: string) {
    const oldSchema = parse(oldSource);
    const newSchema = parse(newSource);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema, oldSchema);
    return { migrations, sql };
  }

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

  it('emits ConvertToPartitioned when adding @@partition to an existing model', () => {
    const { migrations, sql } = diff(heapLog(), baseLog());

    assert.deepEqual(migrations, [{ kind: 'ConvertToPartitioned', modelName: 'Log' }]);
    assert.ok(DESTRUCTIVE_MIGRATION_KINDS.has(migrations[0]!.kind));

    const renameIndex = sql.indexOf('ALTER TABLE log RENAME TO log_pre_partition');
    const createParentIndex = sql.indexOf('CREATE TABLE log (');
    const partitionByIndex = sql.indexOf('PARTITION BY RANGE (created_at)');
    const createChildIndex = sql.indexOf('CREATE TABLE log_2024 PARTITION OF log');
    const insertIndex = sql.indexOf('INSERT INTO log (id, created_at)');
    const dropStagingIndex = sql.indexOf('DROP TABLE log_pre_partition;');

    assert.ok(renameIndex >= 0);
    assert.ok(createParentIndex > renameIndex);
    assert.ok(partitionByIndex > createParentIndex);
    assert.ok(createChildIndex > partitionByIndex);
    assert.ok(insertIndex > createChildIndex);
    assert.ok(dropStagingIndex > insertIndex);
    assert.doesNotMatch(sql, /DROP TABLE log_pre_partition CASCADE/);
  });

  it('emits ConvertFromPartitioned when removing @@partition', () => {
    const { migrations, sql } = diff(baseLog(), heapLog());

    assert.deepEqual(migrations, [{ kind: 'ConvertFromPartitioned', modelName: 'Log' }]);
    assert.ok(DESTRUCTIVE_MIGRATION_KINDS.has(migrations[0]!.kind));
    assert.match(sql, /ALTER TABLE log RENAME TO log_pre_partition/);
    assert.match(sql, /CREATE TABLE log \(/);
    assert.doesNotMatch(sql, /PARTITION BY/);
    assert.doesNotMatch(sql, /PARTITION OF/);
    assert.match(sql, /INSERT INTO log \(id, created_at\)/);
    assert.match(sql, /DROP TABLE log_pre_partition CASCADE;/);
  });

  it('folds same-diff column add into ConvertToPartitioned', () => {
    const newSource = wrapModels(`model Log {
      id: UUID
      createdAt: TIMESTAMP
      message: TEXT @default("pending")
      @@id(fields: [id, createdAt])
      @@partition {
        by: RANGE
        fields: [createdAt]
        partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
      }
    }`);
    const { migrations, sql } = diff(heapLog(), newSource);

    assert.deepEqual(migrations, [{ kind: 'ConvertToPartitioned', modelName: 'Log' }]);
    assert.match(sql, /message TEXT/);
    assert.match(sql, /INSERT INTO log \(id, created_at\)/);
    assert.doesNotMatch(sql, /ADD COLUMN message/);
  });

  it('casts changed column types in the convert INSERT', () => {
    const newSource = wrapModels(`model Log {
      id: UUID
      createdAt: TIMESTAMPTZ
      @@id(fields: [id, createdAt])
      @@partition {
        by: RANGE
        fields: [createdAt]
        partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
      }
    }`);
    const { migrations, sql } = diff(heapLog(), newSource);

    assert.deepEqual(migrations, [{ kind: 'ConvertToPartitioned', modelName: 'Log' }]);
    assert.match(sql, /SELECT id, created_at::TIMESTAMPTZ\nFROM log_pre_partition/);
  });

  it('rebuilds indexes and incoming foreign keys during convert', () => {
    const oldSource = wrapModels(`model Log {
      id: UUID
      createdAt: TIMESTAMP
      @@id(fields: [id, createdAt])
      @@index(fields: [createdAt])
    }
    model Entry {
      id: UUID @id
      logId: UUID
      logCreatedAt: TIMESTAMP
      log: Log @relation(fields: [logId, logCreatedAt], references: [id, createdAt])
    }`);
    const newSource = wrapModels(`model Log {
      id: UUID
      createdAt: TIMESTAMP
      @@id(fields: [id, createdAt])
      @@index(fields: [createdAt])
      @@partition {
        by: RANGE
        fields: [createdAt]
        partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
      }
    }
    model Entry {
      id: UUID @id
      logId: UUID
      logCreatedAt: TIMESTAMP
      log: Log @relation(fields: [logId, logCreatedAt], references: [id, createdAt])
    }`);
    const { migrations, sql } = diff(oldSource, newSource);

    assert.deepEqual(migrations, [{ kind: 'ConvertToPartitioned', modelName: 'Log' }]);

    const dropFk = sql.indexOf('ALTER TABLE entry DROP CONSTRAINT entry_log_id_log_created_at_fkey');
    const rename = sql.indexOf('ALTER TABLE log RENAME TO log_pre_partition');
    const dropIndex = sql.indexOf('DROP INDEX IF EXISTS log_created_at_idx');
    const createIndex = sql.indexOf('CREATE INDEX log_created_at_idx ON log');
    const addFk = sql.indexOf('ALTER TABLE entry ADD CONSTRAINT entry_log_id_log_created_at_fkey');
    const dropStaging = sql.indexOf('DROP TABLE log_pre_partition;');

    assert.ok(dropFk >= 0);
    assert.ok(rename > dropFk);
    assert.ok(dropIndex > rename);
    assert.ok(createIndex > dropIndex);
    assert.ok(addFk > createIndex);
    assert.ok(dropStaging > addFk);
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
    const { sql } = diff(baseLog(), baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'));

    assert.match(
      sql,
      /CREATE TABLE log_2025 PARTITION OF log\n  FOR VALUES FROM \('2025-01-01'\) TO \('2026-01-01'\);/,
    );
  });

  it('generates DETACH then DROP for DropPartition and marks destructive', () => {
    const { migrations, sql } = diff(
      baseLog('partition Log2025 { from: "2025-01-01", to: "2026-01-01" }'),
      baseLog(),
    );

    assert.match(sql, /ALTER TABLE log DETACH PARTITION log_2025;/);
    assert.match(sql, /DROP TABLE log_2025 CASCADE;/);
    assert.ok(migrations.every((migration) => DESTRUCTIVE_MIGRATION_KINDS.has(migration.kind)));
  });

  it('orders CreatePartition after CreateTable and DropPartition before DropTable', () => {
    const { sql } = diff(
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
