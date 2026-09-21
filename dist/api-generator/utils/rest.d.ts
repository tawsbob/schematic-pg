import type { Model, View } from '../../schema-dsl/ast.js';
export type RestOperation = 'list' | 'get' | 'create' | 'update' | 'delete';
export declare const REST_OPERATIONS: RestOperation[];
export declare const VIEW_REST_OPERATIONS: RestOperation[];
export interface NormalizedRest {
    operations: Set<RestOperation>;
}
export declare function normalizeRest(model: Model): NormalizedRest;
export declare function normalizeViewRest(view: View): NormalizedRest;
export declare function isRestEnabled(model: Model): boolean;
export declare function isViewRestEnabled(view: View): boolean;
export declare function hasRestOperation(model: Model, operation: RestOperation): boolean;
export declare function hasViewRestOperation(view: View, operation: RestOperation): boolean;
