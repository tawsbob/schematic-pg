import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Schema } from '../schema-dsl/ast.js';
import {
  mergeFragments,
  parseFragment,
  validateMergedSchema,
  validateSchema,
  type SchemaFragment,
} from '../schema-dsl/index.js';

export const DEFAULT_SCHEMA_FILE = 'app.schema';
export const DEFAULT_SCHEMA_DIR = 'schema';

export type SchemaSource =
  | { kind: 'file'; path: string }
  | { kind: 'fragments'; dir: string; files: string[] };

export interface LoadedSchema {
  schema: Schema;
  canonicalSource: string;
  source: SchemaSource;
}

const SCHEMA_EXTENSION = '.schema';

function listSchemaFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith(SCHEMA_EXTENSION))
    .map((name) => join(dir, name))
    .sort((left, right) => left.localeCompare(right));
}

export function resolveSchemaSource(arg?: string, cwd = process.cwd()): SchemaSource {
  if (arg) {
    const resolved = resolve(cwd, arg);
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      const files = listSchemaFiles(resolved);
      if (files.length === 0) {
        throw new Error(`Schema directory "${resolved}" contains no ${SCHEMA_EXTENSION} files`);
      }
      return { kind: 'fragments', dir: resolved, files };
    }
    return { kind: 'file', path: resolved };
  }

  const fragmentsDir = resolve(cwd, DEFAULT_SCHEMA_DIR);
  const fragmentFiles = listSchemaFiles(fragmentsDir);
  if (fragmentFiles.length > 0) {
    return { kind: 'fragments', dir: fragmentsDir, files: fragmentFiles };
  }

  return { kind: 'file', path: resolve(cwd, DEFAULT_SCHEMA_FILE) };
}

export function describeSchemaSource(source: SchemaSource): string {
  return source.kind === 'file' ? source.path : source.dir;
}

export function loadSchema(source: SchemaSource): LoadedSchema {
  if (source.kind === 'file') {
    const text = readFileSync(source.path, 'utf8');
    const schema = parseFragment(text, source.path);
    validateSchema(schema);
    validateMergedSchema(schema);
    return { schema, canonicalSource: text, source };
  }

  const fragments: SchemaFragment[] = source.files.map((file) => {
    const text = readFileSync(file, 'utf8');
    return {
      file,
      source: text,
      schema: parseFragment(text, file),
    };
  });

  const { schema, canonicalSource } = mergeFragments(fragments);
  validateSchema(schema);
  validateMergedSchema(schema);
  return { schema, canonicalSource, source };
}

export function loadSchemaFromArg(arg?: string, cwd = process.cwd()): LoadedSchema {
  return loadSchema(resolveSchemaSource(arg, cwd));
}
