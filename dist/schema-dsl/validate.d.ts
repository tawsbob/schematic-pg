import type { Schema, SourceLocation } from './ast.js';
export declare class SchemaError extends Error {
    readonly line: number;
    readonly col: number;
    readonly file?: string;
    constructor(message: string, loc: SourceLocation);
}
export declare function validateSchema(schema: Schema): void;
