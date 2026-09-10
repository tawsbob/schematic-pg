import { formatDefaultValue, serializeValue } from './value-formatter.js';
import { mapColumnType } from './type-mapper.js';
import { toSnakeCase, toTableName } from './snake-case.js';
export function getModelNames(schema) {
    return new Set(schema.models.map((model) => model.name));
}
export function getEnumNames(schema) {
    return new Set(schema.enums.map((enumDef) => enumDef.name));
}
export function isStoredField(field, modelNames) {
    return !modelNames.has(field.type.name);
}
export function getStoredFields(model, modelNames) {
    return model.fields.filter((field) => isStoredField(field, modelNames));
}
export function getFieldAttribute(field, name) {
    return field.attributes.find((attr) => attr.name === name);
}
export function getModelAttribute(model, name) {
    return model.attributes.find((attr) => attr.name === name);
}
export function getDirective(model, name) {
    return model.directives.find((directive) => directive.name === name);
}
export function getDirectives(model, name) {
    return model.directives.filter((directive) => directive.name === name);
}
export function assertKeyValueArgs(args) {
    if (!args || args.kind !== 'KeyValueArgs') {
        throw new Error('Expected KeyValueArgs');
    }
    return args;
}
export function getKvPair(args, key) {
    const pair = args.pairs.find((item) => item.key === key);
    if (!pair) {
        throw new Error(`Missing key "${key}" in KeyValueArgs`);
    }
    return pair;
}
export function getOptionalKvPair(args, key) {
    return args.pairs.find((item) => item.key === key);
}
export function getIdentifierNames(value) {
    if (value.kind !== 'ArrayLiteral') {
        throw new Error('Expected ArrayLiteral');
    }
    return value.elements.map((element) => {
        if (element.kind !== 'Identifier') {
            throw new Error('Expected Identifier in array');
        }
        return element.name;
    });
}
export function fieldHasAttribute(field, name) {
    return field.attributes.some((attr) => attr.name === name);
}
export function getPrimaryKey(model) {
    const compositeDirective = getDirective(model, 'id');
    if (compositeDirective?.args?.kind === 'KeyValueArgs') {
        const fields = getIdentifierNames(getKvPair(compositeDirective.args, 'fields').value);
        return { fields, composite: fields.length > 1 };
    }
    const modelLevelId = getModelAttribute(model, 'id');
    if (modelLevelId) {
        const idField = model.fields.find((field) => field.name === 'id');
        if (idField) {
            return { fields: [idField.name], composite: false };
        }
    }
    const idFields = model.fields.filter((field) => fieldHasAttribute(field, 'id')).map((field) => field.name);
    if (idFields.length === 1) {
        return { fields: idFields, composite: false };
    }
    if (idFields.length > 1) {
        return { fields: idFields, composite: true };
    }
    return undefined;
}
export function getDefaultExpression(field, enumNames) {
    const defaultAttr = getFieldAttribute(field, 'default');
    if (!defaultAttr?.args || defaultAttr.args.kind !== 'ExpressionArgs') {
        return undefined;
    }
    const [expression] = defaultAttr.args.expressions;
    if (!expression) {
        return undefined;
    }
    return formatDefaultValue(expression, field.type, enumNames);
}
export function collectValidationComments(field) {
    const comments = [];
    const regexAttr = getFieldAttribute(field, 'regex');
    if (regexAttr?.args?.kind === 'KeyValueArgs') {
        const pattern = getOptionalKvPair(regexAttr.args, 'pattern');
        const message = getOptionalKvPair(regexAttr.args, 'message');
        const patternValue = pattern?.value.kind === 'StringLiteral' ? `'${pattern.value.value}'` : 'unknown';
        const messageValue = message?.value.kind === 'StringLiteral' ? `'${message.value.value}'` : 'unknown';
        comments.push(`-- @regex: pattern = ${patternValue}, message = ${messageValue}`);
    }
    const rangeAttr = getFieldAttribute(field, 'range');
    if (rangeAttr?.args?.kind === 'KeyValueArgs') {
        const min = getOptionalKvPair(rangeAttr.args, 'min');
        const max = getOptionalKvPair(rangeAttr.args, 'max');
        const message = getOptionalKvPair(rangeAttr.args, 'message');
        const minValue = min?.value.kind === 'NumberLiteral' ? String(min.value.value) : 'unknown';
        const maxValue = max?.value.kind === 'NumberLiteral' ? String(max.value.value) : 'unknown';
        const messageValue = message?.value.kind === 'StringLiteral' ? `'${message.value.value}'` : 'unknown';
        comments.push(`-- @range: min = ${minValue}, max = ${maxValue}, message = ${messageValue}`);
    }
    return comments;
}
export function mapReferentialAction(value) {
    if (!value || value.kind !== 'Identifier') {
        return undefined;
    }
    return value.name.replace(/_/g, ' ');
}
export function collectForeignKeys(schema) {
    const modelNames = getModelNames(schema);
    const foreignKeys = [];
    for (const model of schema.models) {
        for (const field of model.fields) {
            if (!modelNames.has(field.type.name)) {
                continue;
            }
            const relation = getFieldAttribute(field, 'relation');
            if (!relation?.args || relation.args.kind !== 'KeyValueArgs') {
                continue;
            }
            const fieldsPair = getOptionalKvPair(relation.args, 'fields');
            const referencesPair = getOptionalKvPair(relation.args, 'references');
            if (!fieldsPair || !referencesPair) {
                continue;
            }
            const sourceColumns = getIdentifierNames(fieldsPair.value);
            const targetColumns = getIdentifierNames(referencesPair.value);
            const onDelete = mapReferentialAction(getOptionalKvPair(relation.args, 'onDelete')?.value);
            const onUpdate = mapReferentialAction(getOptionalKvPair(relation.args, 'onUpdate')?.value);
            foreignKeys.push({
                sourceModel: model.name,
                sourceTable: toTableName(model.name),
                sourceColumns: sourceColumns.map(toSnakeCase),
                targetModel: field.type.name,
                targetTable: toTableName(field.type.name),
                targetColumns: targetColumns.map(toSnakeCase),
                onDelete,
                onUpdate,
            });
        }
    }
    return foreignKeys;
}
export function serializeColumnType(type, enumNames) {
    return mapColumnType(type, enumNames);
}
export function serializeDefault(field, enumNames) {
    const defaultAttr = getFieldAttribute(field, 'default');
    if (!defaultAttr?.args || defaultAttr.args.kind !== 'ExpressionArgs') {
        return undefined;
    }
    const [expression] = defaultAttr.args.expressions;
    if (!expression) {
        return undefined;
    }
    return serializeValue(expression);
}
export function getFieldSnakeNameMap(model, modelNames) {
    const map = new Map();
    for (const field of getStoredFields(model, modelNames)) {
        map.set(field.name, toSnakeCase(field.name));
    }
    return map;
}
export function transformWhereClause(where, fieldNameMap) {
    let transformed = where;
    const sortedFieldNames = [...fieldNameMap.keys()].sort((a, b) => b.length - a.length);
    for (const fieldName of sortedFieldNames) {
        const snakeName = fieldNameMap.get(fieldName);
        const pattern = new RegExp(`\\b${escapeRegExp(fieldName)}\\b`, 'g');
        transformed = transformed.replace(pattern, snakeName);
    }
    return transformed;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function serializeForeignKey(foreignKey) {
    return JSON.stringify({
        sourceTable: foreignKey.sourceTable,
        sourceColumns: foreignKey.sourceColumns,
        targetTable: foreignKey.targetTable,
        targetColumns: foreignKey.targetColumns,
        onDelete: foreignKey.onDelete,
        onUpdate: foreignKey.onUpdate,
    });
}
export function parseForeignKeySignature(signature) {
    const parsed = JSON.parse(signature);
    return {
        sourceModel: '',
        targetModel: '',
        ...parsed,
    };
}
export function normalizeIndexDirective(directive, model, modelNames) {
    const args = assertKeyValueArgs(directive.args);
    const fields = getIdentifierNames(getKvPair(args, 'fields').value);
    const wherePair = getOptionalKvPair(args, 'where');
    const uniquePair = getOptionalKvPair(args, 'unique');
    const namePair = getOptionalKvPair(args, 'name');
    const typePair = getOptionalKvPair(args, 'type');
    const fieldNameMap = getFieldSnakeNameMap(model, modelNames);
    return {
        fields,
        where: wherePair?.value.kind === 'StringLiteral'
            ? transformWhereClause(wherePair.value.value, fieldNameMap)
            : undefined,
        unique: uniquePair?.value.kind === 'BooleanLiteral' ? uniquePair.value.value : undefined,
        name: namePair?.value.kind === 'StringLiteral' ? namePair.value.value : undefined,
        type: typePair?.value.kind === 'Identifier' ? typePair.value.name : undefined,
    };
}
export function normalizeTriggerDirective(directive) {
    const args = assertKeyValueArgs(directive.args);
    const timing = getKvPair(args, 'timing').value;
    const event = getKvPair(args, 'event').value;
    const execute = getKvPair(args, 'execute').value;
    const levelPair = getOptionalKvPair(args, 'level');
    if (timing.kind !== 'Identifier' || event.kind !== 'Identifier') {
        throw new Error('Trigger timing and event must be identifiers');
    }
    if (execute.kind !== 'TripleStringLiteral') {
        throw new Error('Trigger execute must be a triple-quoted string');
    }
    const levelValue = levelPair?.value.kind === 'Identifier' ? levelPair.value.name.toUpperCase() : 'ROW';
    return {
        timing: timing.name.toUpperCase(),
        event: event.name.toUpperCase(),
        level: levelValue,
        execute: execute.value.trim(),
    };
}
export function resolveTriggerNames(model, timing, event) {
    const timingValue = timing.toLowerCase();
    const eventValue = event.toLowerCase();
    const baseName = `${toTableName(model.name)}_${timingValue}_${eventValue}`;
    return {
        functionName: `${baseName}_trigger_func`,
        triggerName: `${baseName}_trigger`,
    };
}
export function normalizeFunction(sqlFunction, enumNames) {
    return {
        name: sqlFunction.name,
        sqlName: toSnakeCase(sqlFunction.name),
        params: sqlFunction.params.map((param) => ({
            name: param.name,
            sqlName: toSnakeCase(param.name),
            sqlType: serializeColumnType(param.type, enumNames),
        })),
        returns: serializeColumnType(sqlFunction.returns, enumNames),
        language: (sqlFunction.language ?? 'sql').toLowerCase(),
        volatility: (sqlFunction.volatility ?? 'VOLATILE').toUpperCase(),
        security: (sqlFunction.security ?? 'INVOKER').toUpperCase(),
        execute: sqlFunction.execute.trim(),
    };
}
export function functionIdentity(normalized) {
    return JSON.stringify({
        sqlName: normalized.sqlName,
        params: normalized.params.map((param) => param.sqlType),
        returns: normalized.returns,
    });
}
export function functionSignature(normalized) {
    return JSON.stringify(normalized);
}
