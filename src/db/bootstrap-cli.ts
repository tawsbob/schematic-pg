import { join } from 'node:path';
import { bootstrapDatabase } from './bootstrap.js';
import { DatabaseClient } from './client.js';

const schemaPath = process.argv[2] ?? join(process.cwd(), 'app.schema');
const client = new DatabaseClient();

bootstrapDatabase(schemaPath, client)
  .then(() => {
    process.stdout.write(`Database bootstrapped from ${schemaPath}\n`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Database bootstrap failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
