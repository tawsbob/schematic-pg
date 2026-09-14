import type { Field, Model, Schema } from '../../schema-dsl/ast.js';
export declare function generateTables(schema: Schema): string;
export declare function generateTableWithPartitions(model: Model, enumNames: Set<string>, modelNames: Set<string>): string[];
export declare function generateTable(model: Model, enumNames: Set<string>, modelNames: Set<string>): string;
export declare function generateColumnDefinition(field: Field, model: Model, enumNames: Set<string>, modelNames: Set<string>): string;
