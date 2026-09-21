import type { Field, Model, Schema, TypeExpr, View } from '../schema-dsl/ast.js';
import {
  fieldHasAttribute,
  getModelNames,
  getPrimaryKey,
  getStoredFields,
} from '../sql-generator/utils/ast-helpers.js';
import { buildRelations } from './utils/relations.js';
import { toColumnName, toTableName } from './utils/naming.js';

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

const NUMERIC_TYPES = new Set([
  'INTEGER',
  'SERIAL',
  'SMALLINT',
  'BIGINT',
  'BIGSERIAL',
  'DECIMAL',
  'NUMERIC',
  'REAL',
  'DOUBLE',
]);
const STRING_TYPES = new Set(['UUID', 'VARCHAR', 'TEXT']);

export function buildModelMeta(model: Model, schema: Schema): ModelMeta {
  return hydrateModelMeta(buildModelMetaSnapshot(model, schema));
}

export function buildViewMeta(view: View, schema: Schema): ModelMeta {
  return hydrateModelMeta(buildViewMetaSnapshot(view, schema));
}

export function buildModelMetaSnapshot(model: Model, schema: Schema): ModelMetaSnapshot {
  const modelNames = getModelNames(schema);
  const enumNames = new Set(schema.enums.map((enumDef) => enumDef.name));
  const primaryKey = getPrimaryKey(model);
  const primaryKeyFields = primaryKey?.fields ?? ['id'];
  const storedFields = getStoredFields(model, modelNames);

  const fields = storedFields.map((field) => toFieldMeta(field, enumNames, primaryKeyFields));
  const fieldByName = Object.fromEntries(fields.map((field) => [field.name, field]));
  const columnToField = Object.fromEntries(fields.map((field) => [field.columnName, field.name]));
  const relations = buildRelations(model, schema);

  return {
    name: model.name,
    tableName: toTableName(model.name),
    quotedTableName: quoteTable(model.name),
    primaryKeyFields,
    fields,
    fieldByName,
    columnToField,
    relations,
  };
}

export function buildViewMetaSnapshot(view: View, schema: Schema): ModelMetaSnapshot {
  const enumNames = new Set(schema.enums.map((enumDef) => enumDef.name));
  const primaryKey = getPrimaryKey(view);
  const primaryKeyFields = primaryKey?.fields ?? [];

  const fields = view.columns.map((field) => toFieldMeta(field, enumNames, primaryKeyFields));
  const fieldByName = Object.fromEntries(fields.map((field) => [field.name, field]));
  const columnToField = Object.fromEntries(fields.map((field) => [field.columnName, field.name]));

  return {
    name: view.name,
    tableName: toTableName(view.name),
    quotedTableName: quoteTable(view.name),
    primaryKeyFields,
    fields,
    fieldByName,
    columnToField,
    relations: [],
  };
}

export function hydrateModelMeta(snapshot: ModelMetaSnapshot): ModelMeta {
  const relations = snapshot.relations ?? [];

  return {
    ...snapshot,
    relations,
    relationByName: new Map(relations.map((relation) => [relation.name, relation])),
    fieldByName: new Map(Object.entries(snapshot.fieldByName)),
    columnToField: new Map(Object.entries(snapshot.columnToField)),
  };
}

export function buildModelMetas(schema: Schema): ModelMeta[] {
  return [
    ...schema.models.map((model) => buildModelMeta(model, schema)),
    ...schema.views.map((view) => buildViewMeta(view, schema)),
  ];
}

function toFieldMeta(field: Field, enumNames: Set<string>, primaryKeyFields: string[]): FieldMeta {
  const typeName = field.type.name;

  return {
    name: field.name,
    columnName: toColumnName(field.name),
    type: field.type,
    optional: Boolean(field.type.optional),
    hasDefault: fieldHasAttribute(field, 'default') || fieldHasAttribute(field, 'id'),
    isId: primaryKeyFields.includes(field.name) || fieldHasAttribute(field, 'id'),
    isUnique: fieldHasAttribute(field, 'unique') || fieldHasAttribute(field, 'id'),
    isEnum: enumNames.has(typeName),
    isNumeric: NUMERIC_TYPES.has(typeName),
    isString: STRING_TYPES.has(typeName) || enumNames.has(typeName),
    isBoolean: typeName === 'BOOLEAN',
  };
}

function quoteTable(modelName: string): string {
  const tableName = toTableName(modelName);
  const reserved = new Set(['user', 'order']);
  return reserved.has(tableName) ? `"${tableName}"` : tableName;
}
