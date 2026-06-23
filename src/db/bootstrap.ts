import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SqlGenerator } from '../sql-generator/sql-generator.js';
import { DatabaseClient } from './client.js';

export function generateBootstrapSql(schemaPath: string): string {
  const source = readFileSync(schemaPath, 'utf8');
  return new SqlGenerator().generateFromSource(source);
}

export async function bootstrapDatabase(
  schemaPath = join(process.cwd(), 'app.schema'),
  client: Pick<DatabaseClient, 'withClient'> = new DatabaseClient(),
): Promise<void> {
  const sql = generateBootstrapSql(schemaPath);

  await client.withClient(async (pgClient) => {
    await pgClient.query(sql);
  });
}
