import { mapPgError } from './errors.js';
/**
 * Label used when surfacing raw-query errors. A raw query has no single owning
 * model, so error mapping runs without a `column -> field` translation map.
 */
const RAW_QUERY_LABEL = '$queryRaw';
const EMPTY_COLUMN_TO_FIELD = new Map();
const NO_PARAMS = [];
/** Maps a driver error to the project's typed `DatabaseError` subclasses. */
function wrapRawError(error) {
    return mapPgError(error, RAW_QUERY_LABEL, EMPTY_COLUMN_TO_FIELD);
}
/** Builds the parameterized raw-query escape hatch bound to a single executor. */
export function createRawClient(executor) {
    return {
        async $queryRaw(sql, params = NO_PARAMS) {
            try {
                const result = await executor.query(sql, params);
                return result.rows;
            }
            catch (error) {
                throw wrapRawError(error);
            }
        },
        async $executeRaw(sql, params = NO_PARAMS) {
            try {
                const result = await executor.query(sql, params);
                return result.rowCount ?? 0;
            }
            catch (error) {
                throw wrapRawError(error);
            }
        },
    };
}
