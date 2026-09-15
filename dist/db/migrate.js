import { loadSchemaFromArg } from '../schema-source/index.js';
import { DatabaseClient } from './client.js';
import { listPendingMigrations, readMigrationSql, recordAppliedMigration, } from './migrations.js';
import { writeSnapshotSource } from './schema-state.js';
export async function applyPendingMigrations(schemaPath, client = new DatabaseClient(), cwd = process.cwd()) {
    const applied = [];
    await client.withClient(async (pgClient) => {
        const pending = await listPendingMigrations(pgClient, cwd);
        if (pending.length === 0) {
            return;
        }
        for (const migration of pending) {
            await applyMigration(pgClient, migration);
            applied.push(migration);
        }
        const { canonicalSource } = loadSchemaFromArg(schemaPath, cwd);
        writeSnapshotSource(canonicalSource, cwd);
    });
    return applied;
}
async function applyMigration(client, migration) {
    const sql = readMigrationSql(migration);
    await client.query('BEGIN');
    try {
        await client.query(sql);
        await recordAppliedMigration(client, migration);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}
