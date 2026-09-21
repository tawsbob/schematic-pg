import type { ModelMeta } from './model-meta.js';
export type WhereInput = Record<string, unknown>;
export interface WhereClause {
    sql: string;
    params: unknown[];
}
export interface SqlWhereFragment {
    sql: string;
    params: unknown[];
}
export declare class WhereTranslator {
    private readonly model;
    private readonly scalarFields;
    private paramIndex;
    private readonly startParamIndex;
    constructor(model: ModelMeta, startParamIndex?: number);
    translate(where: WhereInput | undefined): WhereClause;
    getNextParamIndex(): number;
    private translateLogical;
    private translateNested;
    /**
     * Embeds a developer-authored SQL predicate, renumbering `$n` placeholders
     * to continue from the current parameter index and wrapping in parentheses.
     */
    private translateSqlFragment;
    private translateField;
    private translateOperator;
    private nextPlaceholder;
}
/**
 * Rewrites `$1`, `$2`, … in a fragment so they continue from `startIndex`.
 * Placeholders are remapped by original index (not left-to-right appearance)
 * so repeated `$1` references stay consistent.
 */
export declare function renumberPlaceholders(sql: string, startIndex: number): string;
