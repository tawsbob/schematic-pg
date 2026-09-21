import { parse } from '../schema-dsl/index.js';
import { loadSchemaFromArg } from '../schema-source/index.js';
import { MigrationPlanner, MigrationSqlGenerator } from '../sql-generator/index.js';
import { DESTRUCTIVE_MIGRATION_KINDS } from './migrations.js';
import { readSnapshotSource } from './schema-state.js';
import { join } from 'node:path';
export function generateSchemaDiff(schemaPath, cwd = process.cwd()) {
    const snapshotSource = readSnapshotSource(cwd);
    if (!snapshotSource) {
        throw new Error(`No schema snapshot found at .schema-state/app.schema. Run db:bootstrap or copy app.schema to initialize the snapshot.`);
    }
    const oldSchema = parse(snapshotSource);
    const { schema: newSchema } = loadSchemaFromArg(schemaPath, cwd);
    const planner = new MigrationPlanner();
    const migrations = planner.generateMigration(oldSchema, newSchema);
    const sql = new MigrationSqlGenerator().generate(migrations, newSchema, oldSchema);
    const hasDestructiveChanges = migrations.some((migration) => DESTRUCTIVE_MIGRATION_KINDS.has(migration.kind));
    return { migrations, sql, hasDestructiveChanges };
}
export function summarizeMigrations(migrations) {
    const counts = new Map();
    for (const migration of migrations) {
        counts.set(migration.kind, (counts.get(migration.kind) ?? 0) + 1);
    }
    return counts;
}
export function defaultSchemaPath(cwd = process.cwd()) {
    return join(cwd, 'app.schema');
}
