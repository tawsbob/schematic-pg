import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SqlGenerator } from '../sql-generator/sql-generator.js';
import { DatabaseClient } from './client.js';
import { resetPublicSchema } from './reset-database.js';
import { writeSnapshot } from './schema-state.js';
export function generateBootstrapSql(schemaPath) {
    const source = readFileSync(schemaPath, 'utf8');
    return new SqlGenerator().generateFromSource(source);
}
export async function bootstrapDatabase(schemaPath = join(process.cwd(), 'app.schema'), client = new DatabaseClient()) {
    const sql = generateBootstrapSql(schemaPath);
    await client.withClient(async (pgClient) => {
        // Bootstrap is greenfield: wipe existing objects so re-runs (e.g. `dev` watch) are idempotent.
        await resetPublicSchema(pgClient);
        await pgClient.query(sql);
    });
    writeSnapshot(schemaPath);
}
