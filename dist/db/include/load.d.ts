import type { ModelMeta } from '../model-meta.js';
import type { FindArgs } from '../query-builder.js';
import type { Queryable } from '../queryable.js';
import type { IncludeInput, IncludeOptions } from './types.js';
export declare function fetchWithIncludes<T extends Record<string, unknown>>(model: ModelMeta, registry: Map<string, ModelMeta>, executor: Queryable, rootArgs: FindArgs & {
    include?: IncludeInput;
}, options?: IncludeOptions): Promise<T[]>;
export declare function attachIncludes<T extends Record<string, unknown>>(model: ModelMeta, registry: Map<string, ModelMeta>, executor: Queryable, rootRows: T[], include: IncludeInput, rootArgs: FindArgs, options?: IncludeOptions): Promise<T[]>;
