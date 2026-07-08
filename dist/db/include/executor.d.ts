import type { Queryable } from '../queryable.js';
import type { LoadNode } from './planner.js';
export declare function loadIncludes(parentRows: Record<string, unknown>[], plan: LoadNode, executor: Queryable): Promise<void>;
