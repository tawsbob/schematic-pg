import type { Schema } from '../../schema-dsl/ast.js';
import { type NormalizedFunction } from '../utils/ast-helpers.js';
export type { NormalizedFunction };
export declare function generateCreateFunction(normalized: NormalizedFunction): string;
export declare function generateDropFunction(normalized: NormalizedFunction): string;
export declare function generateFunctions(schema: Schema): string;
