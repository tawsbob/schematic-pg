import type { Field, Schema, TypeExpr } from '../../schema-dsl/ast.js';

export type FilterFieldKind = 'string' | 'enum' | 'numeric' | 'boolean' | 'timestamp' | 'json' | 'other';

export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in';

export interface FilterFieldMeta {
  name: string;
  kind: FilterFieldKind;
  operators: FilterOperator[];
  enumValues?: string[];
}

const STRING_TYPES = new Set(['UUID', 'VARCHAR', 'TEXT']);
const NUMERIC_TYPES = new Set(['INTEGER', 'SERIAL', 'SMALLINT', 'DECIMAL']);

export function getFilterFieldKind(field: Field, schema: Schema): FilterFieldKind {
  const typeName = field.type.name;

  if (schema.enums.some((enumDef) => enumDef.name === typeName)) {
    return 'enum';
  }

  if (STRING_TYPES.has(typeName)) {
    return 'string';
  }

  if (NUMERIC_TYPES.has(typeName)) {
    return 'numeric';
  }

  if (typeName === 'BOOLEAN') {
    return 'boolean';
  }

  if (typeName === 'TIMESTAMP') {
    return 'timestamp';
  }

  if (typeName === 'JSONB' || typeName === 'POINT' || (field.type.array && typeName === 'TEXT')) {
    return 'json';
  }

  return 'other';
}

export function getFilterOperators(kind: FilterFieldKind): FilterOperator[] {
  switch (kind) {
    case 'string':
      return ['equals', 'contains', 'startsWith', 'endsWith'];
    case 'enum':
      return ['equals', 'in'];
    case 'numeric':
      return ['equals', 'gt', 'gte', 'lt', 'lte'];
    case 'boolean':
    case 'timestamp':
    case 'json':
    case 'other':
      return ['equals'];
  }
}

export function buildFilterFieldMeta(field: Field, schema: Schema): FilterFieldMeta {
  const kind = getFilterFieldKind(field, schema);
  const operators = getFilterOperators(kind);
  const enumDef = schema.enums.find((entry) => entry.name === field.type.name);

  return {
    name: field.name,
    kind,
    operators,
    ...(enumDef ? { enumValues: enumDef.values } : {}),
  };
}

export function queryParamKey(fieldName: string, operator: FilterOperator): string {
  if (operator === 'equals') {
    return fieldName;
  }

  return `${fieldName}_${operator}`;
}

export function toQueryBooleanZodType(): string {
  return `z.preprocess(
    (value) => (typeof value === 'string' ? value.toLowerCase() : value),
    z.union([z.boolean(), z.enum(['true', 'false'])]).transform((value) => value === true || value === 'true'),
  )`;
}

export function toFilterZodType(
  type: TypeExpr,
  field: Field,
  schema: Schema,
  operator: FilterOperator,
  coerce = false,
): string {
  const prefix = coerce ? 'z.coerce.' : 'z.';
  const enumType = schema.enums.find((enumDef) => enumDef.name === type.name);
  if (enumType) {
    if (operator === 'in') {
      return `${prefix}string()`;
    }

    const values = enumType.values.map((value) => `'${value}'`).join(', ');
    return `z.enum([${values}])`;
  }

  if (type.array && type.name === 'TEXT') {
    return `${prefix}string()`;
  }

  switch (type.name) {
    case 'UUID':
    case 'VARCHAR':
    case 'TEXT':
      return `${prefix}string()`;
    case 'INTEGER':
    case 'SERIAL':
    case 'SMALLINT':
      return `${prefix}number().int()`;
    case 'BOOLEAN':
      return toQueryBooleanZodType();
    case 'TIMESTAMP':
      return 'z.coerce.date()';
    case 'DECIMAL':
      return `${prefix}string()`;
    case 'JSONB':
      return 'z.string()';
    case 'POINT':
      return 'z.string()';
    default:
      return 'z.string()';
  }
}
