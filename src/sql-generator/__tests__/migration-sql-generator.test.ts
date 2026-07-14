import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { wrapModels } from '../../schema-dsl/__tests__/helpers.js';
import { MigrationPlanner } from '../migration-planner.js';
import { MigrationSqlGenerator } from '../migration-sql-generator.js';

describe('MigrationSqlGenerator', () => {
  const planner = new MigrationPlanner();
  const sqlGenerator = new MigrationSqlGenerator();

  function diffSql(oldSource: string, newSource: string): string {
    const oldSchema = parse(oldSource);
    const newSchema = parse(newSource);
    const migrations = planner.generateMigration(oldSchema, newSchema);
    return sqlGenerator.generate(migrations, newSchema);
  }

  it('generates CREATE TABLE for added models', () => {
    const sql = diffSql(
      wrapModels('model User { id: UUID @id }'),
      wrapModels(`model User { id: UUID @id }
model Order { id: UUID @id total: INTEGER }`),
    );

    assert.match(sql, /CREATE TABLE "order"/);
    assert.match(sql, /total INTEGER NOT NULL/);
  });

  it('generates DROP TABLE for removed models', () => {
    const sql = diffSql(
      wrapModels(`model User { id: UUID @id }
model Order { id: UUID @id }`),
      wrapModels('model User { id: UUID @id }'),
    );

    assert.match(sql, /DROP TABLE IF EXISTS "order" CASCADE/);
  });

  it('generates ADD COLUMN and DROP COLUMN', () => {
    const sql = diffSql(
      wrapModels('model User { id: UUID @id email: VARCHAR(255) }'),
      wrapModels('model User { id: UUID @id name: VARCHAR(150) }'),
    );

    assert.match(sql, /ALTER TABLE "user" ADD COLUMN name VARCHAR\(150\) NOT NULL/);
    assert.match(sql, /ALTER TABLE "user" DROP COLUMN email/);
  });

  it('generates ALTER COLUMN for nullability and default changes', () => {
    const sql = diffSql(
      wrapModels('model User { id: UUID @id age: SMALLINT balance: INTEGER @default(0) }'),
      wrapModels('model User { id: UUID @id age: SMALLINT? balance: INTEGER @default(1) }'),
    );

    assert.match(sql, /ALTER TABLE "user" ALTER COLUMN age DROP NOT NULL/);
    assert.match(sql, /ALTER TABLE "user" ALTER COLUMN balance SET DEFAULT 1/);
  });

  it('generates ALTER COLUMN for type changes', () => {
    const sql = diffSql(
      wrapModels('model User { id: UUID @id age: SMALLINT }'),
      wrapModels('model User { id: UUID @id age: INTEGER }'),
    );

    assert.match(sql, /ALTER TABLE "user" ALTER COLUMN age TYPE INTEGER USING age::INTEGER/);
  });

  it('generates enum creation and value additions', () => {
    const sql = diffSql(
      `extensions {}\nenums { UserRole { ADMIN, USER } }\nmodels {}`,
      `extensions {}\nenums { UserRole { ADMIN, USER, PUBLIC } OrderStatus { PENDING } }\nmodels {}`,
    );

    assert.match(sql, /CREATE TYPE order_status AS ENUM/);
    assert.match(sql, /ALTER TYPE user_role ADD VALUE 'PUBLIC'/);
  });

  it('generates index creation and removal', () => {
    const sql = diffSql(
      wrapModels(`model User {
        id: UUID @id
        email: VARCHAR(255)
        @@index(fields: [email])
      }`),
      wrapModels(`model User {
        id: UUID @id
        email: VARCHAR(255)
        name: VARCHAR(150)
        @@index(fields: [name])
      }`),
    );

    assert.match(sql, /DROP INDEX IF EXISTS user_email_idx/);
    assert.match(sql, /CREATE INDEX user_name_idx ON "user"/);
  });

  it('generates foreign key add and drop', () => {
    const sql = diffSql(
      wrapModels(`model User { id: UUID @id }
model Profile { id: UUID @id userId: UUID }`),
      wrapModels(`model User { id: UUID @id profile: Profile? @relation(name: "UserProfile") }
model Profile { id: UUID @id userId: UUID user: User @relation(name: "UserProfile", fields: [userId], references: [id]) }`),
    );

    assert.match(sql, /ALTER TABLE profile ADD CONSTRAINT profile_user_id_fkey/);
    assert.match(sql, /FOREIGN KEY \(user_id\) REFERENCES "user" \(id\)/);

    const reverse = diffSql(
      wrapModels(`model User { id: UUID @id profile: Profile? @relation(name: "UserProfile") }
model Profile { id: UUID @id userId: UUID user: User @relation(name: "UserProfile", fields: [userId], references: [id]) }`),
      wrapModels(`model User { id: UUID @id }
model Profile { id: UUID @id userId: UUID }`),
    );

    assert.match(reverse, /ALTER TABLE profile DROP CONSTRAINT profile_user_id_fkey/);
  });

  it('orders destructive operations after additive ones', () => {
    const sql = diffSql(
      wrapModels(`model User { id: UUID @id oldField: TEXT }
model Legacy { id: UUID @id }`),
      wrapModels('model User { id: UUID @id newField: TEXT }'),
    );

    const addColumnIndex = sql.indexOf('ADD COLUMN new_field');
    const dropColumnIndex = sql.indexOf('DROP COLUMN old_field');
    const dropTableIndex = sql.indexOf('DROP TABLE IF EXISTS legacy');

    assert.ok(addColumnIndex >= 0);
    assert.ok(dropColumnIndex > addColumnIndex);
    assert.ok(dropTableIndex > dropColumnIndex);
  });

  it('generates extension creation and removal', () => {
    const sql = diffSql(
      `extensions { pgcrypto }\nenums {}\nmodels {}`,
      `extensions { pgcrypto citext }\nenums {}\nmodels {}`,
    );

    assert.match(sql, /CREATE EXTENSION IF NOT EXISTS "citext"/);

    const reverse = diffSql(
      `extensions { pgcrypto citext }\nenums {}\nmodels {}`,
      `extensions { pgcrypto }\nenums {}\nmodels {}`,
    );

    assert.match(reverse, /DROP EXTENSION IF EXISTS "citext"/);
  });

  it('generates trigger creation and removal', () => {
    const sql = diffSql(
      wrapModels(`model User {
        id: UUID @id
      }`),
      wrapModels(`model User {
        id: UUID @id
        @@trigger {
          timing: BEFORE,
          event: UPDATE,
          execute: """
            RETURN NEW;
          """
        }
      }`),
    );

    assert.match(sql, /CREATE OR REPLACE FUNCTION user_before_update_trigger_func/);
    assert.match(sql, /CREATE TRIGGER user_before_update_trigger/);

    const reverse = diffSql(
      wrapModels(`model User {
        id: UUID @id
        @@trigger {
          timing: BEFORE,
          event: UPDATE,
          execute: """
            RETURN NEW;
          """
        }
      }`),
      wrapModels(`model User {
        id: UUID @id
      }`),
    );

    assert.match(reverse, /DROP TRIGGER IF EXISTS user_before_update_trigger ON "user"/);
    assert.match(reverse, /DROP FUNCTION IF EXISTS user_before_update_trigger_func/);
  });

  it('orders extensions before tables and triggers before table drops', () => {
    const sql = diffSql(
      `extensions { pgcrypto }\nenums {}\nmodels { model Legacy { id: UUID @id } }`,
      `extensions { pgcrypto citext }\nenums {}\nmodels {
        model User {
          id: UUID @id
          @@trigger {
            timing: BEFORE,
            event: UPDATE,
            execute: """
              RETURN NEW;
            """
          }
        }
      }`,
    );

    const createExtensionIndex = sql.indexOf('CREATE EXTENSION IF NOT EXISTS "citext"');
    const createTableIndex = sql.indexOf('CREATE TABLE "user"');
    const createTriggerIndex = sql.indexOf('CREATE TRIGGER user_before_update_trigger');
    const dropTableIndex = sql.indexOf('DROP TABLE IF EXISTS legacy');

    assert.ok(createExtensionIndex >= 0);
    assert.ok(createTableIndex > createExtensionIndex);
    assert.ok(createTriggerIndex > createTableIndex);
    assert.ok(dropTableIndex > createTriggerIndex);
  });
});

