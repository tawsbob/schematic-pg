import type { WhereInput } from '../../db/where-translator.js';

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
  operators: readonly FilterOperator[];
  enumValues?: readonly string[];
}

export interface ListQueryResult {
  where: WhereInput;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
}

function queryParamKey(fieldName: string, operator: FilterOperator): string {
  if (operator === 'equals') {
    return fieldName;
  }

  return `${fieldName}_${operator}`;
}

function parseFilterValue(
  rawValue: unknown,
  kind: FilterFieldKind,
  operator: FilterOperator,
): unknown {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  if (operator === 'in') {
    const values = String(rawValue)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return values.length > 0 ? values : undefined;
  }

  if (kind === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    const normalized = String(rawValue).toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    return rawValue;
  }

  if (kind === 'numeric') {
    if (typeof rawValue === 'number') {
      return rawValue;
    }
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? rawValue : parsed;
  }

  if (kind === 'timestamp' && !(rawValue instanceof Date)) {
    const parsed = new Date(String(rawValue));
    return Number.isNaN(parsed.getTime()) ? rawValue : parsed;
  }

  return rawValue;
}

function buildFieldCondition(
  field: FilterFieldMeta,
  operator: FilterOperator,
  rawValue: unknown,
): Record<string, unknown> | undefined {
  const value = parseFilterValue(rawValue, field.kind, operator);
  if (value === undefined) {
    return undefined;
  }

  if (operator === 'equals') {
    return { [field.name]: value };
  }

  return { [field.name]: { [operator]: value } };
}

export function buildListQuery(
  query: Record<string, unknown>,
  fields: readonly FilterFieldMeta[],
  sortableFields: readonly string[],
): ListQueryResult {
  const whereParts: WhereInput[] = [];

  for (const field of fields) {
    let equalitySet = false;

    for (const operator of field.operators) {
      const key = queryParamKey(field.name, operator);
      if (!(key in query)) {
        continue;
      }

      const condition = buildFieldCondition(field, operator, query[key]);
      if (!condition) {
        continue;
      }

      if (operator === 'equals') {
        equalitySet = true;
      } else if (equalitySet) {
        continue;
      }

      whereParts.push(condition);
    }
  }

  let where: WhereInput = {};
  if (whereParts.length === 1) {
    where = whereParts[0]!;
  } else if (whereParts.length > 1) {
    where = { AND: whereParts };
  }

  const result: ListQueryResult = { where };

  if (query.limit !== undefined && query.limit !== '') {
    result.take = Number(query.limit);
  }

  if (query.offset !== undefined && query.offset !== '') {
    result.skip = Number(query.offset);
  }

  if (typeof query.sort === 'string' && query.sort.length > 0) {
    const descending = query.sort.startsWith('-');
    const fieldName = descending ? query.sort.slice(1) : query.sort;

    if (!sortableFields.includes(fieldName)) {
      throw new Error(`Invalid sort field "${fieldName}"`);
    }

    result.orderBy = { [fieldName]: descending ? 'desc' : 'asc' };
  }

  return result;
}
