import {
  resolveUniqueConstraintName,
  type NormalizedUnique,
} from '../utils/ast-helpers.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';

export function formatTableUniqueConstraint(
  modelName: string,
  normalized: NormalizedUnique,
): string {
  const constraintName = resolveUniqueConstraintName(modelName, normalized);
  const columns = normalized.fields.map(toSnakeCase).join(', ');
  return `CONSTRAINT ${constraintName} UNIQUE (${columns})`;
}

export function generateAddUniqueConstraint(
  modelName: string,
  normalized: NormalizedUnique,
): string {
  const tableName = quoteIdentifier(toTableName(modelName));
  const constraintName = resolveUniqueConstraintName(modelName, normalized);
  const columns = normalized.fields.map(toSnakeCase).join(', ');
  return `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} UNIQUE (${columns});`;
}

export function generateDropUniqueConstraint(
  modelName: string,
  normalized: NormalizedUnique,
): string {
  const tableName = quoteIdentifier(toTableName(modelName));
  const constraintName = resolveUniqueConstraintName(modelName, normalized);
  return `ALTER TABLE ${tableName} DROP CONSTRAINT ${constraintName};`;
}