describe('schema snapshot and diff integration', () => {
  it('writes snapshot and detects changes from diff module', async () => {
    const { writeSnapshot } = await import('../../db/schema-state.js');
    const { generateSchemaDiff } = await import('../../db/diff.js');

    const cwd = mkdtempSync(join(tmpdir(), 'schema-diff-'));
    const schemaPath = join(cwd, 'app.schema');
    const initial = wrapModels('model User { id: UUID @id }');
    const updated = wrapModels('model User { id: UUID @id name: TEXT }');

    try {
      writeFileSync(schemaPath, initial, 'utf8');
      writeSnapshot(schemaPath, cwd);

      writeFileSync(schemaPath, updated, 'utf8');
      const diff = generateSchemaDiff(schemaPath, cwd);

      assert.ok(diff.migrations.some((migration) => migration.kind === 'AddColumn'));
      assert.match(diff.sql, /ADD COLUMN name TEXT/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('migration file storage', () => {
  it('creates incrementing migration files', async () => {
    const { createMigration, listMigrationFiles } = await import('../../db/migrations.js');

    const cwd = mkdtempSync(join(tmpdir(), 'migrations-'));

    try {
      const first = createMigration('add_user_name', 'SELECT 1;', cwd);
      const second = createMigration('add_user_phone', 'SELECT 2;', cwd);

      assert.equal(first.filename, '0001_add_user_name.sql');
      assert.equal(second.filename, '0002_add_user_phone.sql');
      assert.equal(readFileSync(second.path, 'utf8'), 'SELECT 2;');
      assert.equal(listMigrationFiles(cwd).length, 2);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
