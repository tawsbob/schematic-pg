import type { Attribute, Model, Value, View } from '../../schema-dsl/ast.js';
import {
  assertKeyValueArgs,
  getOptionalKvPair,
  getPrimaryKey,
} from '../../sql-generator/utils/ast-helpers.js';

export type RestOperation = 'list' | 'get' | 'create' | 'update' | 'delete';

export const REST_OPERATIONS: RestOperation[] = ['list', 'get', 'create', 'update', 'delete'];

export const VIEW_REST_OPERATIONS: RestOperation[] = ['list', 'get'];

const HTTP_VERB_HINTS: Record<string, string> = {
  GET: 'list or get',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

export interface NormalizedRest {
  operations: Set<RestOperation>;
}

export function normalizeRest(model: Model): NormalizedRest {
  const fieldRest = model.fields.find((field) =>
    field.attributes.some((attribute) => attribute.name === 'rest'),
  );
  if (fieldRest) {
    throw new Error(
      `@rest on model ${model.name} must be a model attribute, not a field attribute on "${fieldRest.name}"`,
    );
  }

  const restAttributes = model.attributes.filter((attribute) => attribute.name === 'rest');

  if (restAttributes.length === 0) {
    return { operations: new Set(REST_OPERATIONS) };
  }

  if (restAttributes.length > 1) {
    throw new Error(`Model ${model.name} has duplicate @rest attributes`);
  }

  return normalizeRestAttribute(restAttributes[0]!, model.name, REST_OPERATIONS);
}

export function normalizeViewRest(view: View): NormalizedRest {
  const fieldRest = view.columns.find((column) =>
    column.attributes.some((attribute) => attribute.name === 'rest'),
  );
  if (fieldRest) {
    throw new Error(
      `@rest on view ${view.name} must be a view attribute, not a column attribute on "${fieldRest.name}"`,
    );
  }

  const restAttributes = view.attributes.filter((attribute) => attribute.name === 'rest');

  if (restAttributes.length === 0) {
    return { operations: new Set(VIEW_REST_OPERATIONS) };
  }

  if (restAttributes.length > 1) {
    throw new Error(`View ${view.name} has duplicate @rest attributes`);
  }

  const normalized = normalizeRestAttribute(restAttributes[0]!, view.name, VIEW_REST_OPERATIONS);

  for (const operation of normalized.operations) {
    if (operation === 'create' || operation === 'update' || operation === 'delete') {
      throw new Error(`@rest on view ${view.name} cannot include write operation "${operation}"`);
    }
  }

  if (normalized.operations.has('get') && !getPrimaryKey(view)) {
    throw new Error(`@rest get on view ${view.name} requires @id or @@id`);
  }

  return normalized;
}

export function isRestEnabled(model: Model): boolean {
  return normalizeRest(model).operations.size > 0;
}

export function isViewRestEnabled(view: View): boolean {
  return normalizeViewRest(view).operations.size > 0;
}

export function hasRestOperation(model: Model, operation: RestOperation): boolean {
  return normalizeRest(model).operations.has(operation);
}

export function hasViewRestOperation(view: View, operation: RestOperation): boolean {
  return normalizeViewRest(view).operations.has(operation);
}

function normalizeRestAttribute(
  attribute: Attribute,
  entityName: string,
  allowedOperations: RestOperation[],
): NormalizedRest {
  if (!attribute.args) {
    return { operations: new Set() };
  }

  if (attribute.args.kind === 'ExpressionArgs') {
    if (attribute.args.expressions.length === 0) {
      throw new Error(`@rest() on ${entityName} is empty; use @rest, @rest(false), only, or except`);
    }

    if (attribute.args.expressions.length !== 1) {
      throw new Error(`@rest on ${entityName} expects a single boolean or key-value args`);
    }

    const expression = attribute.args.expressions[0]!;
    if (expression.kind === 'BooleanLiteral') {
      if (expression.value === false) {
        return { operations: new Set() };
      }
      return { operations: new Set(allowedOperations) };
    }

    throw new Error(`@rest on ${entityName} expects false, only, or except`);
  }

  const args = assertKeyValueArgs(attribute.args);
  const onlyPair = getOptionalKvPair(args, 'only');
  const exceptPair = getOptionalKvPair(args, 'except');

  if (onlyPair && exceptPair) {
    throw new Error(`@rest on ${entityName} cannot mix only and except`);
  }

  if (!onlyPair && !exceptPair) {
    throw new Error(`@rest on ${entityName} requires only, except, or false`);
  }

  if (onlyPair) {
    return {
      operations: new Set(parseRestOperations(onlyPair.value, entityName, 'only', allowedOperations)),
    };
  }

  const excluded = new Set(
    parseRestOperations(exceptPair!.value, entityName, 'except', allowedOperations),
  );
  return {
    operations: new Set(allowedOperations.filter((operation) => !excluded.has(operation))),
  };
}

function parseRestOperations(
  value: Value,
  entityName: string,
  fieldName: string,
  allowedOperations: RestOperation[],
): RestOperation[] {
  if (value.kind !== 'ArrayLiteral') {
    throw new Error(`@rest ${fieldName} on ${entityName} must be an array of operations`);
  }

  return value.elements.map((element) =>
    parseRestOperation(element, entityName, allowedOperations),
  );
}

function parseRestOperation(
  value: Value,
  entityName: string,
  allowedOperations: RestOperation[],
): RestOperation {
  if (value.kind !== 'Identifier') {
    throw new Error(`@rest operation on ${entityName} must be an identifier`);
  }

  const raw = value.name;
  const httpHint = HTTP_VERB_HINTS[raw.toUpperCase()];
  if (httpHint && raw === raw.toUpperCase()) {
    throw new Error(
      `Unknown @rest operation "${raw}" on ${entityName}; use ${httpHint} instead of HTTP verb "${raw}"`,
    );
  }

  const operation = raw.toLowerCase();
  if (isRestOperation(operation)) {
    if (!allowedOperations.includes(operation)) {
      throw new Error(
        `Unknown @rest operation "${raw}" on ${entityName}; expected one of ${allowedOperations.join(', ')}`,
      );
    }
    return operation;
  }

  if (httpHint) {
    throw new Error(
      `Unknown @rest operation "${raw}" on ${entityName}; use ${httpHint} instead of HTTP verb "${raw}"`,
    );
  }

  throw new Error(
    `Unknown @rest operation "${raw}" on ${entityName}; expected one of ${allowedOperations.join(', ')}`,
  );
}

function isRestOperation(value: string): value is RestOperation {
  return REST_OPERATIONS.includes(value as RestOperation);
}
