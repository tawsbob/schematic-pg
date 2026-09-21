import type { ModelMeta } from './model-meta.js';
import { type WhereInput } from './where-translator.js';
export interface FindArgs {
    where?: WhereInput;
    orderBy?: OrderByInput | OrderByInput[];
    take?: number;
    skip?: number;
}
export interface UpdateArgs {
    where?: WhereInput;
    data: Record<string, unknown>;
}
export interface DeleteArgs {
    where?: WhereInput;
}
export interface CountArgs {
    where?: WhereInput;
}
export type OrderByInput = Record<string, 'asc' | 'desc'>;
export interface SqlQuery {
    sql: string;
    params: unknown[];
}
export declare class QueryBuilder {
    private readonly model;
    constructor(model: ModelMeta);
    insert(data: Record<string, unknown>, where?: WhereInput): SqlQuery;
    select(args?: FindArgs): SqlQuery;
    update(args: UpdateArgs): SqlQuery;
    delete(args?: DeleteArgs): SqlQuery;
    count(args?: CountArgs): SqlQuery;
    private buildOrderBy;
}
