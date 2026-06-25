import type { WhereInput } from '../../db/where-translator.js';
import { ForbiddenError } from './errors.js';
import type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
import { interpolateTemplate } from './template.js';
import type { AuthContext } from './types.js';
import { PUBLIC_ROLE } from './types.js';

export type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
export { ForbiddenError, UnauthorizedError } from './errors.js';

const SIMPLE_WHERE_PATTERN = /^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/;

let policies: Record<string, NormalizedPolicy[]> = {};

export function configurePolicies(next: Record<string, NormalizedPolicy[]>): void {
  policies = next;
}

export function assertPolicy(model: string, role: string, operation: PolicyOperation): NormalizedPolicy {
  const modelPolicies = policies[model];

  if (!modelPolicies || modelPolicies.length === 0) {
    throw new ForbiddenError(`No policies configured for model "${model}"`);
  }

  const policy = findPolicyForRole(modelPolicies, role);

  if (!policy) {
    throw new ForbiddenError(`Role "${role}" is not allowed to ${operation} ${model}`);
  }

  if (!isOperationAllowed(policy, operation)) {
    throw new ForbiddenError(`Role "${role}" is not allowed to ${operation} ${model}`);
  }

  return policy;
}

export function resolvePolicyWhere(policy: NormalizedPolicy, auth: AuthContext): WhereInput | undefined {
  if (!policy.where) {
    return undefined;
  }

  const interpolated = interpolateTemplate(policy.where, auth);
  return parseSimpleWhereClause(interpolated);
}

export function mergeWhere(
  primary: Record<string, unknown>,
  policyWhere?: WhereInput,
): Record<string, unknown> {
  if (!policyWhere || Object.keys(policyWhere).length === 0) {
    return primary;
  }

  if (!primary || Object.keys(primary).length === 0) {
    return policyWhere;
  }

  return { AND: [primary, policyWhere] };
}

function findPolicyForRole(modelPolicies: NormalizedPolicy[], role: string): NormalizedPolicy | undefined {
  const directMatch = modelPolicies.find((policy) => policy.role === role);

  if (directMatch) {
    return directMatch;
  }

  if (role !== PUBLIC_ROLE) {
    return modelPolicies.find((policy) => policy.role === PUBLIC_ROLE);
  }

  return undefined;
}

function isOperationAllowed(policy: NormalizedPolicy, operation: PolicyOperation): boolean {
  if (policy.operations === 'all') {
    return true;
  }

  return policy.operations.includes(operation);
}

function parseSimpleWhereClause(clause: string): WhereInput {
  const trimmedClause = clause.trim();
  const match = trimmedClause.match(SIMPLE_WHERE_PATTERN);

  if (!match) {
    throw new ForbiddenError(
      `Unsupported policy where clause "${clause}". Only simple "field op value" forms are supported.`,
    );
  }

  const [, field, operator, rawValue] = match;
  const value = parseWhereValue(rawValue!.trim());

  if (operator === '=') {
    return { [field!]: value };
  }

  if (operator === '!=' || operator === '<>') {
    return { NOT: { [field!]: value } };
  }

  const operatorMap = {
    '>': 'gt',
    '>=': 'gte',
    '<': 'lt',
    '<=': 'lte',
  } as const;

  const mappedOperator = operatorMap[operator as keyof typeof operatorMap];

  if (!mappedOperator) {
    throw new ForbiddenError(`Unsupported policy where operator "${operator}"`);
  }

  return { [field!]: { [mappedOperator]: value } };
}

function parseWhereValue(rawValue: string): string | number | boolean {
  if (
    (rawValue.startsWith("'") && rawValue.endsWith("'")) ||
    (rawValue.startsWith('"') && rawValue.endsWith('"'))
  ) {
    return rawValue.slice(1, -1);
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  const numericValue = Number(rawValue);

  if (!Number.isNaN(numericValue) && rawValue !== '') {
    return numericValue;
  }

  return rawValue;
}
