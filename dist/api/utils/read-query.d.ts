import type { FilterFieldMeta } from './list-query.js';
import { buildListQuery } from './list-query.js';
import type { IncludeInput } from '../../db/include/types.js';
import type { IncludableRelationTree } from './include-query.js';
export interface ReadQueryResult {
    where: ReturnType<typeof buildListQuery>['where'];
    orderBy?: ReturnType<typeof buildListQuery>['orderBy'];
    take?: number;
    skip?: number;
    include?: IncludeInput;
}
export declare function buildReadQuery(query: Record<string, unknown>, fields: readonly FilterFieldMeta[], sortableFields: readonly string[], includableRelations: IncludableRelationTree): ReadQueryResult;
