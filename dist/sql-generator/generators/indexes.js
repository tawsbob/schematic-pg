import { getDirectives, getModelNames, normalizeIndexDirective, } from '../utils/ast-helpers.js';
import { joinSection } from '../utils/format.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';
export function buildIndexName(tableName, fields) {
    const fieldPart = fields.map(toSnakeCase).join('_');
    return `${tableName}_${fieldPart}_idx`;
}
export function resolveIndexName(tableName, normalized) {
    return normalized.name ?? buildIndexName(tableName, normalized.fields);
}
export function generateCreateIndexOnRelation(relationName, normalized) {
    const tableName = quoteIdentifier(toTableName(relationName));
    const columns = normalized.fields.map(toSnakeCase).join(', ');
    const indexName = resolveIndexName(toTableName(relationName), normalized);
    const uniqueKeyword = normalized.unique ? 'UNIQUE ' : '';
    const usingClause = normalized.type && normalized.type.toUpperCase() !== 'BTREE'
        ? ` USING ${normalized.type.toLowerCase()}`
        : normalized.type?.toUpperCase() === 'BTREE'
            ? ' USING btree'
            : '';
    const whereClause = normalized.where ? ` WHERE ${normalized.where}` : '';
    return `CREATE ${uniqueKeyword}INDEX ${indexName} ON ${tableName}${usingClause} (${columns})${whereClause};`;
}
export function generateDropIndexOnRelation(relationName, normalized) {
    const indexName = resolveIndexName(toTableName(relationName), normalized);
    return `DROP INDEX IF EXISTS ${indexName};`;
}
export function generateCreateIndex(model, normalized) {
    return generateCreateIndexOnRelation(model.name, normalized);
}
export function generateDropIndex(model, normalized) {
    return generateDropIndexOnRelation(model.name, normalized);
}
export function generateIndexes(schema) {
    const modelNames = getModelNames(schema);
    const statements = [];
    for (const model of schema.models) {
        const indexDirectives = getDirectives(model, 'index');
        for (const directive of indexDirectives) {
            const normalized = normalizeIndexDirective(directive, model, modelNames);
            statements.push(generateCreateIndex(model, normalized));
        }
    }
    return joinSection('Create indexes', statements);
}
