import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { SqlGenerator } from '../sql-generator.js';
import { MigrationPlanner } from '../migration-planner.js';
import { MigrationSqlGenerator } from '../migration-sql-generator.js';

const BASE = `models {
  model User {
    id: UUID @id
    email: VARCHAR(255)
    isActive: BOOLEAN
    role: VARCHAR(50)
  }
}`;

function schemaWithViews(viewsBody: string) {
  return parse(`${BASE}

views {
${viewsBody}
}`);
}

describe('SQL generator — views', () => {
  const generator = new SqlGenerator();

  it('emits CREATE OR REPLACE VIEW with explicit column list', () => {
    const schema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    email: VARCHAR(255)
    as: """
      SELECT id, email FROM "user" WHERE is_active = true
    """
  }
`);
    const sql = generator.generate(schema);
    assert.match(sql, /DROP VIEW IF EXISTS active_user CASCADE;/);
    assert.match(sql, /CREATE OR REPLACE VIEW active_user \(id, email\) AS/);
    assert.match(sql, /SELECT id, email FROM "user" WHERE is_active = true/);
    assert.doesNotMatch(sql, /MATERIALIZED VIEW/);

    const dropHeader = sql.indexOf('-- Drop views');
    const createHeader = sql.indexOf('-- Create views');
    assert.ok(dropHeader >= 0);
    assert.ok(createHeader > dropHeader);
  });

  it('emits CREATE MATERIALIZED VIEW WITH DATA and indexes', () => {
    const schema = schemaWithViews(`
  materialized view UserStats {
    role: VARCHAR(50)
    count: INTEGER
    as: """
      SELECT role, count(*)::int AS count FROM "user" GROUP BY role
    """
    @rest(only: [list])
    @@index(fields: [role], unique: true)
  }
`);
    const sql = generator.generate(schema);
    assert.match(sql, /DROP MATERIALIZED VIEW IF EXISTS user_stats CASCADE;/);
    assert.match(sql, /CREATE MATERIALIZED VIEW user_stats \(role, count\) AS/);
    assert.match(sql, /WITH DATA;/);
    assert.match(sql, /CREATE UNIQUE INDEX user_stats_role_idx ON user_stats \(role\);/);
  });
});

describe('MigrationPlanner — views', () => {
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();

  it('creates a new plain view', () => {
    const oldSchema = parse(BASE);
    const newSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
  }
`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'CreateView'),
      [{ kind: 'CreateView', viewName: 'ActiveUser' }],
    );
  });

  it('replaces plain view when only query changes', () => {
    const oldSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\" WHERE is_active = true"
  }
`);
    const newSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\" WHERE is_active = false"
  }
`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'ReplaceView'),
      [{ kind: 'ReplaceView', viewName: 'ActiveUser' }],
    );
  });

  it('drops and recreates when columns change', () => {
    const oldSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
  }
`);
    const newSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    email: VARCHAR(255)
    as: "SELECT id, email FROM \\"user\\""
  }
`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'DropView'));
    assert.ok(migrations.some((migration) => migration.kind === 'CreateView'));
  });

  it('flips kind with drop old + create new', () => {
    const oldSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
  }
`);
    const newSchema = schemaWithViews(`
  materialized view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
  }
`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'DropView'));
    assert.ok(migrations.some((migration) => migration.kind === 'CreateMaterializedView'));
  });

  it('orders DropView before DropColumn', () => {
    const oldSchema = schemaWithViews(`
  view ActiveUser {
    id: UUID @id
    email: VARCHAR(255)
    as: "SELECT id, email FROM \\"user\\""
  }
`);
    const newSchema = parse(`models {
  model User {
    id: UUID @id
    isActive: BOOLEAN
    role: VARCHAR(50)
  }
}`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = sqlGenerator.generate(migrations, newSchema, oldSchema);
    const dropViewAt = sql.indexOf('DROP VIEW');
    const dropColumnAt = sql.indexOf('DROP COLUMN');
    assert.ok(dropViewAt >= 0);
    assert.ok(dropColumnAt >= 0);
    assert.ok(dropViewAt < dropColumnAt);
  });

  it('recreates matview indexes with definition and skips separate index ops', () => {
    const oldSchema = schemaWithViews(`
  materialized view UserStats {
    role: VARCHAR(50)
    count: INTEGER
    as: "SELECT role, count(*)::int AS count FROM \\"user\\" GROUP BY role"
    @rest(only: [list])
    @@index(fields: [role], unique: true)
  }
`);
    const newSchema = schemaWithViews(`
  materialized view UserStats {
    role: VARCHAR(50)
    count: INTEGER
    as: "SELECT role, count(*)::int AS count FROM \\"user\\" WHERE is_active = true GROUP BY role"
    @rest(only: [list])
    @@index(fields: [role], unique: true)
  }
`);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'DropMaterializedView'));
    assert.ok(migrations.some((migration) => migration.kind === 'CreateMaterializedView'));
    assert.equal(
      migrations.filter((migration) => migration.kind === 'CreateIndex' || migration.kind === 'DropIndex')
        .length,
      0,
    );

    const sql = sqlGenerator.generate(migrations, newSchema, oldSchema);
    assert.match(sql, /DROP MATERIALIZED VIEW/);
    assert.match(sql, /CREATE MATERIALIZED VIEW/);
    assert.match(sql, /CREATE UNIQUE INDEX user_stats_role_idx/);
  });
});
