import type { Attribute, Model, Value } from '../../schema-dsl/ast.js';
import { assertKeyValueArgs, getKvPair, getOptionalKvPair } from '../../sql-generator/utils/ast-helpers.js';

export const PUBLIC_ROLE = 'PUBLIC';

export type PolicyOperation = 'select' | 'insert' | 'update' | 'delete';

export const POLICY_OPERATIONS: PolicyOperation[] = ['select', 'insert', 'update', 'delete'];

export const OP_BY_METHOD = {
  GET: 'select',
  POST: 'insert',
  PUT: 'update',
  DELETE: 'delete',
} as const satisfies Record<string, PolicyOperation>;

export interface NormalizedPolicy {
  role: string;
  operations: PolicyOperation[] | 'all';
  where?: string;
}

export function normalizePolicies(model: Model): NormalizedPolicy[] {
  return model.attributes
    .filter((attribute) => attribute.name === 'policy')
    .map((attribute) => normalizePolicyAttribute(attribute));
}

export function hasPolicies(model: Model): boolean {
  return model.attributes.some((attribute) => attribute.name === 'policy');
}

function normalizePolicyAttribute(attribute: Attribute): NormalizedPolicy {
  const args = assertKeyValueArgs(attribute.args);
  const role = parseIdentifierValue(getKvPair(args, 'role').value, 'role');
  const allow = parseAllowOperations(getKvPair(args, 'allow').value);
  const wherePair = getOptionalKvPair(args, 'where');

  const policy: NormalizedPolicy = { role, operations: allow };

  if (wherePair) {
    policy.where = parseStringValue(wherePair.value, 'where');
  }

  return policy;
}

function parseAllowOperations(value: Value): PolicyOperation[] | 'all' {
  if (value.kind === 'Identifier') {
    if (value.name === 'all') {
      return 'all';
    }
    throw new Error(`Unknown policy allow value "${value.name}"`);
  }

  if (value.kind === 'ArrayLiteral') {
    return value.elements.map((element) => parsePolicyOperation(element));
  }

  throw new Error('Policy allow must be "all" or an array of operations');
}

function parsePolicyOperation(value: Value): PolicyOperation {
  if (value.kind !== 'Identifier') {
    throw new Error('Policy operation must be an identifier');
  }

  const operation = value.name.toLowerCase();

  if (!isPolicyOperation(operation)) {
    throw new Error(`Unknown policy operation "${value.name}"`);
  }

  return operation;
}

function parseIdentifierValue(value: Value, fieldName: string): string {
  if (value.kind !== 'Identifier') {
    throw new Error(`Policy ${fieldName} must be an identifier`);
  }

  return value.name;
}

function parseStringValue(value: Value, fieldName: string): string {
  if (value.kind === 'StringLiteral' || value.kind === 'TripleStringLiteral') {
    return value.value.trim();
  }

  throw new Error(`Policy ${fieldName} must be a string`);
}

function isPolicyOperation(value: string): value is PolicyOperation {
  return POLICY_OPERATIONS.includes(value as PolicyOperation);
}

export function serializePolicy(policy: NormalizedPolicy): string {
  const operations =
    policy.operations === 'all'
      ? "'all'"
      : `[${policy.operations.map((operation) => `'${operation}'`).join(', ')}]`;

  const where = policy.where ? `, where: ${JSON.stringify(policy.where)}` : '';

  return `{ role: '${policy.role}', operations: ${operations}${where} }`;
}
