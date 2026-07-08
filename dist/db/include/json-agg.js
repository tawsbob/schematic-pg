import { mapPgError } from '../errors.js';
import { QueryBuilder } from '../query-builder.js';
import { mapRow } from '../row-mapper.js';
const ROOT_ALIAS = 'root';
export async function fetchRootWithJsonAgg(model, plan, args, executor) {
    const query = buildJsonAggRootQuery(model, plan, args);
    const rows = await executeQuery(executor, query.sql, query.params, model);
    return rows.map((row) => hydrateJsonAggRow(row, model, plan));
}
function buildJsonAggRootQuery(model, plan, args) {
    const builder = new QueryBuilder(model);
    const baseQuery = builder.select(args);
    const match = baseQuery.sql.match(/^SELECT \* FROM ([^\s]+)([\s\S]*)$/);
    if (!match || plan.children.length === 0) {
        return baseQuery;
    }
    const tableRef = match[1];
    const rest = match[2] ?? '';
    const lateralJoins = plan.children.map((child) => buildRootLateralJoin(model, child));
    const sql = [
        `SELECT ${ROOT_ALIAS}.*, ${lateralJoins.map((join) => join.select).join(', ')}`,
        `FROM ${tableRef} ${ROOT_ALIAS}`,
        lateralJoins.map((join) => join.join).join(' '),
        rest.trim(),
    ]
        .filter((part) => part.length > 0)
        .join(' ');
    return { sql, params: baseQuery.params };
}
function buildRootLateralJoin(parentModel, node) {
    const relation = node.relation;
    const lateralAlias = `${relation.name}_data`;
    const expression = buildRelationJsonExpression(parentModel, node, ROOT_ALIAS);
    return {
        select: `${lateralAlias}.${relation.name}`,
        join: `LEFT JOIN LATERAL (SELECT ${expression} AS ${relation.name}) ${lateralAlias} ON true`,
    };
}
function buildRelationJsonExpression(parentModel, node, parentAlias) {
    const relation = node.relation;
    const childAlias = `${relation.name}_row`;
    const localField = parentModel.fieldByName.get(relation.localKey);
    const foreignField = node.model.fieldByName.get(relation.foreignKey);
    if (!localField || !foreignField) {
        throw new Error(`Invalid relation "${relation.name}" between ${parentModel.name} and ${node.model.name}`);
    }
    const rowJson = buildRowJsonExpression(node, childAlias);
    const whereClause = `${childAlias}.${foreignField.columnName} = ${parentAlias}.${localField.columnName}`;
    if (relation.unique) {
        return `(SELECT ${rowJson} FROM ${node.model.quotedTableName} ${childAlias} WHERE ${whereClause} LIMIT 1)`;
    }
    return `(SELECT COALESCE(json_agg(${rowJson}), '[]'::json) FROM ${node.model.quotedTableName} ${childAlias} WHERE ${whereClause})`;
}
function buildRowJsonExpression(node, rowAlias) {
    if (node.children.length === 0) {
        return `to_jsonb(${rowAlias})`;
    }
    const fieldPairs = node.model.fields.map((field) => `'${field.name}', ${rowAlias}.${field.columnName}`);
    for (const child of node.children) {
        const relation = child.relation;
        fieldPairs.push(`'${relation.name}', ${buildRelationJsonExpression(node.model, child, rowAlias)}`);
    }
    return `json_build_object(${fieldPairs.join(', ')})`;
}
function hydrateJsonAggRow(row, model, plan) {
    const mapped = mapRow(row, model);
    for (const child of plan.children) {
        const relation = child.relation;
        mapped[relation.name] = hydrateRelationValue(row[relation.name], child, relation.unique);
    }
    return mapped;
}
function hydrateRelationValue(rawValue, plan, unique) {
    if (rawValue == null) {
        return unique ? null : [];
    }
    if (unique) {
        return hydrateJsonObject(rawValue, plan);
    }
    if (!Array.isArray(rawValue)) {
        return [];
    }
    return rawValue.map((entry) => hydrateJsonObject(entry, plan));
}
function hydrateJsonObject(value, plan) {
    const mapped = mapRow(value, plan.model);
    for (const child of plan.children) {
        const relation = child.relation;
        mapped[relation.name] = hydrateRelationValue(value[relation.name], child, relation.unique);
    }
    return mapped;
}
async function executeQuery(executor, sql, params, model) {
    try {
        const result = await executor.query(sql, params);
        return result.rows;
    }
    catch (error) {
        throw mapPgError(error, model.name, model.columnToField);
    }
}
