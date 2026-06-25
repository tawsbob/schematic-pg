import { buildListQuery } from './list-query.js';
import { parseIncludeQuery } from './include-query.js';
export function buildReadQuery(query, fields, sortableFields, includableRelations) {
    const { where, orderBy, take, skip } = buildListQuery(query, fields, sortableFields);
    const result = { where, orderBy, take, skip };
    if (typeof query.include === 'string' && query.include.length > 0) {
        result.include = parseIncludeQuery(query.include, includableRelations);
    }
    return result;
}
