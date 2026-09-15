import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSchemaFromArg } from '../schema-source/index.js';
import { generateDbClientFiles } from './db-client-generator.js';

const OUTPUT_DIR = path.resolve('generated');

async function main(): Promise<void> {
  const { schema } = loadSchemaFromArg(process.argv[2]);
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
