import type { Schema } from '../../schema-dsl/ast.js';
import { joinSection } from '../utils/format.js';

export function generateCreateExtension(name: string): string {
  if (name === 'pg_cron') {
    return `CREATE EXTENSION IF NOT EXISTS "${name}";`;
  }
  return `CREATE EXTENSION IF NOT EXISTS "${name}" WITH SCHEMA public;`;
}

export function generateDropExtension(name: string): string {
  return `DROP EXTENSION IF EXISTS "${name}";`;
}

export function generateExtensions(schema: Schema): string {
  const statements = schema.extensions.map((extension) => generateCreateExtension(extension.name));
  return joinSection('Extensions', statements);
}
