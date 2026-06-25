import type { WhereInput } from '../../db/where-translator.js';
export type FilterFieldKind = 'string' | 'enum' | 'numeric' | 'boolean' | 'timestamp' | 'json' | 'other';
export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export interface FilterFieldMeta {
    name: string;
    kind: FilterFieldKind;
    operators: readonly FilterOperator[];
    enumValues?: readonly string[];
}
export interface ListQueryResult {
    where: WhereInput;
    orderBy?: Record<string, 'asc' | 'desc'>;
    take?: number;
    skip?: number;
}
export declare function buildListQuery(query: Record<string, unknown>, fields: readonly FilterFieldMeta[], sortableFields: readonly string[]): ListQueryResult;
