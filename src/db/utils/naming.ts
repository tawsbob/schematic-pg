export { quoteIdentifier, toSnakeCase } from '../../sql-generator/utils/snake-case.js';
import { toSnakeCase } from '../../sql-generator/utils/snake-case.js';

export function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function pluralize(value: string): string {
  if (/[^aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/i.test(value)) {
    return `${value}es`;
  }

  return `${value}s`;
}

export function toTableName(modelName: string): string {
  return toSnakeCase(modelName);
}

export function toColumnName(fieldName: string): string {
  return toSnakeCase(fieldName);
}

export function toClientKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}
