import type { ModelMeta } from '../model-meta.js';
import type { FindArgs } from '../query-builder.js';
import type { Queryable } from '../queryable.js';
import type { LoadNode } from './planner.js';
export declare function fetchRootWithJsonAgg<T extends Record<string, unknown>>(model: ModelMeta, plan: LoadNode, args: FindArgs, executor: Queryable): Promise<T[]>;
