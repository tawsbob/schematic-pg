import type { Attribute, AttributeArgs, Directive, Field, KeyValueArgs, Model, Schema, SqlFunction, TypeExpr, Value } from '../../schema-dsl/ast.js';
export interface PrimaryKeyInfo {
    fields: string[];
    composite: boolean;
}
export interface ForeignKeyInfo {
    sourceModel: string;
    sourceTable: string;
    sourceColumns: string[];
    targetModel: string;
    targetTable: string;
    targetColumns: string[];
    onDelete?: string;
    onUpdate?: string;
}
export declare function getModelNames(schema: Schema): Set<string>;
export declare function getEnumNames(schema: Schema): Set<string>;
export declare function isStoredField(field: Field, modelNames: Set<string>): boolean;
export declare function getStoredFields(model: Model, modelNames: Set<string>): Field[];
export declare function getFieldAttribute(field: Field, name: string): Attribute | undefined;
export declare function getModelAttribute(model: Model, name: string): Attribute | undefined;
export declare function getDirective(model: Model, name: string): Directive | undefined;
export declare function getDirectives(model: Model, name: string): Directive[];
export declare function assertKeyValueArgs(args: AttributeArgs | undefined): KeyValueArgs;
export declare function getKvPair(args: KeyValueArgs, key: string): import("../../schema-dsl/ast.js").KeyValuePair;
export declare function getOptionalKvPair(args: KeyValueArgs, key: string): import("../../schema-dsl/ast.js").KeyValuePair | undefined;
export declare function getIdentifierNames(value: Value): string[];
export declare function fieldHasAttribute(field: Field, name: string): boolean;
export declare function getPrimaryKey(model: Model): PrimaryKeyInfo | undefined;
export declare function getDefaultExpression(field: Field, enumNames: Set<string>): string | undefined;
export declare function collectValidationComments(field: Field): string[];
export declare function mapReferentialAction(value: Value | undefined): string | undefined;
export declare function collectForeignKeys(schema: Schema): ForeignKeyInfo[];
export declare function serializeColumnType(type: TypeExpr, enumNames: Set<string>): string;
export declare function serializeDefault(field: Field, enumNames: Set<string>): string | undefined;
export declare function getFieldSnakeNameMap(model: Model, modelNames: Set<string>): Map<string, string>;
export declare function transformWhereClause(where: string, fieldNameMap: Map<string, string>): string;
export declare function serializeForeignKey(foreignKey: ForeignKeyInfo): string;
export declare function parseForeignKeySignature(signature: string): ForeignKeyInfo;
export declare function normalizeIndexDirective(directive: Directive, model: Model, modelNames: Set<string>): {
    fields: string[];
    where?: string;
    unique?: boolean;
    name?: string;
    type?: string;
};
export interface NormalizedTrigger {
    timing: string;
    event: string;
    level: string;
    execute: string;
}
export interface TriggerNames {
    functionName: string;
    triggerName: string;
}
export declare function normalizeTriggerDirective(directive: Directive): NormalizedTrigger;
export declare function resolveTriggerNames(model: Model, timing: string, event: string): TriggerNames;
export interface NormalizedFunctionParam {
    name: string;
    sqlName: string;
    sqlType: string;
}
export interface NormalizedFunction {
    name: string;
    sqlName: string;
    params: NormalizedFunctionParam[];
    returns: string;
    language: string;
    volatility: string;
    security: string;
    execute: string;
}
export declare function normalizeFunction(sqlFunction: SqlFunction, enumNames: Set<string>): NormalizedFunction;
export declare function functionIdentity(normalized: NormalizedFunction): string;
export declare function functionSignature(normalized: NormalizedFunction): string;
