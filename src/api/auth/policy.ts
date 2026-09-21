import type { WhereInput } from '../../db/where-translator.js';
import { ForbiddenError } from './errors.js';
import type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
import { bindAuthTemplate } from './template.js';
import type { AuthContext } from './types.js';
import { PUBLIC_ROLE } from './types.js';

export type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
export { ForbiddenError, UnauthorizedError } from './errors.js';

/** Marker key for a parameterized SQL predicate inside WhereInput. */
export const SQL_WHERE_KEY = '$sql' as const;

export interface SqlWhereFragment {
  sql: string;
  params: unknown[];
}

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

/**
 * Compiles a policy `where` string into a parameterized SQL fragment.
 * Auth placeholders become `$n` bound values — never string interpolation.
 */
export function resolvePolicyWhere(policy: NormalizedPolicy, auth: AuthContext): WhereInput | undefined {
  if (!policy.where) {
    return undefined;
  }

  const bound = bindAuthTemplate(policy.where, auth);
  return {
    [SQL_WHERE_KEY]: {
      sql: bound.sql,
      params: bound.params,
    } satisfies SqlWhereFragment,
  };
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
