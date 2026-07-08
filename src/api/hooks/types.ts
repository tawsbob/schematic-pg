import type { Context } from 'hono';
import type { DbClient } from 'generated/db.js';
import type { AuthContext } from '../auth/types.js';
import type { AppEnv } from '../types.js';

export type HookOperation = 'create' | 'update' | 'delete';

export interface HookContextBase {
  model: string;
  operation: HookOperation;
  auth: AuthContext;
  params?: Record<string, unknown>;
  db: DbClient;
  c: Context<AppEnv>;
  abort: (status: number, message: string) => Response;
  json: (body: unknown, status?: number) => Response;
}

export interface BeforeHookContext<TData = Record<string, unknown>> extends HookContextBase {
  data: TData;
  result?: unknown;
}

export interface AfterHookContext<TRow = Record<string, unknown>> extends HookContextBase {
  result: TRow;
}

export type BeforeHookNext = () => Promise<BeforeHookResult>;

export type BeforeHook = (
  ctx: BeforeHookContext,
  next: BeforeHookNext,
) => Promise<Response | void>;

export type AfterHook = (ctx: AfterHookContext) => Promise<void>;

export interface ModelHooks {
  beforeCreate?: BeforeHook | BeforeHook[];
  afterCreate?: AfterHook | AfterHook[];
  beforeUpdate?: BeforeHook | BeforeHook[];
  afterUpdate?: AfterHook | AfterHook[];
  beforeDelete?: BeforeHook | BeforeHook[];
  afterDelete?: AfterHook | AfterHook[];
}

export type HookRegistry = Record<string, ModelHooks>;

export interface BeforeHookResult {
  proceed: boolean;
  response?: Response;
}

export interface CreateHookContextInput {
  c: Context<AppEnv>;
  db: DbClient;
  auth: AuthContext;
  model: string;
  operation: HookOperation;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  result?: unknown;
}
