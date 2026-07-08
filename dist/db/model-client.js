import { mapPgError } from './errors.js';
import { fetchWithIncludes } from './include/load.js';
import { QueryBuilder } from './query-builder.js';
import { mapRow, mapRows } from './row-mapper.js';
export function createModelClient(model, executor, registry) {
    const builder = new QueryBuilder(model);
    async function execute(sql, params) {
        try {
            const result = await executor.query(sql, params);
            return result.rows;
        }
        catch (error) {
            throw mapPgError(error, model.name, model.columnToField);
        }
    }
    async function selectRows(args = {}) {
        const findArgs = toFindArgs(args);
        if (args.include && registry) {
            return fetchWithIncludes(model, registry, executor, {
                ...findArgs,
                include: args.include,
            }, {
                relationLoadStrategy: args.relationLoadStrategy,
            });
        }
        const query = builder.select(findArgs);
        const rows = await execute(query.sql, query.params);
        return mapRows(rows, model);
    }
    return {
        async create(data) {
            const query = builder.insert(data);
            const rows = await execute(query.sql, query.params);
            return mapRow(rows[0], model);
        },
        async findUnique(where, args = {}) {
            const rows = await selectRows({
                ...args,
                where: where,
                take: 1,
            });
            return rows[0] ?? null;
        },
        async findFirst(args = {}) {
            const rows = await selectRows({ ...args, take: 1 });
            return rows[0] ?? null;
        },
        async findMany(args = {}) {
            return selectRows(args);
        },
        async count(args) {
            const query = builder.count({ where: args?.where });
            const rows = await execute(query.sql, query.params);
            return rows[0]?.count ?? 0;
        },
        async update(args) {
            const query = builder.update({
                where: args.where,
                data: args.data,
            });
            const rows = await execute(query.sql, query.params);
            if (!rows[0]) {
                throw new Error(`Update returned no rows for model ${model.name}`);
            }
            return mapRow(rows[0], model);
        },
        async updateMany(args) {
            const query = builder.update({
                where: args.where,
                data: args.data,
            });
            const rows = await execute(query.sql, query.params);
            return { count: rows.length };
        },
        async delete(where) {
            const query = builder.delete({ where: where });
            const rows = await execute(query.sql, query.params);
            if (!rows[0]) {
                throw new Error(`Delete returned no rows for model ${model.name}`);
            }
            return mapRow(rows[0], model);
        },
        async deleteMany(args) {
            const query = builder.delete({ where: args?.where });
            const rows = await execute(query.sql, query.params);
            return { count: rows.length };
        },
    };
}
function toFindArgs(args) {
    return {
        where: args.where,
        orderBy: args.orderBy,
        take: args.take,
        skip: args.skip,
    };
}
