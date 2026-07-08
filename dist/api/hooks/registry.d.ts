import type { Context } from 'hono';
import type { AppEnv } from '../types.js';
import type { AfterHookContext, BeforeHookContext, BeforeHookResult, CreateHookContextInput, HookOperation, HookRegistry } from './types.js';
export declare function configureHooks(next: HookRegistry): void;
export declare function createHookContext(init: CreateHookContextInput): BeforeHookContext;
export declare function cancelledResponse(c: Context<AppEnv>): Response;
export declare function runBeforeHooks(model: string, operation: HookOperation, ctx: BeforeHookContext): Promise<BeforeHookResult>;
export declare function runAfterHooks(model: string, operation: HookOperation, ctx: AfterHookContext): Promise<void>;
