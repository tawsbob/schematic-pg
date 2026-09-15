import { DatabaseClient } from './client.js';
import { applyPendingMigrations } from './migrate.js';
import { getAppliedMigrationFilenames, listMigrationFiles } from './migrations.js';
import { generateSchemaDiff, summarizeMigrations } from './diff.js';
import { snapshotExists } from './schema-state.js';
import { describeSchemaSource, resolveSchemaSource } from '../schema-source/index.js';

function parseArgs(argv: string[]): { command: 'migrate' | 'status'; schemaPath?: string } {
  const args = argv.slice(2);
  const command = args[0] === 'status' ? 'status' : 'migrate';
  const schemaArg = args.find((arg) => !arg.startsWith('--') && arg !== 'status');

  return { command, schemaPath: schemaArg };
}

async function showStatus(schemaPath: string | undefined, client: DatabaseClient): Promise<void> {
  if (!snapshotExists()) {
    process.stdout.write('Snapshot: missing (.schema-state/app.schema)\n');
    process.stdout.write('\nPending schema changes (snapshot vs current schema):\n');
    process.stdout.write('  (snapshot not initialized — run db:bootstrap first)\n');
  } else {
    process.stdout.write('Snapshot: present\n');

    try {
      const diff = generateSchemaDiff(schemaPath);
      const counts = summarizeMigrations(diff.migrations);

      process.stdout.write('\nPending schema changes (snapshot vs current schema):\n');
      if (counts.size === 0) {
        process.stdout.write('  (none)\n');
      } else {
        for (const [kind, count] of [...counts.entries()].sort()) {
          process.stdout.write(`  ${kind}: ${count}\n`);
        }
        if (diff.hasDestructiveChanges) {
          process.stdout.write('  Warning: includes destructive changes\n');
        }
      }
    } catch (error) {
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
  } else {
    for (const migration of files) {
      const state = applied.has(migration.filename) ? 'applied' : 'pending';
      process.stdout.write(`  [${state}] ${migration.filename}\n`);
    }
  }

  if (pendingFiles.length > 0) {
    process.stdout.write(`\n${pendingFiles.length} migration file(s) pending apply.\n`);
  }
}

async function runMigrate(schemaPath: string | undefined, client: DatabaseClient): Promise<void> {
  const applied = await applyPendingMigrations(schemaPath, client);

  if (applied.length === 0) {
    process.stdout.write('No pending migrations to apply.\n');
    return;
  }

  for (const migration of applied) {
    process.stdout.write(`Applied ${migration.filename}\n`);
  }
  const label = describeSchemaSource(resolveSchemaSource(schemaPath));
  process.stdout.write(`Snapshot updated from ${label}\n`);
}

async function main(): Promise<void> {
  const { command, schemaPath } = parseArgs(process.argv);
  const client = new DatabaseClient();

  try {
    if (command === 'status') {
      await showStatus(schemaPath, client);
      return;
    }

    await runMigrate(schemaPath, client);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Migration failed: ${message}\n`);
  process.exitCode = 1;
});
