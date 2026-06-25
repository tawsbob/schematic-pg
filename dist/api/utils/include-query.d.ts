import type { IncludeInput } from '../../db/include/types.js';
export interface IncludableRelationTree {
    [relationName: string]: IncludableRelationTree;
}
export declare function validateIncludePaths(raw: string, tree: IncludableRelationTree): string | undefined;
export declare function parseIncludeQuery(raw: string, tree: IncludableRelationTree): IncludeInput;
