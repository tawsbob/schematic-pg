import type { FieldMeta, ModelMeta } from './model-meta.js';

export type WhereInput = Record<string, unknown>;

export interface WhereClause {
  sql: string;
  params: unknown[];
}

export class WhereTranslator {
  private readonly scalarFields: Set<string>;
  private paramIndex: number;
  private readonly startParamIndex: number;

  constructor(private readonly model: ModelMeta, startParamIndex = 1) {
    this.scalarFields = new Set(model.fields.map((field) => field.name));
    this.startParamIndex = startParamIndex;
    this.paramIndex = startParamIndex;
  }

  translate(where: WhereInput | undefined): WhereClause {
    this.paramIndex = this.startParamIndex;

    if (!where || Object.keys(where).length === 0) {
      return { sql: '', params: [] };
    }

    const params: unknown[] = [];
    const clauses: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (key === 'AND') {
        clauses.push(this.translateLogical(value, 'AND', params));
        continue;
      }

      if (key === 'OR') {
        clauses.push(this.translateLogical(value, 'OR', params));
        continue;
      }

      if (key === 'NOT') {
        const nested = this.translateNested(value as WhereInput, params);
        clauses.push(`NOT (${nested})`);
        continue;
      }

      if (!this.scalarFields.has(key)) {
        throw new Error(`Unknown where field "${key}" on model ${this.model.name}`);
      }

      clauses.push(this.translateField(key, value, params));
    }

    return {
      sql: clauses.join(' AND '),
      params,
    };
  }

  getNextParamIndex(): number {
    return this.paramIndex;
  }

  private translateLogical(value: unknown, operator: 'AND' | 'OR', params: unknown[]): string {
    if (!Array.isArray(value)) {
      throw new Error(`${operator} expects an array of where clauses`);
    }

    const parts = value.map((entry) => this.translateNested(entry as WhereInput, params));
    return `(${parts.join(` ${operator} `)})`;
  }

  private translateNested(where: WhereInput, params: unknown[]): string {
    const nestedClauses: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (key === 'AND') {
        nestedClauses.push(this.translateLogical(value, 'AND', params));
        continue;
      }

      if (key === 'OR') {
        nestedClauses.push(this.translateLogical(value, 'OR', params));
        continue;
      }

      if (key === 'NOT') {
        const nested = this.translateNested(value as WhereInput, params);
        nestedClauses.push(`NOT (${nested})`);
        continue;
      }

      nestedClauses.push(this.translateField(key, value, params));
    }

    return nestedClauses.join(' AND ');
  }

  private translateField(fieldName: string, value: unknown, params: unknown[]): string {
    const field = this.model.fieldByName.get(fieldName);
    if (!field) {
      throw new Error(`Unknown field "${fieldName}"`);
    }

    const column = field.columnName;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return this.translateOperator(field, column, value as Record<string, unknown>, params);
    }

    params.push(value);
    return `${column} = ${this.nextPlaceholder()}`;
  }

  private translateOperator(
    field: FieldMeta,
    column: string,
    operators: Record<string, unknown>,
    params: unknown[],
  ): string {
    const entries = Object.entries(operators);

    if (entries.length !== 1) {
      throw new Error(`Field "${field.name}" expects a single filter operator`);
    }

    const [operator, rawValue] = entries[0]!;

    if (operator === 'equals') {
      params.push(rawValue);
      return `${column} = ${this.nextPlaceholder()}`;
    }

    if (operator === 'in') {
      if (!Array.isArray(rawValue) || rawValue.length === 0) {
        throw new Error(`Field "${field.name}" "in" expects a non-empty array`);
      }

      const placeholders = rawValue.map((item) => {
        params.push(item);
        return this.nextPlaceholder();
      });

      return `${column} IN (${placeholders.join(', ')})`;
    }

    if (operator === 'contains' || operator === 'startsWith' || operator === 'endsWith') {
      if (!field.isString) {
        throw new Error(`Operator "${operator}" is only supported on string fields`);
      }

      params.push(wrapLikePattern(String(rawValue), operator));
      return `${column} LIKE ${this.nextPlaceholder()}`;
    }

    if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
      if (!field.isNumeric && !field.isEnum) {
        throw new Error(`Operator "${operator}" is only supported on numeric or enum fields`);
      }

      const sqlOperator = {
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
      }[operator];

      params.push(rawValue);
      return `${column} ${sqlOperator} ${this.nextPlaceholder()}`;
    }

    throw new Error(`Unsupported operator "${operator}" for field "${field.name}"`);
  }

  private nextPlaceholder(): string {
    const placeholder = `$${this.paramIndex}`;
    this.paramIndex += 1;
    return placeholder;
  }
}

function wrapLikePattern(value: string, operator: 'contains' | 'startsWith' | 'endsWith'): string {
  if (operator === 'contains') {
    return `%${value}%`;
  }

  if (operator === 'startsWith') {
    return `${value}%`;
  }

  return `%${value}`;
}
