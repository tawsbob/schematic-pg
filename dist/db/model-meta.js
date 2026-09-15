import { fieldHasAttribute, getModelNames, getPrimaryKey, getStoredFields, } from '../sql-generator/utils/ast-helpers.js';
import { buildRelations } from './utils/relations.js';
import { toColumnName, toTableName } from './utils/naming.js';
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
export function buildModelMeta(model, schema) {
    return hydrateModelMeta(buildModelMetaSnapshot(model, schema));
}
export function buildModelMetaSnapshot(model, schema) {
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
export function hydrateModelMeta(snapshot) {
    const relations = snapshot.relations ?? [];
    return {
        ...snapshot,
        relations,
        relationByName: new Map(relations.map((relation) => [relation.name, relation])),
        fieldByName: new Map(Object.entries(snapshot.fieldByName)),
        columnToField: new Map(Object.entries(snapshot.columnToField)),
    };
}
export function buildModelMetas(schema) {
    return schema.models.map((model) => buildModelMeta(model, schema));
}
function toFieldMeta(field, enumNames, primaryKeyFields) {
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
function quoteTable(modelName) {
    const tableName = toTableName(modelName);
    const reserved = new Set(['user', 'order']);
    return reserved.has(tableName) ? `"${tableName}"` : tableName;
}
