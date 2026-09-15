import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateApiFiles } from '../api-generator/index.js';
import { generateDbClientFiles } from '../db/db-client-generator.js';
import { describeSchemaSource, loadSchemaFromArg, resolveSchemaSource, } from '../schema-source/index.js';
import { SqlGenerator } from '../sql-generator/sql-generator.js';
import { DEFAULT_CUSTOM_ROUTES_DIR, DEFAULT_OUTPUT_DIR } from './paths.js';
export async function generateSql(schemaPath) {
    const { schema } = loadSchemaFromArg(schemaPath);
    return new SqlGenerator().generate(schema);
}
export async function generateClient(schemaPath) {
    const outputDir = path.resolve(DEFAULT_OUTPUT_DIR);
    const { schema } = loadSchemaFromArg(schemaPath);
    const files = generateDbClientFiles(schema);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'db-types.ts'), files.dbTypes, 'utf8');
    await writeFile(path.join(outputDir, 'db-model-meta.ts'), files.modelMeta, 'utf8');
    await writeFile(path.join(outputDir, 'db.ts'), files.dbClient, 'utf8');
    console.log(`Generated db client files in ${outputDir}`);
}
export async function generateApi(schemaPath) {
    const outputDir = path.resolve(DEFAULT_OUTPUT_DIR);
    const routesDir = path.join(outputDir, 'routes');
    const schemasDir = path.join(outputDir, 'schemas');
    const { schema } = loadSchemaFromArg(schemaPath);
    const files = generateApiFiles(schema, { customRoutesDir: DEFAULT_CUSTOM_ROUTES_DIR });
    await mkdir(routesDir, { recursive: true });
    await mkdir(schemasDir, { recursive: true });
    await writeFile(path.join(outputDir, 'app.ts'), files.app, 'utf8');
    await writeFile(path.join(outputDir, 'policies.ts'), files.policies, 'utf8');
    await writeFile(path.join(outputDir, 'hooks.ts'), files.hooks, 'utf8');
    await writeFile(path.join(schemasDir, 'validation.ts'), files.validation, 'utf8');
    await writeFile(path.join(outputDir, 'openapi.ts'), files.openapiTs, 'utf8');
    await writeFile(path.join(outputDir, 'openapi.json'), files.openapiJson, 'utf8');
    await syncGeneratedRouteFiles(routesDir, files.routes);
    console.log(`Generated API files in ${outputDir}`);
}
export async function syncGeneratedRouteFiles(routesDir, routes) {
    for (const [fileName, content] of routes) {
        await writeFile(path.join(routesDir, fileName), content, 'utf8');
    }
    const existing = await readdir(routesDir);
    await Promise.all(existing
        .filter((fileName) => fileName.endsWith('.ts') && !routes.has(fileName))
        .map((fileName) => unlink(path.join(routesDir, fileName))));
}
export async function generateAll(schemaPath) {
    const source = resolveSchemaSource(schemaPath);
    const label = describeSchemaSource(source);
    const sql = await generateSql(schemaPath);
    await writeFile(path.resolve('schema.sql'), sql, 'utf8');
    console.log(`Generated schema.sql from ${label}`);
    await generateClient(schemaPath);
    await generateApi(schemaPath);
}
