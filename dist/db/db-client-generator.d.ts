import type { Schema } from '../schema-dsl/ast.js';
export declare class DbClientGenerator {
    private readonly schema;
    constructor(schema: Schema);
    generate(): string;
    generateModelMetaModule(): string;
    private generateModelClientEntry;
    private generateViewClientEntry;
}
export declare function generateDbClientFiles(schema: Schema): {
    dbTypes: string;
    dbClient: string;
    modelMeta: string;
};
