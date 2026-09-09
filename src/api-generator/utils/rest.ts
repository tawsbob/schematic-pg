import type { Attribute, Model, Value } from '../../schema-dsl/ast.js';
import { assertKeyValueArgs, getOptionalKvPair } from '../../sql-generator/utils/ast-helpers.js';

export type RestOperation = 'list' | 'get' | 'create' | 'update' | 'delete';

export const REST_OPERATIONS: RestOperation[] = ['list', 'get', 'create', 'update', 'delete'];

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

  return normalizeRestAttribute(restAttributes[0]!, model.name);
}

export function isRestEnabled(model: Model): boolean {
  return normalizeRest(model).operations.size > 0;
}

export function hasRestOperation(model: Model, operation: RestOperation): boolean {
  return normalizeRest(model).operations.has(operation);
}

function normalizeRestAttribute(attribute: Attribute, modelName: string): NormalizedRest {
  if (!attribute.args) {
    return { operations: new Set() };
  }

  if (attribute.args.kind === 'ExpressionArgs') {
    if (attribute.args.expressions.length === 0) {
      throw new Error(`@rest() on model ${modelName} is empty; use @rest, @rest(false), only, or except`);
    }

    if (attribute.args.expressions.length !== 1) {
      throw new Error(`@rest on model ${modelName} expects a single boolean or key-value args`);
    }

    const expression = attribute.args.expressions[0]!;
    if (expression.kind === 'BooleanLiteral') {
      if (expression.value === false) {
        return { operations: new Set() };
      }
      return { operations: new Set(REST_OPERATIONS) };
    }

    throw new Error(`@rest on model ${modelName} expects false, only, or except`);
  }

  const args = assertKeyValueArgs(attribute.args);
  const onlyPair = getOptionalKvPair(args, 'only');
  const exceptPair = getOptionalKvPair(args, 'except');

  if (onlyPair && exceptPair) {
    throw new Error(`@rest on model ${modelName} cannot mix only and except`);
  }

  if (!onlyPair && !exceptPair) {
    throw new Error(`@rest on model ${modelName} requires only, except, or false`);
  }

  if (onlyPair) {
    return { operations: new Set(parseRestOperations(onlyPair.value, modelName, 'only')) };
  }

  const excluded = new Set(parseRestOperations(exceptPair!.value, modelName, 'except'));
  return {
    operations: new Set(REST_OPERATIONS.filter((operation) => !excluded.has(operation))),
  };
}

function parseRestOperations(value: Value, modelName: string, fieldName: string): RestOperation[] {
  if (value.kind !== 'ArrayLiteral') {
    throw new Error(`@rest ${fieldName} on model ${modelName} must be an array of operations`);
  }

  return value.elements.map((element) => parseRestOperation(element, modelName));
}

function parseRestOperation(value: Value, modelName: string): RestOperation {
  if (value.kind !== 'Identifier') {
    throw new Error(`@rest operation on model ${modelName} must be an identifier`);
  }

  const raw = value.name;
  const httpHint = HTTP_VERB_HINTS[raw.toUpperCase()];
  if (httpHint && raw === raw.toUpperCase()) {
    throw new Error(
      `Unknown @rest operation "${raw}" on model ${modelName}; use ${httpHint} instead of HTTP verb "${raw}"`,
    );
  }

  const operation = raw.toLowerCase();
  if (isRestOperation(operation)) {
    return operation;
  }

  if (httpHint) {
    throw new Error(
      `Unknown @rest operation "${raw}" on model ${modelName}; use ${httpHint} instead of HTTP verb "${raw}"`,
    );
  }

  throw new Error(
    `Unknown @rest operation "${raw}" on model ${modelName}; expected one of ${REST_OPERATIONS.join(', ')}`,
  );
}

function isRestOperation(value: string): value is RestOperation {
  return REST_OPERATIONS.includes(value as RestOperation);
}
