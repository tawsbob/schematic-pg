import type { AuthContext } from './types.js';
export interface BoundSqlFragment {
    sql: string;
    params: unknown[];
}
/**
 * Replaces `{{auth.*}}` placeholders with positional `$n` parameters.
 * Auth values are never concatenated into the SQL string.
 */
export declare function bindAuthTemplate(template: string, auth: AuthContext): BoundSqlFragment;
/** @deprecated Prefer bindAuthTemplate — kept only if external callers still import it. */
export declare function interpolateTemplate(template: string, auth: AuthContext): string;
