import { bootstrapDatabase } from './bootstrap.js';
import { DatabaseClient } from './client.js';
import { describeSchemaSource, resolveSchemaSource } from '../schema-source/index.js';
const schemaArg = process.argv[2];
const source = resolveSchemaSource(schemaArg);
const label = describeSchemaSource(source);
const client = new DatabaseClient();
bootstrapDatabase(schemaArg, client)
    .then(() => {
    process.stdout.write(`Database bootstrapped from ${label}\n`);
})
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Database bootstrap failed: ${message}\n`);
    process.exitCode = 1;
})
    .finally(async () => {
    await client.close();
});
