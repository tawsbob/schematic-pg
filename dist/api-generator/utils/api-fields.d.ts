import type { Field, Model, Schema } from '../../schema-dsl/ast.js';
export declare function isStoredScalarField(field: Field, schema: Schema): boolean;
export declare function isUnfilterable(field: Field): boolean;
export declare function isOmitted(field: Field): boolean;
export declare function getFilterableFields(model: Model, schema: Schema): Field[];
export declare function getOmittedFields(model: Model, schema: Schema): Field[];
export declare function getSortableFieldNames(model: Model, schema: Schema): string[];
export declare function toModelConstantPrefix(modelName: string): string;
