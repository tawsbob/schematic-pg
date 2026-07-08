import type { QueryResultRow } from 'pg';
import { mapPgError } from '../errors.js';
import type { ModelMeta } from '../model-meta.js';
import type { FindArgs, SqlQuery } from '../query-builder.js';
import { QueryBuilder } from '../query-builder.js';
import type { Queryable } from '../queryable.js';
import { mapRow } from '../row-mapper.js';
import type { LoadNode } from './planner.js';

const ROOT_ALIAS = 'root';

export async function fetchRootWithJsonAgg<T extends Record<string, unknown>>(
  model: ModelMeta,
  plan: LoadNode,
  args: FindArgs,
  executor: Queryable,
): Promise<T[]> {
  const query = buildJsonAggRootQuery(model, plan, args);
  const rows = await executeQuery(executor, query.sql, query.params, model);
  return rows.map((row) => hydrateJsonAggRow<T>(row, model, plan));
}

function buildJsonAggRootQuery(model: ModelMeta, plan: LoadNode, args: FindArgs): SqlQuery {
  const builder = new QueryBuilder(model);
  const baseQuery = builder.select(args);
  const match = baseQuery.sql.match(/^SELECT \* FROM ([^\s]+)([\s\S]*)$/);

  if (!match || plan.children.length === 0) {
    return baseQuery;
  }

  const tableRef = match[1]!;
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

function buildRootLateralJoin(
  parentModel: ModelMeta,
  node: LoadNode,
): { select: string; join: string } {
  const relation = node.relation!;
  const lateralAlias = `${relation.name}_data`;
  const expression = buildRelationJsonExpression(parentModel, node, ROOT_ALIAS);

  return {
    select: `${lateralAlias}.${relation.name}`,
    join: `LEFT JOIN LATERAL (SELECT ${expression} AS ${relation.name}) ${lateralAlias} ON true`,
  };
}

function buildRelationJsonExpression(
  parentModel: ModelMeta,
  node: LoadNode,
  parentAlias: string,
): string {
  const relation = node.relation!;
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

function buildRowJsonExpression(node: LoadNode, rowAlias: string): string {
  if (node.children.length === 0) {
    return `to_jsonb(${rowAlias})`;
  }

  const fieldPairs = node.model.fields.map(
    (field) => `'${field.name}', ${rowAlias}.${field.columnName}`,
  );

  for (const child of node.children) {
    const relation = child.relation!;
    fieldPairs.push(`'${relation.name}', ${buildRelationJsonExpression(node.model, child, rowAlias)}`);
  }

  return `json_build_object(${fieldPairs.join(', ')})`;
}

function hydrateJsonAggRow<T extends Record<string, unknown>>(
  row: QueryResultRow,
  model: ModelMeta,
  plan: LoadNode,
): T {
  const mapped = mapRow<T>(row, model) as Record<string, unknown>;

  for (const child of plan.children) {
    const relation = child.relation!;
    mapped[relation.name] = hydrateRelationValue(row[relation.name], child, relation.unique);
  }

  return mapped as T;
}

function hydrateRelationValue(
  rawValue: unknown,
  plan: LoadNode,
  unique: boolean,
): unknown {
  if (rawValue == null) {
    return unique ? null : [];
  }

  if (unique) {
    return hydrateJsonObject(rawValue as Record<string, unknown>, plan);
  }

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.map((entry) => hydrateJsonObject(entry as Record<string, unknown>, plan));
}

function hydrateJsonObject(
  value: Record<string, unknown>,
  plan: LoadNode,
): Record<string, unknown> {
  const mapped = mapRow<Record<string, unknown>>(value, plan.model);

  for (const child of plan.children) {
    const relation = child.relation!;
    mapped[relation.name] = hydrateRelationValue(value[relation.name], child, relation.unique);
  }

  return mapped;
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
