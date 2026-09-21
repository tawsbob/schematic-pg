import type { Schema, View } from '../../schema-dsl/ast.js';
export declare function generateViews(schema: Schema): string;
export declare function generateCreateView(view: View): string;
export declare function generateDropView(viewName: string, materialized: boolean): string;
