import type { Model, Schema } from '../schema-dsl/ast.js';
import type { CustomRouteMountEntry } from './custom-route-scanner.js';
export interface RouteGeneratorOptions {
    modelsWithHooks?: ReadonlySet<string>;
    overlays?: ReadonlyMap<string, CustomRouteMountEntry>;
}
export declare class RouteGenerator {
    private readonly model;
    private readonly schema;
    private readonly modelsWithHooks;
    private readonly overlays;
    constructor(model: Model, schema: Schema, options?: RouteGeneratorOptions);
    generate(): string | null;
    private generateOverlayOnly;
    private jsonRow;
    private jsonRows;
    private mutationJsonRow;
    private generateListRoute;
    private generateGetRoute;
    private generateCreateRoute;
    private generateUpdateRoute;
    private generateDeleteRoute;
    getRouteFileName(): string;
    getRouteBasePath(): string;
}
export declare function generateRouteFiles(schema: Schema, modelsWithHooksOrOptions?: ReadonlySet<string> | RouteGeneratorOptions): Map<string, string>;
export declare function getRouteMountEntries(schema: Schema, overlays?: ReadonlyMap<string, CustomRouteMountEntry>): {
    basePath: string;
    fileName: string;
    importName: string;
}[];
