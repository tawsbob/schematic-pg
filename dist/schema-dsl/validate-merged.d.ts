import type { Schema } from './ast.js';
/**
 * Strict validation for a fully merged schema.
 * Must not be called from parse() — the language server validates single buffers
 * where cross-file model references would look unresolved.
 */
export declare function validateMergedSchema(schema: Schema): void;
