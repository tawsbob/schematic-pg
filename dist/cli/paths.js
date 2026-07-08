import path from 'node:path';
export const DEFAULT_SCHEMA_FILE = 'app.schema';
export const DEFAULT_OUTPUT_DIR = 'generated';
export const DEFAULT_CUSTOM_ROUTES_DIR = path.resolve('src/routes');
export const DEFAULT_HOOKS_DIR = path.resolve('src/hooks');
export function resolveSchemaPath(schemaArg) {
    return path.resolve(schemaArg ?? DEFAULT_SCHEMA_FILE);
}
export function resolveOutputDir() {
    return path.resolve(DEFAULT_OUTPUT_DIR);
}
