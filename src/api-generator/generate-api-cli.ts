import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '../schema-dsl/index.js';
import { generateApiFiles } from './index.js';

const DEFAULT_SCHEMA_PATH = path.resolve('app.schema');
const OUTPUT_DIR = path.resolve('generated');
const ROUTES_DIR = path.join(OUTPUT_DIR, 'routes');
const SCHEMAS_DIR = path.join(OUTPUT_DIR, 'schemas');

async function main(): Promise<void> {
  const schemaPath = process.argv[2] ?? DEFAULT_SCHEMA_PATH;
  const source = await readFile(schemaPath, 'utf8');
  const schema = parse(source);
  const files = generateApiFiles(schema);

  await mkdir(ROUTES_DIR, { recursive: true });
  await mkdir(SCHEMAS_DIR, { recursive: true });

  await writeFile(path.join(OUTPUT_DIR, 'app.ts'), files.app, 'utf8');
  await writeFile(path.join(SCHEMAS_DIR, 'validation.ts'), files.validation, 'utf8');

  for (const [fileName, content] of files.routes) {
    await writeFile(path.join(ROUTES_DIR, fileName), content, 'utf8');
  }

  console.log(`Generated API files in ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
