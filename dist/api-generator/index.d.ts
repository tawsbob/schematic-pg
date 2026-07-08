import type { Schema } from '../schema-dsl/ast.js';
export interface GeneratedApiFiles {
    app: string;
    policies: string;
    validation: string;
    hooks: string;
    routes: Map<string, string>;
}
export interface GenerateApiFilesOptions {
    customRoutesDir?: string;
    hooksDir?: string;
}
export declare function generateApiFiles(schema: Schema, options?: GenerateApiFilesOptions): GeneratedApiFiles;
