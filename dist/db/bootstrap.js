import { SqlGenerator } from '../sql-generator/sql-generator.js';
import { loadSchemaFromArg } from '../schema-source/index.js';
import { DatabaseClient } from './client.js';
import { resetPublicSchema } from './reset-database.js';
import { writeSnapshotSource } from './schema-state.js';
export function generateBootstrapSql(schemaPath) {
    const { schema } = loadSchemaFromArg(schemaPath);
    return new SqlGenerator().generate(schema);
}
export async function bootstrapDatabase(schemaPath, client = new DatabaseClient()) {
    const { schema, canonicalSource } = loadSchemaFromArg(schemaPath);
    const sql = new SqlGenerator().generate(schema);
    await client.withClient(async (pgClient) => {
        // Bootstrap is greenfield: wipe existing objects so re-runs (e.g. `dev` watch) are idempotent.
        await resetPublicSchema(pgClient);
        await pgClient.query(sql);
    });
    writeSnapshotSource(canonicalSource);
}
