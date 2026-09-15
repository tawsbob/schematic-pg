import type { Schema } from './ast.js';
export interface SchemaFragment {
    file: string;
    source: string;
    schema: Schema;
}
export interface MergedSchema {
    schema: Schema;
    canonicalSource: string;
}
export declare function parseFragment(source: string, filePath?: string): Schema;
export declare function mergeFragments(fragments: SchemaFragment[]): MergedSchema;
