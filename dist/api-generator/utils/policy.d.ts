import type { Model, Predicate, View } from '../../schema-dsl/ast.js';
export declare const PUBLIC_ROLE = "PUBLIC";
export type PolicyOperation = 'select' | 'insert' | 'update' | 'delete';
export declare const POLICY_OPERATIONS: PolicyOperation[];
export declare const OP_BY_METHOD: {
    readonly GET: "select";
    readonly POST: "insert";
    readonly PUT: "update";
    readonly DELETE: "delete";
};
export interface NormalizedPolicy {
    role: string;
    operations: PolicyOperation[] | 'all';
    where?: string;
}
export type PolicyTarget = Pick<Model, 'attributes'> | Pick<View, 'attributes'>;
export declare function normalizePolicies(target: PolicyTarget, predicates?: Predicate[]): NormalizedPolicy[];
export declare function hasPolicies(target: PolicyTarget): boolean;
export declare function serializePolicy(policy: NormalizedPolicy): string;
