import type { Model, Schema } from '../schema-dsl/ast.js';
export declare class RouteGenerator {
    private readonly model;
    private readonly schema;
    constructor(model: Model, schema: Schema);
    generate(): string;
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
export declare function generateRouteFiles(schema: Schema): Map<string, string>;
export declare function getRouteMountEntries(schema: Schema): {
    basePath: string;
    fileName: string;
    importName: string;
}[];
