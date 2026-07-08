import { mapPgError } from '../errors.js';
import { QueryBuilder } from '../query-builder.js';
import { mapRows } from '../row-mapper.js';
import { loadIncludes } from './executor.js';
import { fetchRootWithJsonAgg } from './json-agg.js';
import { buildLoadPlan } from './planner.js';
export async function fetchWithIncludes(model, registry, executor, rootArgs, options = {}) {
    if (!rootArgs.include) {
        throw new Error('fetchWithIncludes requires include');
    }
    const plan = buildLoadPlan(model, rootArgs.include, registry, options);
    plan.where = rootArgs.where;
    plan.orderBy = rootArgs.orderBy;
    plan.take = rootArgs.take;
    plan.skip = rootArgs.skip;
    if (plan.strategy === 'join') {
        return fetchRootWithJsonAgg(model, plan, rootArgs, executor);
    }
    const rows = await executeRootSelect(model, executor, rootArgs);
    const mapped = mapRows(rows, model);
    await loadIncludes(mapped, plan, executor);
    return mapped;
}
export async function attachIncludes(model, registry, executor, rootRows, include, rootArgs, options = {}) {
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
async function executeRootSelect(model, executor, args) {
    const builder = new QueryBuilder(model);
    const query = builder.select(args);
    try {
        const result = await executor.query(query.sql, query.params);
        return result.rows;
    }
    catch (error) {
        throw mapPgError(error, model.name, model.columnToField);
    }
}
