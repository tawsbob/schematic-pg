import type { Schema } from '../schema-dsl/ast.js';
export interface CustomRouteMountEntry {
    basePath: string;
    importName: string;
    /** Import path relative to generated/app.ts */
    importPath: string;
    /** Import path relative to generated/routes/*.ts */
    routeImportPath: string;
}
export interface PartitionedCustomRoutes {
    overlays: Map<string, CustomRouteMountEntry>;
    standalone: CustomRouteMountEntry[];
}
export declare function discoverCustomRoutes(customRoutesDir: string): CustomRouteMountEntry[];
export declare function partitionCustomRoutes(entries: CustomRouteMountEntry[], schema: Schema): PartitionedCustomRoutes;
