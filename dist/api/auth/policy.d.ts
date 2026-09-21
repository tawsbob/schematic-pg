import type { WhereInput } from '../../db/where-translator.js';
import type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
import type { AuthContext } from './types.js';
export type { NormalizedPolicy, PolicyOperation } from './policy-types.js';
export { ForbiddenError, UnauthorizedError } from './errors.js';
/** Marker key for a parameterized SQL predicate inside WhereInput. */
export declare const SQL_WHERE_KEY: "$sql";
export interface SqlWhereFragment {
    sql: string;
    params: unknown[];
}
export declare function configurePolicies(next: Record<string, NormalizedPolicy[]>): void;
export declare function assertPolicy(model: string, role: string, operation: PolicyOperation): NormalizedPolicy;
/**
 * Compiles a policy `where` string into a parameterized SQL fragment.
 * Auth placeholders become `$n` bound values — never string interpolation.
 */
export declare function resolvePolicyWhere(policy: NormalizedPolicy, auth: AuthContext): WhereInput | undefined;
export declare function mergeWhere(primary: Record<string, unknown>, policyWhere?: WhereInput): Record<string, unknown>;
