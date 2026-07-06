import { existsSync } from 'node:fs';
import path from 'node:path';
import { runDbMigrate } from './db.js';
import { DEFAULT_OUTPUT_DIR, resolveSchemaPath } from './paths.js';
import { runAppServerUntilExit } from './server.js';
import { waitForDatabase } from './wait-for-database.js';
export function parseStartArgs(args) {
    let schemaPath = resolveSchemaPath();
    let migrate = true;
    for (const arg of args) {
        if (arg === '--no-migrate') {
            migrate = false;
            continue;
        }
        if (!arg.startsWith('--')) {
            schemaPath = resolveSchemaPath(arg);
        }
    }
    return { schemaPath, migrate };
}
export async function runStart(args = []) {
    const { schemaPath, migrate } = parseStartArgs(args);
    const appPath = path.resolve(DEFAULT_OUTPUT_DIR, 'app.ts');
    if (!existsSync(appPath)) {
        throw new Error(`Missing ${appPath}. Run "schematic-pg generate" first to create the app entry point.`);
    }
    await waitForDatabase();
    if (migrate) {
        await runDbMigrate([schemaPath]);
    }
    const exitCode = await runAppServerUntilExit(appPath, { NODE_ENV: 'production' });
    if (exitCode !== 0 && exitCode !== null) {
        process.exitCode = exitCode;
    }
}
