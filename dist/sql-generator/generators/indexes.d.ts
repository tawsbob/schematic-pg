import type { Model, Schema } from '../../schema-dsl/ast.js';
export interface NormalizedIndex {
    fields: string[];
    where?: string;
    unique?: boolean;
    name?: string;
    type?: string;
}
export declare function buildIndexName(tableName: string, fields: string[]): string;
export declare function resolveIndexName(tableName: string, normalized: NormalizedIndex): string;
export declare function generateCreateIndexOnRelation(relationName: string, normalized: NormalizedIndex): string;
export declare function generateDropIndexOnRelation(relationName: string, normalized: NormalizedIndex): string;
export declare function generateCreateIndex(model: Model, normalized: NormalizedIndex): string;
export declare function generateDropIndex(model: Model, normalized: NormalizedIndex): string;
export declare function generateIndexes(schema: Schema): string;
