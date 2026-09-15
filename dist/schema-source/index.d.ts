import type { Schema } from '../schema-dsl/ast.js';
export declare const DEFAULT_SCHEMA_FILE = "app.schema";
export declare const DEFAULT_SCHEMA_DIR = "schema";
export type SchemaSource = {
    kind: 'file';
    path: string;
} | {
    kind: 'fragments';
    dir: string;
    files: string[];
};
export interface LoadedSchema {
    schema: Schema;
    canonicalSource: string;
    source: SchemaSource;
}
export declare function resolveSchemaSource(arg?: string, cwd?: string): SchemaSource;
export declare function describeSchemaSource(source: SchemaSource): string;
export declare function loadSchema(source: SchemaSource): LoadedSchema;
export declare function loadSchemaFromArg(arg?: string, cwd?: string): LoadedSchema;
