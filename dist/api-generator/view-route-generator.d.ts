import type { Schema, View } from '../schema-dsl/ast.js';
export declare class ViewRouteGenerator {
    private readonly view;
    private readonly schema;
    constructor(view: View, schema: Schema);
    generate(): string | null;
    getRouteFileName(): string;
    getRouteBasePath(): string;
    private generateListRoute;
    private generateGetRoute;
}
export declare function generateViewRouteFiles(schema: Schema): Map<string, string>;
export declare function getViewRouteMountEntries(schema: Schema): {
    basePath: string;
    fileName: string;
    importName: string;
}[];
