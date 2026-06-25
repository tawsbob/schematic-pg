import type { FilterFieldMeta } from './list-query.js';
import { buildListQuery } from './list-query.js';
import type { IncludeInput } from '../../db/include/types.js';
import type { IncludableRelationTree } from './include-query.js';
import { parseIncludeQuery } from './include-query.js';

export interface ReadQueryResult {
  where: ReturnType<typeof buildListQuery>['where'];
  orderBy?: ReturnType<typeof buildListQuery>['orderBy'];
  take?: number;
  skip?: number;
  include?: IncludeInput;
}

export function buildReadQuery(
  query: Record<string, unknown>,
  fields: readonly FilterFieldMeta[],
  sortableFields: readonly string[],
  includableRelations: IncludableRelationTree,
): ReadQueryResult {
  const { where, orderBy, take, skip } = buildListQuery(query, fields, sortableFields);

  const result: ReadQueryResult = { where, orderBy, take, skip };

  if (typeof query.include === 'string' && query.include.length > 0) {
    result.include = parseIncludeQuery(query.include, includableRelations);
  }

  return result;
}
