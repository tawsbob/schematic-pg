import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { MigrationPlanner } from '../migration-planner.js';
import { wrapModels } from '../../schema-dsl/__tests__/helpers.js';

describe('MigrationPlanner', () => {
  const planner = new MigrationPlanner();

  it('detects added and dropped models', () => {
    const oldSchema = parse(wrapModels('model User { id: UUID @id }'));
    const newSchema = parse(
      wrapModels(`model User { id: UUID @id }
model Order { id: UUID @id }`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'CreateTable'),
      [{ kind: 'CreateTable', modelName: 'Order' }],
    );

    const reverse = planner.generateMigration(newSchema, oldSchema);
    assert.deepEqual(
      reverse.filter((migration) => migration.kind === 'DropTable'),
      [{ kind: 'DropTable', modelName: 'Order' }],
    );
  });

  it('detects added and dropped stored fields', () => {
    const oldSchema = parse(wrapModels('model User { id: UUID @id email: VARCHAR(255) }'));
    const newSchema = parse(
      wrapModels(`model User { id: UUID @id name: VARCHAR(150) profile: Profile? }
model Profile { id: UUID @id userId: UUID }`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'AddColumn'),
      [{ kind: 'AddColumn', modelName: 'User', fieldName: 'name' }],
    );
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'DropColumn'),
      [{ kind: 'DropColumn', modelName: 'User', fieldName: 'email' }],
    );
    assert.equal(
      migrations.some((migration) => migration.kind === 'AddColumn' && migration.fieldName === 'profile'),
      false,
    );
    assert.ok(migrations.some((migration) => migration.kind === 'CreateTable' && migration.modelName === 'Profile'));
  });

  it('detects type, nullability, and default changes', () => {
    const oldSchema = parse(
      wrapModels('model User { id: UUID @id age: SMALLINT balance: INTEGER @default(0) }'),
    );
    const newSchema = parse(
      wrapModels('model User { id: UUID @id age: SMALLINT? balance: INTEGER @default(1) name: TEXT }'),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(
      migrations.some(
        (migration) =>
          migration.kind === 'AlterColumn' &&
          migration.fieldName === 'age' &&
          migration.change.type === 'nullability',
      ),
    );
    assert.ok(
      migrations.some(
        (migration) =>
          migration.kind === 'AlterColumn' &&
          migration.fieldName === 'balance' &&
          migration.change.type === 'default',
      ),
    );
    assert.ok(
      migrations.some(
        (migration) => migration.kind === 'AddColumn' && migration.fieldName === 'name',
      ),
    );
  });

  it('detects index additions and removals', () => {
    const oldSchema = parse(
      wrapModels(`model User {
        id: UUID @id
        email: VARCHAR(255)
        @@index(fields: [email])
      }`),
    );
    const newSchema = parse(
      wrapModels(`model User {
        id: UUID @id
        email: VARCHAR(255)
        name: VARCHAR(150)
        @@index(fields: [name])
      }`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'CreateIndex'));
    assert.ok(migrations.some((migration) => migration.kind === 'DropIndex'));
  });

  it('detects added enums and enum values', () => {
    const oldSchema = parse(`extensions {}\nenums { UserRole { ADMIN, USER } }\nmodels {}`);
    const newSchema = parse(
      `extensions {}\nenums { UserRole { ADMIN, USER, PUBLIC } OrderStatus { PENDING } }\nmodels {}`,
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'CreateEnum'),
      [{ kind: 'CreateEnum', enumName: 'OrderStatus' }],
    );
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'AddEnumValue'),
      [{ kind: 'AddEnumValue', enumName: 'UserRole', value: 'PUBLIC' }],
    );
  });

  it('detects added and dropped foreign keys', () => {
    const oldSchema = parse(
      wrapModels(`model User { id: UUID @id }
model Profile { id: UUID @id userId: UUID }`),
    );
    const newSchema = parse(
      wrapModels(`model User { id: UUID @id profile: Profile? @relation(name: "UserProfile") }
model Profile { id: UUID @id userId: UUID user: User @relation(name: "UserProfile", fields: [userId], references: [id]) }`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'AddConstraint'));

    const reverse = planner.generateMigration(newSchema, oldSchema);
    assert.ok(reverse.some((migration) => migration.kind === 'DropConstraint'));
  });

  it('detects added and dropped extensions', () => {
    const oldSchema = parse(`extensions { pgcrypto }\nenums {}\nmodels {}`);
    const newSchema = parse(`extensions { pgcrypto citext }\nenums {}\nmodels {}`);

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.deepEqual(
      migrations.filter((migration) => migration.kind === 'CreateExtension'),
      [{ kind: 'CreateExtension', extensionName: 'citext' }],
    );

    const reverse = planner.generateMigration(newSchema, oldSchema);
    assert.deepEqual(
      reverse.filter((migration) => migration.kind === 'DropExtension'),
      [{ kind: 'DropExtension', extensionName: 'citext' }],
    );
  });

  it('detects added and dropped triggers', () => {
    const oldSchema = parse(
      wrapModels(`model User {
        id: UUID @id
      }`),
    );
    const newSchema = parse(
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

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'CreateTrigger'));

    const reverse = planner.generateMigration(newSchema, oldSchema);
    assert.ok(reverse.some((migration) => migration.kind === 'DropTrigger'));
  });

  it('detects trigger body changes as drop and create', () => {
    const oldSchema = parse(
      wrapModels(`model User {
        id: UUID @id
        @@trigger {
          timing: BEFORE,
          event: UPDATE,
          execute: """
            RETURN OLD;
          """
        }
      }`),
    );
    const newSchema = parse(
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

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'DropTrigger'));
    assert.ok(migrations.some((migration) => migration.kind === 'CreateTrigger'));
  });

  it('detects triggers on newly added models', () => {
    const oldSchema = parse(wrapModels('model User { id: UUID @id }'));
    const newSchema = parse(
      wrapModels(`model User { id: UUID @id }
model Audit {
  id: UUID @id
  @@trigger {
    timing: AFTER,
    event: INSERT,
    execute: """
      RETURN NEW;
    """
  }
}`),
    );

    const migrations = planner.generateMigration(oldSchema, newSchema);
    assert.ok(migrations.some((migration) => migration.kind === 'CreateTable' && migration.modelName === 'Audit'));
    assert.ok(migrations.some((migration) => migration.kind === 'CreateTrigger' && migration.modelName === 'Audit'));
  });
});
