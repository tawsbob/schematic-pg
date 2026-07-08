const HOOK_CANCELLED_STATUS = 409;
const HOOK_CANCELLED_MESSAGE = 'Operation cancelled by lifecycle hook';
const BEFORE_HOOK_KEYS = {
    create: 'beforeCreate',
    update: 'beforeUpdate',
    delete: 'beforeDelete',
};
const AFTER_HOOK_KEYS = {
    create: 'afterCreate',
    update: 'afterUpdate',
    delete: 'afterDelete',
};
let hooks = {};
export function configureHooks(next) {
    hooks = next;
}
export function createHookContext(init) {
    return {
        model: init.model,
        operation: init.operation,
        auth: init.auth,
        params: init.params,
        db: init.db,
        c: init.c,
        data: init.data ?? {},
        result: init.result,
        abort(status, message) {
            return init.c.json({ error: message }, status);
        },
        json(body, status = 200) {
            return init.c.json(body, status);
        },
    };
}
export function cancelledResponse(c) {
    return c.json({ error: HOOK_CANCELLED_MESSAGE }, HOOK_CANCELLED_STATUS);
}
export async function runBeforeHooks(model, operation, ctx) {
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
export async function runAfterHooks(model, operation, ctx) {
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
function normalizeHookList(hookDef) {
    return Array.isArray(hookDef) ? hookDef : [hookDef];
}
async function dispatchBeforeHooks(hookList, ctx, currentIndex, getDispatchedIndex, setDispatchedIndex) {
    if (currentIndex <= getDispatchedIndex()) {
        throw new Error('next() called multiple times');
    }
    setDispatchedIndex(currentIndex);
    if (currentIndex === hookList.length) {
        return { proceed: true };
    }
    const hook = hookList[currentIndex];
    let innerResult = { proceed: false };
    let nextCalled = false;
    const next = async () => {
        nextCalled = true;
        innerResult = await dispatchBeforeHooks(hookList, ctx, currentIndex + 1, getDispatchedIndex, setDispatchedIndex);
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
