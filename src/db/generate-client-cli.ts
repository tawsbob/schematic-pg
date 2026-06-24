import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '../schema-dsl/index.js';
import { generateDbClientFiles } from './db-client-generator.js';

const DEFAULT_SCHEMA_PATH = path.resolve('app.schema');
const OUTPUT_DIR = path.resolve('generated');

async function main(): Promise<void> {
  const schemaPath = process.argv[2] ?? DEFAULT_SCHEMA_PATH;
  const source = await readFile(schemaPath, 'utf8');
  const schema = parse(source);
  const files = generateDbClientFiles(schema);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'db-types.ts'), files.dbTypes, 'utf8');
  await writeFile(path.join(OUTPUT_DIR, 'db-model-meta.ts'), files.modelMeta, 'utf8');
  await writeFile(path.join(OUTPUT_DIR, 'db.ts'), files.dbClient, 'utf8');

  console.log(`Generated db client files in ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
