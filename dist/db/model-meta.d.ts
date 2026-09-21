import type { Model, Schema, TypeExpr, View } from '../schema-dsl/ast.js';
export type RelationKind = 'belongsTo' | 'hasOne' | 'hasMany';
export interface RelationMeta {
    name: string;
    kind: RelationKind;
    targetModel: string;
    localKey: string;
    foreignKey: string;
    unique: boolean;
    relationName?: string;
}
export interface FieldMeta {
    name: string;
    columnName: string;
    type: TypeExpr;
    optional: boolean;
    hasDefault: boolean;
    isId: boolean;
    isUnique: boolean;
    isEnum: boolean;
    isNumeric: boolean;
    isString: boolean;
    isBoolean: boolean;
}
export interface ModelMetaSnapshot {
    name: string;
    tableName: string;
    quotedTableName: string;
    primaryKeyFields: string[];
    fields: FieldMeta[];
    fieldByName: Record<string, FieldMeta>;
    columnToField: Record<string, string>;
    relations: RelationMeta[];
}
export interface ModelMeta {
    name: string;
    tableName: string;
    quotedTableName: string;
    primaryKeyFields: string[];
    fields: FieldMeta[];
    fieldByName: Map<string, FieldMeta>;
    columnToField: Map<string, string>;
    relations: RelationMeta[];
    relationByName: Map<string, RelationMeta>;
}
export declare function buildModelMeta(model: Model, schema: Schema): ModelMeta;
export declare function buildViewMeta(view: View, schema: Schema): ModelMeta;
export declare function buildModelMetaSnapshot(model: Model, schema: Schema): ModelMetaSnapshot;
export declare function buildViewMetaSnapshot(view: View, schema: Schema): ModelMetaSnapshot;
export declare function hydrateModelMeta(snapshot: ModelMetaSnapshot): ModelMeta;
export declare function buildModelMetas(schema: Schema): ModelMeta[];
