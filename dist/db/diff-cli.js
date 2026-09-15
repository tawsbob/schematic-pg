import { createMigration } from './migrations.js';
import { generateSchemaDiff } from './diff.js';
function parseArgs(argv) {
    const args = argv.slice(2);
    let schemaPath;
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
            schemaPath = arg;
        }
    }
    return { schemaPath, name, print };
}
async function main() {
    const { schemaPath, name, print } = parseArgs(process.argv);
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
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Schema diff failed: ${message}\n`);
    process.exitCode = 1;
});
