import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../types.js';
import type {
  AfterHookContext,
  BeforeHook,
  BeforeHookContext,
  BeforeHookResult,
  CreateHookContextInput,
  HookOperation,
  HookRegistry,
} from './types.js';

const HOOK_CANCELLED_STATUS = 409;
const HOOK_CANCELLED_MESSAGE = 'Operation cancelled by lifecycle hook';

const BEFORE_HOOK_KEYS: Record<HookOperation, 'beforeCreate' | 'beforeUpdate' | 'beforeDelete'> = {
  create: 'beforeCreate',
  update: 'beforeUpdate',
  delete: 'beforeDelete',
};

const AFTER_HOOK_KEYS: Record<HookOperation, 'afterCreate' | 'afterUpdate' | 'afterDelete'> = {
  create: 'afterCreate',
  update: 'afterUpdate',
  delete: 'afterDelete',
};

let hooks: HookRegistry = {};

export function configureHooks(next: HookRegistry): void {
  hooks = next;
}

export function createHookContext(init: CreateHookContextInput): BeforeHookContext {
  return {
    model: init.model,
    operation: init.operation,
    auth: init.auth,
    params: init.params,
    db: init.db,
    c: init.c,
    data: init.data ?? {},
    result: init.result,
    abort(status: number, message: string) {
      return init.c.json({ error: message }, status as ContentfulStatusCode);
    },
    json(body: unknown, status = 200) {
      return init.c.json(body, status as ContentfulStatusCode);
    },
  };
}

export function cancelledResponse(c: Context<AppEnv>): Response {
  return c.json({ error: HOOK_CANCELLED_MESSAGE }, HOOK_CANCELLED_STATUS as ContentfulStatusCode);
}

export async function runBeforeHooks(
  model: string,
  operation: HookOperation,
  ctx: BeforeHookContext,
): Promise<BeforeHookResult> {
  const modelHooks = hooks[model];
  if (!modelHooks) {
    return { proceed: true };
  }

  const hookDef = modelHooks[BEFORE_HOOK_KEYS[operation]];
  if (!hookDef) {
    return { proceed: true };
  }

  const hookList = normalizeHookList(hookDef);
  let index = -1;

  return dispatchBeforeHooks(hookList, ctx, 0, () => index, (nextIndex) => {
    index = nextIndex;
  });
}

export async function runAfterHooks(
  model: string,
  operation: HookOperation,
  ctx: AfterHookContext,
): Promise<void> {
  const modelHooks = hooks[model];
  if (!modelHooks) {
    return;
  }

  const hookDef = modelHooks[AFTER_HOOK_KEYS[operation]];
  if (!hookDef) {
    return;
  }

  const hookList = normalizeHookList(hookDef);
  for (const hook of hookList) {
    await hook(ctx);
  }
}

function normalizeHookList<T>(hookDef: T | T[]): T[] {
  return Array.isArray(hookDef) ? hookDef : [hookDef];
}

async function dispatchBeforeHooks(
  hookList: BeforeHook[],
  ctx: BeforeHookContext,
  currentIndex: number,
  getDispatchedIndex: () => number,
  setDispatchedIndex: (nextIndex: number) => void,
): Promise<BeforeHookResult> {
  if (currentIndex <= getDispatchedIndex()) {
    throw new Error('next() called multiple times');
  }

  setDispatchedIndex(currentIndex);

  if (currentIndex === hookList.length) {
    return { proceed: true };
  }

  const hook = hookList[currentIndex]!;
  let innerResult: BeforeHookResult = { proceed: false };
  let nextCalled = false;

  const next = async (): Promise<BeforeHookResult> => {
    nextCalled = true;
    innerResult = await dispatchBeforeHooks(
      hookList,
      ctx,
      currentIndex + 1,
      getDispatchedIndex,
      setDispatchedIndex,
    );
    return innerResult;
  };

  const result = await hook(ctx, next);

  if (result instanceof Response) {
    return { proceed: false, response: result };
  }

  if (!nextCalled) {
    return { proceed: false };
  }

  return innerResult;
}
