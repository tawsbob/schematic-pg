import type { QueryResultRow } from 'pg';
import { mapPgError } from './errors.js';
import { fetchWithIncludes } from './include/load.js';
import type { IncludeInput, IncludeOptions } from './include/types.js';
import type { ModelMeta } from './model-meta.js';
import { QueryBuilder, type FindArgs } from './query-builder.js';
import type { Queryable } from './queryable.js';
import { mapRow, mapRows } from './row-mapper.js';
import type { WhereInput } from './where-translator.js';

export type ModelRegistry = Map<string, ModelMeta>;

export interface SelectArgs<TWhere, TOrderBy> {
  where?: TWhere;
  orderBy?: TOrderBy | TOrderBy[];
  take?: number;
  skip?: number;
  include?: IncludeInput;
  relationLoadStrategy?: IncludeOptions['relationLoadStrategy'];
}

export interface ModelClient<T, TCreate, TUpdate, TWhere, TOrderBy> {
  create(data: TCreate): Promise<T>;
  findUnique(
    where: Record<string, unknown>,
    args?: Omit<SelectArgs<TWhere, TOrderBy>, 'where'>,
  ): Promise<T | null>;
  findFirst(args?: SelectArgs<TWhere, TOrderBy>): Promise<T | null>;
  findMany(args?: SelectArgs<TWhere, TOrderBy>): Promise<T[]>;
  count(args?: { where?: TWhere }): Promise<number>;
  update(args: { where: Record<string, unknown>; data: TUpdate }): Promise<T>;
  updateMany(args: { where?: TWhere; data: TUpdate }): Promise<{ count: number }>;
  delete(where: Record<string, unknown>): Promise<T>;
  deleteMany(args?: { where?: TWhere }): Promise<{ count: number }>;
}

export function createModelClient<T, TCreate, TUpdate, TWhere, TOrderBy>(
  model: ModelMeta,
  executor: Queryable,
  registry?: ModelRegistry,
): ModelClient<T, TCreate, TUpdate, TWhere, TOrderBy> {
  const builder = new QueryBuilder(model);

  async function execute<T extends QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
    try {
      const result = await executor.query<T>(sql, params);
      return result.rows;
    } catch (error) {
      throw mapPgError(error, model.name, model.columnToField);
    }
  }

  async function selectRows(args: SelectArgs<TWhere, TOrderBy> = {}): Promise<T[]> {
    const findArgs = toFindArgs(args);

    if (args.include && registry) {
      return fetchWithIncludes<T & Record<string, unknown>>(model, registry, executor, {
        ...findArgs,
        include: args.include,
      }, {
        relationLoadStrategy: args.relationLoadStrategy,
      }) as Promise<T[]>;
    }

    const query = builder.select(findArgs);
    const rows = await execute<QueryResultRow>(query.sql, query.params);
    return mapRows<T>(rows, model);
  }

  return {
    async create(data: TCreate): Promise<T> {
      const query = builder.insert(data as Record<string, unknown>);
      const rows = await execute<QueryResultRow>(query.sql, query.params);
      return mapRow<T>(rows[0]!, model);
    },

    async findUnique(
      where: Record<string, unknown>,
      args: Omit<SelectArgs<TWhere, TOrderBy>, 'where'> = {},
    ): Promise<T | null> {
      const rows = await selectRows({
        ...args,
        where: where as TWhere,
        take: 1,
      });
      return rows[0] ?? null;
    },

    async findFirst(args: SelectArgs<TWhere, TOrderBy> = {}): Promise<T | null> {
      const rows = await selectRows({ ...args, take: 1 });
      return rows[0] ?? null;
    },

    async findMany(args: SelectArgs<TWhere, TOrderBy> = {}): Promise<T[]> {
      return selectRows(args);
    },

    async count(args?: { where?: TWhere }): Promise<number> {
      const query = builder.count({ where: args?.where as WhereInput | undefined });
      const rows = await execute<{ count: number }>(query.sql, query.params);
      return rows[0]?.count ?? 0;
    },

    async update(args: { where: Record<string, unknown>; data: TUpdate }): Promise<T> {
      const query = builder.update({
        where: args.where as WhereInput,
        data: args.data as Record<string, unknown>,
      });
      const rows = await execute<QueryResultRow>(query.sql, query.params);
      if (!rows[0]) {
        throw new Error(`Update returned no rows for model ${model.name}`);
      }
      return mapRow<T>(rows[0], model);
    },

    async updateMany(args: { where?: TWhere; data: TUpdate }): Promise<{ count: number }> {
      const query = builder.update({
        where: args.where as WhereInput | undefined,
        data: args.data as Record<string, unknown>,
      });
      const rows = await execute<QueryResultRow>(query.sql, query.params);
      return { count: rows.length };
    },

    async delete(where: Record<string, unknown>): Promise<T> {
      const query = builder.delete({ where: where as WhereInput });
      const rows = await execute<QueryResultRow>(query.sql, query.params);
      if (!rows[0]) {
        throw new Error(`Delete returned no rows for model ${model.name}`);
      }
      return mapRow<T>(rows[0], model);
    },

    async deleteMany(args?: { where?: TWhere }): Promise<{ count: number }> {
      const query = builder.delete({ where: args?.where as WhereInput | undefined });
      const rows = await execute<QueryResultRow>(query.sql, query.params);
      return { count: rows.length };
    },
  };
}

function toFindArgs<TWhere, TOrderBy>(args: SelectArgs<TWhere, TOrderBy>): FindArgs {
  return {
    where: args.where as WhereInput | undefined,
    orderBy: args.orderBy as FindArgs['orderBy'],
    take: args.take,
    skip: args.skip,
  };
}
