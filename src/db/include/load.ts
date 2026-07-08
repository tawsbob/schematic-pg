import type { QueryResultRow } from 'pg';
import { mapPgError } from '../errors.js';
import type { ModelMeta } from '../model-meta.js';
import type { FindArgs } from '../query-builder.js';
import { QueryBuilder } from '../query-builder.js';
import type { Queryable } from '../queryable.js';
import { mapRows } from '../row-mapper.js';
import { loadIncludes } from './executor.js';
import { fetchRootWithJsonAgg } from './json-agg.js';
import { buildLoadPlan } from './planner.js';
import type { IncludeInput, IncludeOptions } from './types.js';

export async function fetchWithIncludes<T extends Record<string, unknown>>(
  model: ModelMeta,
  registry: Map<string, ModelMeta>,
  executor: Queryable,
  rootArgs: FindArgs & { include?: IncludeInput },
  options: IncludeOptions = {},
): Promise<T[]> {
  if (!rootArgs.include) {
    throw new Error('fetchWithIncludes requires include');
  }

  const plan = buildLoadPlan(model, rootArgs.include, registry, options);
  plan.where = rootArgs.where;
  plan.orderBy = rootArgs.orderBy;
  plan.take = rootArgs.take;
  plan.skip = rootArgs.skip;

  if (plan.strategy === 'join') {
    return fetchRootWithJsonAgg<T>(model, plan, rootArgs, executor);
  }

  const rows = await executeRootSelect(model, executor, rootArgs);
  const mapped = mapRows<T>(rows, model);
  await loadIncludes(mapped, plan, executor);
  return mapped;
}

export async function attachIncludes<T extends Record<string, unknown>>(
  model: ModelMeta,
  registry: Map<string, ModelMeta>,
  executor: Queryable,
  rootRows: T[],
  include: IncludeInput,
  rootArgs: FindArgs,
  options: IncludeOptions = {},
): Promise<T[]> {
  if (rootRows.length === 0) {
    return rootRows;
  }

  const plan = buildLoadPlan(model, include, registry, options);
  plan.where = rootArgs.where;
  plan.orderBy = rootArgs.orderBy;
  plan.take = rootArgs.take;
  plan.skip = rootArgs.skip;

  await loadIncludes(rootRows, plan, executor);
  return rootRows;
}

async function executeRootSelect(
  model: ModelMeta,
  executor: Queryable,
  args: FindArgs,
): Promise<QueryResultRow[]> {
  const builder = new QueryBuilder(model);
  const query = builder.select(args);

  try {
    const result = await executor.query<QueryResultRow>(query.sql, query.params);
    return result.rows;
  } catch (error) {
    throw mapPgError(error, model.name, model.columnToField);
  }
}
