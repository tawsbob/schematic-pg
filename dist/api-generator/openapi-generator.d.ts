import type { Schema } from '../schema-dsl/ast.js';
export interface OpenApiGeneratorOptions {
    includeAuthPaths?: boolean;
}
type OpenApiDocument = Record<string, unknown>;
export declare class OpenApiGenerator {
    private readonly schema;
    private readonly options;
    constructor(schema: Schema, options?: OpenApiGeneratorOptions);
    generate(): OpenApiDocument;
    generateJson(): string;
    generateTsModule(): string;
    private buildModelComponentSchemas;
    private buildModelPaths;
    private buildListQueryParameters;
    private buildIncludeParameter;
    private buildPathParameters;
    private filterParamSchema;
    private fieldToOpenApiSchema;
    private mapTypeToOpenApi;
    private buildAuthComponentSchemas;
    private buildAuthPaths;
}
export declare function generateOpenApiDocument(schema: Schema, options?: OpenApiGeneratorOptions): OpenApiDocument;
export declare function generateOpenApiFiles(schema: Schema, options?: OpenApiGeneratorOptions): {
    openapiTs: string;
    openapiJson: string;
};
export {};
