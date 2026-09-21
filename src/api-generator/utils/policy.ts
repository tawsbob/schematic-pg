import type { Attribute, Model, Predicate, Value, View } from '../../schema-dsl/ast.js';
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

export type PolicyTarget = Pick<Model, 'attributes'> | Pick<View, 'attributes'>;

export function normalizePolicies(
  target: PolicyTarget,
  predicates: Predicate[] = [],
): NormalizedPolicy[] {
  const predicateByName = new Map(predicates.map((predicate) => [predicate.name, predicate.sql]));

  return target.attributes
    .filter((attribute) => attribute.name === 'policy')
    .map((attribute) => normalizePolicyAttribute(attribute, predicateByName));
}

export function hasPolicies(target: PolicyTarget): boolean {
  return target.attributes.some((attribute) => attribute.name === 'policy');
}

function normalizePolicyAttribute(
  attribute: Attribute,
  predicateByName: Map<string, string>,
): NormalizedPolicy {
  const args = assertKeyValueArgs(attribute.args);
  const role = parseIdentifierValue(getKvPair(args, 'role').value, 'role');
  const allow = parseAllowOperations(getKvPair(args, 'allow').value);
  const wherePair = getOptionalKvPair(args, 'where');

  const policy: NormalizedPolicy = { role, operations: allow };

  if (wherePair) {
    policy.where = resolveWhereValue(wherePair.value, predicateByName);
  }

  return policy;
}

function resolveWhereValue(value: Value, predicateByName: Map<string, string>): string {
  if (value.kind === 'StringLiteral' || value.kind === 'TripleStringLiteral') {
    return value.value.trim();
  }

  if (value.kind === 'Identifier') {
    const sql = predicateByName.get(value.name);
    if (sql === undefined) {
      throw new Error(`Unknown policy predicate "${value.name}"`);
    }
    return sql;
  }

  throw new Error('Policy where must be a string or predicate identifier');
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
