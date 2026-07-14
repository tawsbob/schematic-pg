import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '../schema-dsl/index.js';
import { generateApiFiles } from '../api-generator/index.js';
import { generateDbClientFiles } from '../db/db-client-generator.js';
import { SqlGenerator } from '../sql-generator/sql-generator.js';
import {
  DEFAULT_CUSTOM_ROUTES_DIR,
  DEFAULT_OUTPUT_DIR,
  resolveSchemaPath,
} from './paths.js';

export async function generateSql(schemaPath?: string): Promise<string> {
  const resolvedSchemaPath = resolveSchemaPath(schemaPath);
  const source = await readFile(resolvedSchemaPath, 'utf8');
  return new SqlGenerator().generateFromSource(source);
}

export async function generateClient(schemaPath?: string): Promise<void> {
  const resolvedSchemaPath = resolveSchemaPath(schemaPath);
  const outputDir = path.resolve(DEFAULT_OUTPUT_DIR);
  const source = await readFile(resolvedSchemaPath, 'utf8');
  const schema = parse(source);
  const files = generateDbClientFiles(schema);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'db-types.ts'), files.dbTypes, 'utf8');
  await writeFile(path.join(outputDir, 'db-model-meta.ts'), files.modelMeta, 'utf8');
  await writeFile(path.join(outputDir, 'db.ts'), files.dbClient, 'utf8');

  console.log(`Generated db client files in ${outputDir}`);
}

export async function generateApi(schemaPath?: string): Promise<void> {
  const resolvedSchemaPath = resolveSchemaPath(schemaPath);
  const outputDir = path.resolve(DEFAULT_OUTPUT_DIR);
  const routesDir = path.join(outputDir, 'routes');
  const schemasDir = path.join(outputDir, 'schemas');
  const source = await readFile(resolvedSchemaPath, 'utf8');
  const schema = parse(source);
  const files = generateApiFiles(schema, { customRoutesDir: DEFAULT_CUSTOM_ROUTES_DIR });

  await mkdir(routesDir, { recursive: true });
  await mkdir(schemasDir, { recursive: true });

  await writeFile(path.join(outputDir, 'app.ts'), files.app, 'utf8');
  await writeFile(path.join(outputDir, 'policies.ts'), files.policies, 'utf8');
  await writeFile(path.join(outputDir, 'hooks.ts'), files.hooks, 'utf8');
  await writeFile(path.join(schemasDir, 'validation.ts'), files.validation, 'utf8');
  await writeFile(path.join(outputDir, 'openapi.ts'), files.openapiTs, 'utf8');
  await writeFile(path.join(outputDir, 'openapi.json'), files.openapiJson, 'utf8');

  for (const [fileName, content] of files.routes) {
    await writeFile(path.join(routesDir, fileName), content, 'utf8');
  }

  console.log(`Generated API files in ${outputDir}`);
}

export async function generateAll(schemaPath?: string): Promise<void> {
  const resolvedSchemaPath = resolveSchemaPath(schemaPath);
  const sql = await generateSql(resolvedSchemaPath);
  await writeFile(path.resolve('schema.sql'), sql, 'utf8');
  console.log('Generated schema.sql');

  await generateClient(resolvedSchemaPath);
  await generateApi(resolvedSchemaPath);
}
