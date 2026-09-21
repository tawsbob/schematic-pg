import { ForbiddenError } from './errors.js';
import { bindAuthTemplate } from './template.js';
import { PUBLIC_ROLE } from './types.js';
export { ForbiddenError, UnauthorizedError } from './errors.js';
/** Marker key for a parameterized SQL predicate inside WhereInput. */
export const SQL_WHERE_KEY = '$sql';
let policies = {};
export function configurePolicies(next) {
    policies = next;
}
export function assertPolicy(model, role, operation) {
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
export function resolvePolicyWhere(policy, auth) {
    if (!policy.where) {
        return undefined;
    }
    const bound = bindAuthTemplate(policy.where, auth);
    return {
        [SQL_WHERE_KEY]: {
            sql: bound.sql,
            params: bound.params,
        },
    };
}
export function mergeWhere(primary, policyWhere) {
    if (!policyWhere || Object.keys(policyWhere).length === 0) {
        return primary;
    }
    if (!primary || Object.keys(primary).length === 0) {
        return policyWhere;
    }
    return { AND: [primary, policyWhere] };
}
function findPolicyForRole(modelPolicies, role) {
    const directMatch = modelPolicies.find((policy) => policy.role === role);
    if (directMatch) {
        return directMatch;
    }
    if (role !== PUBLIC_ROLE) {
        return modelPolicies.find((policy) => policy.role === PUBLIC_ROLE);
    }
    return undefined;
}
function isOperationAllowed(policy, operation) {
    if (policy.operations === 'all') {
        return true;
    }
    return policy.operations.includes(operation);
}
