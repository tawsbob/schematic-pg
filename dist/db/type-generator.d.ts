import type { Schema } from '../schema-dsl/ast.js';
export declare class TypeGenerator {
    private readonly schema;
    constructor(schema: Schema);
    generate(): string;
    private generateEnumType;
    private generateViewTypes;
    private generateModelTypes;
    private generateEntityInterface;
    private generateCreateInput;
    private generateUpdateInput;
    private generateWhereInput;
    private generateOrderByInput;
    private generateIncludeArgs;
    private generateInclude;
    private toTsType;
    private mapTypeExpr;
    private isFilterable;
    private toWhereFieldType;
}
export declare function generateDbTypes(schema: Schema): string;
export declare function getClientExportName(modelName: string): string;
