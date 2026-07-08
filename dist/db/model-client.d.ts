import type { IncludeInput, IncludeOptions } from './include/types.js';
import type { ModelMeta } from './model-meta.js';
import type { Queryable } from './queryable.js';
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
    findUnique(where: Record<string, unknown>, args?: Omit<SelectArgs<TWhere, TOrderBy>, 'where'>): Promise<T | null>;
    findFirst(args?: SelectArgs<TWhere, TOrderBy>): Promise<T | null>;
    findMany(args?: SelectArgs<TWhere, TOrderBy>): Promise<T[]>;
    count(args?: {
        where?: TWhere;
    }): Promise<number>;
    update(args: {
        where: Record<string, unknown>;
        data: TUpdate;
    }): Promise<T>;
    updateMany(args: {
        where?: TWhere;
        data: TUpdate;
    }): Promise<{
        count: number;
    }>;
    delete(where: Record<string, unknown>): Promise<T>;
    deleteMany(args?: {
        where?: TWhere;
    }): Promise<{
        count: number;
    }>;
}
export declare function createModelClient<T, TCreate, TUpdate, TWhere, TOrderBy>(model: ModelMeta, executor: Queryable, registry?: ModelRegistry): ModelClient<T, TCreate, TUpdate, TWhere, TOrderBy>;
