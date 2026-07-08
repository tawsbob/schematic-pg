import { mapPgError } from '../errors.js';
import { mapRows } from '../row-mapper.js';
import { WhereTranslator } from '../where-translator.js';
import { dedupeKeys, extractParentKeys, stitch } from './hydrator.js';
export async function loadIncludes(parentRows, plan, executor) {
    for (const childPlan of plan.children) {
        const relation = childPlan.relation;
        if (!relation) {
            continue;
        }
        const parentKeys = extractParentKeys(parentRows, relation);
        if (parentKeys.length === 0) {
            assignEmptyRelation(parentRows, relation);
            continue;
        }
        const childRows = await fetchRelationRows(childPlan, parentKeys, executor);
        await loadIncludes(childRows, childPlan, executor);
        stitch(parentRows, childRows, relation);
    }
}
function assignEmptyRelation(parentRows, relation) {
    for (const parent of parentRows) {
        parent[relation.name] = relation.unique ? null : [];
    }
}
async function fetchRelationRows(node, parentKeys, executor) {
    const relation = node.relation;
    if (!relation) {
        return [];
    }
    const query = buildRelationSelect(node, parentKeys);
    const rows = await executeQuery(executor, query.sql, query.params, node.model);
    return mapRows(rows, node.model);
}
function buildRelationSelect(node, parentKeys) {
    const relation = node.relation;
    const foreignField = node.model.fieldByName.get(relation.foreignKey);
    if (!foreignField) {
        throw new Error(`Unknown foreign key field "${relation.foreignKey}" on model ${node.model.name}`);
    }
    const dedupedKeys = dedupeKeys(parentKeys);
    const params = [dedupedKeys];
    const whereTranslator = new WhereTranslator(node.model, 2);
    const nestedWhere = whereTranslator.translate(node.where);
    params.push(...nestedWhere.params);
    const clauses = [`${foreignField.columnName} = ANY($1)`];
    if (nestedWhere.sql) {
        clauses.push(nestedWhere.sql);
    }
    const orderByClause = buildOrderByClause(node);
    let sql = `SELECT * FROM ${node.model.quotedTableName} WHERE ${clauses.join(' AND ')}`;
    if (orderByClause) {
        sql += ` ${orderByClause}`;
    }
    if (node.take !== undefined) {
        params.push(node.take);
        sql += ` LIMIT $${params.length}`;
    }
    if (node.skip !== undefined) {
        params.push(node.skip);
        sql += ` OFFSET $${params.length}`;
    }
    return { sql, params };
}
function buildOrderByClause(plan) {
    if (!plan.orderBy) {
        return '';
    }
    const entries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
    const parts = [];
    for (const entry of entries) {
        for (const [fieldName, direction] of Object.entries(entry)) {
            const field = plan.model.fieldByName.get(fieldName);
            if (!field) {
                throw new Error(`Unknown orderBy field "${fieldName}" on model ${plan.model.name}`);
            }
            parts.push(`${field.columnName} ${direction.toUpperCase()}`);
        }
    }
    return parts.length > 0 ? `ORDER BY ${parts.join(', ')}` : '';
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
