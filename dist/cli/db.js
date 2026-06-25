import { bootstrapDatabase } from '../db/bootstrap.js';
import { DatabaseClient } from '../db/client.js';
import { generateSchemaDiff, summarizeMigrations } from '../db/diff.js';
import { applyPendingMigrations } from '../db/migrate.js';
import { createMigration, getAppliedMigrationFilenames, listMigrationFiles } from '../db/migrations.js';
import { snapshotExists } from '../db/schema-state.js';
import { resolveSchemaPath } from './paths.js';
import { waitForDatabase } from './wait-for-database.js';
function parseDiffArgs(args) {
    let schemaPath = resolveSchemaPath();
    let name;
    let print = false;
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--print') {
            print = true;
            continue;
        }
        if (arg === '--name') {
            name = args[index + 1];
            index++;
            continue;
        }
        if (!arg.startsWith('--')) {
            schemaPath = resolveSchemaPath(arg);
        }
    }
    return { schemaPath, name, print };
}
function parseMigrateArgs(args) {
    const command = args[0] === 'status' ? 'status' : 'migrate';
    const schemaArg = args.find((arg) => !arg.startsWith('--') && arg !== 'status');
    const schemaPath = resolveSchemaPath(schemaArg);
    return { command, schemaPath };
}
export async function runDbPing() {
    const client = new DatabaseClient();
    try {
        const result = await client.query('SELECT 1 AS ok');
        const ok = result.rows[0]?.ok;
        if (ok !== 1) {
            throw new Error(`Unexpected ping result: ${String(ok)}`);
        }
        process.stdout.write('Database connection OK (SELECT 1)\n');
    }
    finally {
        await client.close();
    }
}
export async function runDbBootstrap(schemaPath) {
    const resolvedSchemaPath = resolveSchemaPath(schemaPath);
    const client = new DatabaseClient();
    try {
        await waitForDatabase({ client });
        await bootstrapDatabase(resolvedSchemaPath, client);
        process.stdout.write(`Database bootstrapped from ${resolvedSchemaPath}\n`);
    }
    finally {
        await client.close();
    }
}
export async function runDbDiff(args) {
    const { schemaPath, name, print } = parseDiffArgs(args);
    const diff = generateSchemaDiff(schemaPath);
    if (diff.migrations.length === 0) {
        process.stdout.write('No schema changes detected.\n');
        return;
    }
    if (diff.hasDestructiveChanges) {
        process.stderr.write('Warning: migration includes destructive changes (drops).\n');
    }
    if (print || !name) {
        process.stdout.write(diff.sql);
        return;
    }
    const migration = createMigration(name, diff.sql);
    process.stdout.write(`Migration written to ${migration.path}\n`);
}
async function showMigrationStatus(schemaPath, client) {
    if (!snapshotExists()) {
        process.stdout.write('Snapshot: missing (.schema-state/app.schema)\n');
        process.stdout.write('\nPending schema changes (snapshot vs app.schema):\n');
        process.stdout.write('  (snapshot not initialized — run db:bootstrap first)\n');
    }
    else {
        process.stdout.write('Snapshot: present\n');
        try {
            const diff = generateSchemaDiff(schemaPath);
            const counts = summarizeMigrations(diff.migrations);
            process.stdout.write('\nPending schema changes (snapshot vs app.schema):\n');
            if (counts.size === 0) {
                process.stdout.write('  (none)\n');
            }
            else {
                for (const [kind, count] of [...counts.entries()].sort()) {
                    process.stdout.write(`  ${kind}: ${count}\n`);
                }
                if (diff.hasDestructiveChanges) {
                    process.stdout.write('  Warning: includes destructive changes\n');
                }
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            process.stdout.write(`\nPending schema changes: error — ${message}\n`);
        }
    }
    const applied = await client.withClient(async (pgClient) => getAppliedMigrationFilenames(pgClient));
    const files = listMigrationFiles();
    const pendingFiles = files.filter((migration) => !applied.has(migration.filename));
    process.stdout.write('\nMigration files:\n');
    if (files.length === 0) {
        process.stdout.write('  (none)\n');
    }
    else {
        for (const migration of files) {
            const state = applied.has(migration.filename) ? 'applied' : 'pending';
            process.stdout.write(`  [${state}] ${migration.filename}\n`);
        }
    }
    if (pendingFiles.length > 0) {
        process.stdout.write(`\n${pendingFiles.length} migration file(s) pending apply.\n`);
    }
}
export async function runDbMigrate(args) {
    const { command, schemaPath } = parseMigrateArgs(args);
    const client = new DatabaseClient();
    try {
        if (command === 'status') {
            await showMigrationStatus(schemaPath, client);
            return;
        }
        const applied = await applyPendingMigrations(schemaPath, client);
        if (applied.length === 0) {
            process.stdout.write('No pending migrations to apply.\n');
            return;
        }
        for (const migration of applied) {
            process.stdout.write(`Applied ${migration.filename}\n`);
        }
        process.stdout.write(`Snapshot updated from ${schemaPath}\n`);
    }
    finally {
        await client.close();
    }
}
