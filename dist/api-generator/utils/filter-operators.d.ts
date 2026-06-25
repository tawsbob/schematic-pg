import type { Field, Schema, TypeExpr } from '../../schema-dsl/ast.js';
export type FilterFieldKind = 'string' | 'enum' | 'numeric' | 'boolean' | 'timestamp' | 'json' | 'other';
export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export interface FilterFieldMeta {
    name: string;
    kind: FilterFieldKind;
    operators: FilterOperator[];
    enumValues?: string[];
}
export declare function getFilterFieldKind(field: Field, schema: Schema): FilterFieldKind;
export declare function getFilterOperators(kind: FilterFieldKind): FilterOperator[];
export declare function buildFilterFieldMeta(field: Field, schema: Schema): FilterFieldMeta;
export declare function queryParamKey(fieldName: string, operator: FilterOperator): string;
export declare function toFilterZodType(type: TypeExpr, field: Field, schema: Schema, operator: FilterOperator, coerce?: boolean): string;
