import type { AfterHook, BeforeHook, ModelHooks } from './types.js';
export interface TypedModelHooks<TRow, TCreate, TUpdate> {
    beforeCreate?: BeforeHook | BeforeHook[];
    afterCreate?: AfterHook | AfterHook[];
    beforeUpdate?: BeforeHook | BeforeHook[];
    afterUpdate?: AfterHook | AfterHook[];
    beforeDelete?: BeforeHook | BeforeHook[];
    afterDelete?: AfterHook | AfterHook[];
}
export declare function defineHooks<TRow, TCreate, TUpdate>(hooks: TypedModelHooks<TRow, TCreate, TUpdate>): ModelHooks;
