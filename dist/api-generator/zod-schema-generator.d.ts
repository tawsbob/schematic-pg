import type { Schema } from '../schema-dsl/ast.js';
export declare class ZodSchemaGenerator {
    private readonly schema;
    constructor(schema: Schema);
    generate(): string;
    private generateGlobalMetadata;
    private generateModelSchemas;
    private generateListQuerySchemas;
    private generateIncludeRefinement;
    private generateReadQueryRefinement;
    private generateListQueryFieldLines;
    private generateObjectField;
    private generateParamField;
    private toParamZodType;
    private toZodType;
    private mapBaseZodType;
    private applyValidationRules;
    private escapeRegexLiteral;
    private escapeStringLiteral;
}
export declare function generateValidationSchemas(schema: Schema): string;
