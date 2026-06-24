import type { FieldMeta, ModelMeta } from './model-meta.js';
import { toCamelCase } from './utils/naming.js';

export function mapRow<T>(row: Record<string, unknown>, model: ModelMeta): T {
  const mapped: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(row)) {
    const fieldName = model.columnToField.get(column) ?? toCamelCase(column);
    const field = model.fieldByName.get(fieldName);
    mapped[fieldName] = field ? coerceValue(value, field) : value;
  }

  return mapped as T;
}

export function mapRows<T>(rows: Record<string, unknown>[], model: ModelMeta): T[] {
  return rows.map((row) => mapRow<T>(row, model));
}

function coerceValue(value: unknown, field: FieldMeta): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  const typeName = field.type.name;

  if (typeName === 'TIMESTAMP') {
    return value instanceof Date ? value : new Date(String(value));
  }

  if (typeName === 'BOOLEAN') {
    return Boolean(value);
  }

  if (typeName === 'JSONB') {
    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }
    return value;
  }

  if (field.type.array && typeName === 'TEXT') {
    return value as string[];
  }

  if (typeName === 'DECIMAL') {
    return typeof value === 'string' ? value : String(value);
  }

  if (field.isNumeric && typeof value === 'string') {
    return Number(value);
  }

  return value;
}
