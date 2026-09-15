import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSchemaFromArg } from '../schema-source/index.js';
import { generateApiFiles } from './index.js';

const DEFAULT_CUSTOM_ROUTES_DIR = path.resolve('src/routes');
const OUTPUT_DIR = path.resolve('generated');
const ROUTES_DIR = path.join(OUTPUT_DIR, 'routes');
const SCHEMAS_DIR = path.join(OUTPUT_DIR, 'schemas');

async function main(): Promise<void> {
  const { schema } = loadSchemaFromArg(process.argv[2]);
  const files = generateApiFiles(schema, { customRoutesDir: DEFAULT_CUSTOM_ROUTES_DIR });

  await mkdir(ROUTES_DIR, { recursive: true });
  await mkdir(SCHEMAS_DIR, { recursive: true });

  await writeFile(path.join(OUTPUT_DIR, 'app.ts'), files.app, 'utf8');
  await writeFile(path.join(OUTPUT_DIR, 'policies.ts'), files.policies, 'utf8');
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
