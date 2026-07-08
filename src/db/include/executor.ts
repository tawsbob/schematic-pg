import type { QueryResultRow } from 'pg';
import { mapPgError } from '../errors.js';
import type { ModelMeta } from '../model-meta.js';
import type { Queryable } from '../queryable.js';
import { mapRows } from '../row-mapper.js';
import { WhereTranslator } from '../where-translator.js';
import { dedupeKeys, extractParentKeys, stitch } from './hydrator.js';
import type { LoadNode } from './planner.js';

export async function loadIncludes(
  parentRows: Record<string, unknown>[],
  plan: LoadNode,
  executor: Queryable,
): Promise<void> {
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

function assignEmptyRelation(
  parentRows: Record<string, unknown>[],
  relation: NonNullable<LoadNode['relation']>,
): void {
  for (const parent of parentRows) {
    parent[relation.name] = relation.unique ? null : [];
  }
}

async function fetchRelationRows(
  node: LoadNode,
  parentKeys: unknown[],
  executor: Queryable,
): Promise<Record<string, unknown>[]> {
  const relation = node.relation;
  if (!relation) {
    return [];
  }

  const query = buildRelationSelect(node, parentKeys);
  const rows = await executeQuery(executor, query.sql, query.params, node.model);
  return mapRows<Record<string, unknown>>(rows, node.model);
}

function buildRelationSelect(node: LoadNode, parentKeys: unknown[]) {
  const relation = node.relation!;
  const foreignField = node.model.fieldByName.get(relation.foreignKey);

  if (!foreignField) {
    throw new Error(
      `Unknown foreign key field "${relation.foreignKey}" on model ${node.model.name}`,
    );
  }

  const dedupedKeys = dedupeKeys(parentKeys);
  const params: unknown[] = [dedupedKeys];
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

function buildOrderByClause(plan: LoadNode): string {
  if (!plan.orderBy) {
    return '';
  }

  const entries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
  const parts: string[] = [];

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

async function executeQuery(
  executor: Queryable,
  sql: string,
  params: unknown[],
  model: ModelMeta,
): Promise<QueryResultRow[]> {
  try {
    const result = await executor.query<QueryResultRow>(sql, params);
    return result.rows;
  } catch (error) {
    throw mapPgError(error, model.name, model.columnToField);
  }
}
