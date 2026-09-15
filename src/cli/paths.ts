import path from 'node:path';
import {
  DEFAULT_SCHEMA_DIR,
  DEFAULT_SCHEMA_FILE,
} from '../schema-source/index.js';

export { DEFAULT_SCHEMA_DIR, DEFAULT_SCHEMA_FILE };

export const DEFAULT_OUTPUT_DIR = 'generated';
export const DEFAULT_CUSTOM_ROUTES_DIR = path.resolve('src/routes');
export const DEFAULT_HOOKS_DIR = path.resolve('src/hooks');

export function resolveSchemaPath(schemaArg?: string): string {
  return path.resolve(schemaArg ?? DEFAULT_SCHEMA_FILE);
}

export function resolveOutputDir(): string {
  return path.resolve(DEFAULT_OUTPUT_DIR);
}
