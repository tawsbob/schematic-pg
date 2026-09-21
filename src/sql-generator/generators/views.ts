import type { Schema, View } from '../../schema-dsl/ast.js';
import {
  getDirectives,
  getModelNames,
  normalizeIndexDirective,
} from '../utils/ast-helpers.js';
import { joinSection } from '../utils/format.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';
import { generateCreateIndexOnRelation } from './indexes.js';

export function generateViews(schema: Schema): string {
  if (schema.views.length === 0) {
    return '';
  }

  const modelNames = getModelNames(schema);
  const statements: string[] = [];

  for (const view of schema.views) {
    statements.push(generateCreateView(view));
    if (view.materialized) {
      for (const directive of getDirectives(view, 'index')) {
        const normalized = normalizeIndexDirective(directive, view, modelNames);
        statements.push(generateCreateIndexOnRelation(view.name, normalized));
      }
    }
  }

  return joinSection('Create views', statements);
}

export function generateCreateView(view: View): string {
  const relationName = quoteIdentifier(toTableName(view.name));
  const columnList = view.columns
    .map((column) => quoteIdentifier(toSnakeCase(column.name)))
    .join(', ');
  const query = indentQuery(view.query.trim());

  if (view.materialized) {
    return [
      `CREATE MATERIALIZED VIEW ${relationName} (${columnList}) AS`,
      query,
      'WITH DATA;',
    ].join('\n');
  }

  return `CREATE OR REPLACE VIEW ${relationName} (${columnList}) AS\n${query};`;
}

export function generateDropView(viewName: string, materialized: boolean): string {
  const relationName = quoteIdentifier(toTableName(viewName));
  if (materialized) {
    return `DROP MATERIALIZED VIEW IF EXISTS ${relationName};`;
  }
  return `DROP VIEW IF EXISTS ${relationName};`;
}

function indentQuery(query: string): string {
  return query
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');
}
