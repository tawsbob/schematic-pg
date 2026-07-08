// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import type { AppEnv } from '../../types.js';
import {
  cancelledResponse,
  configureHooks,
  createHookContext,
  runAfterHooks,
  runBeforeHooks,
} from '../registry.js';

const mockDb = {} as AppEnv['Variables']['db'];
const mockAuth = { role: 'USER', user: { id: 'user-1' } };

async function createMockContext() {
  const app = new Hono<AppEnv>();
  let capturedContext: Parameters<typeof createHookContext>[0]['c'] | undefined;

  app.post('/test', async (c) => {
    capturedContext = c;
    return c.json({ ok: true });
  });

  await app.request('/test', { method: 'POST' });
  if (!capturedContext) {
    throw new Error('Failed to create mock Hono context');
  }

  return capturedContext;
}

async function createTestHookContext(data: Record<string, unknown> = { email: 'test@example.com' }) {
  return createHookContext({
    c: await createMockContext(),
    db: mockDb,
    auth: mockAuth,
    model: 'User',
    operation: 'create',
    data,
  });
}

describe('runBeforeHooks', () => {
  it('proceeds when no hooks are configured', async () => {
    configureHooks({});

    const result = await runBeforeHooks('User', 'create', await createTestHookContext());

    assert.equal(result.proceed, true);
    assert.equal(result.response, undefined);
  });

  it('proceeds when the hook calls next', async () => {
    configureHooks({
      User: {
        beforeCreate: async (_ctx, next) => {
          await next();
        },
      },
    });

    const result = await runBeforeHooks('User', 'create', await createTestHookContext());

    assert.equal(result.proceed, true);
  });

  it('cancels with a response when the hook returns abort', async () => {
    configureHooks({
      User: {
        beforeCreate: async (ctx) => ctx.abort(422, 'invalid payload'),
      },
    });

    const result = await runBeforeHooks('User', 'create', await createTestHookContext());

    assert.equal(result.proceed, false);
    assert.equal(result.response?.status, 422);
    assert.deepEqual(await result.response!.json(), { error: 'invalid payload' });
  });

  it('cancels without a response when the hook does not call next', async () => {
    configureHooks({
      User: {
        beforeCreate: async () => undefined,
      },
    });

    const result = await runBeforeHooks('User', 'create', await createTestHookContext());

    assert.equal(result.proceed, false);
    assert.equal(result.response, undefined);
  });

  it('allows payload mutation before the operation continues', async () => {
    configureHooks({
      User: {
        beforeCreate: async (ctx, next) => {
          ctx.data.email = 'changed@example.com';
          await next();
        },
      },
    });

    const ctx = await createTestHookContext();
    const result = await runBeforeHooks('User', 'create', ctx);

    assert.equal(result.proceed, true);
    assert.equal(ctx.data.email, 'changed@example.com');
  });

  it('chains multiple before hooks in order', async () => {
    const order: number[] = [];

    configureHooks({
      User: {
        beforeCreate: [
          async (_ctx, next) => {
            order.push(1);
            await next();
          },
          async (_ctx, next) => {
            order.push(2);
            await next();
          },
        ],
      },
    });

    const result = await runBeforeHooks('User', 'create', await createTestHookContext());

    assert.equal(result.proceed, true);
    assert.deepEqual(order, [1, 2]);
  });

  it('throws when next is called more than once', async () => {
    configureHooks({
      User: {
        beforeCreate: async (_ctx, next) => {
          await next();
          await next();
        },
      },
    });

    const ctx = await createTestHookContext();
    await assert.rejects(
      () => runBeforeHooks('User', 'create', ctx),
      /next\(\) called multiple times/,
    );
  });
});

describe('runAfterHooks', () => {
  it('mutates the result after the operation', async () => {
    configureHooks({
      User: {
        afterCreate: async (ctx) => {
          ctx.result = { ...(ctx.result as Record<string, unknown>), transformed: true };
        },
      },
    });

    const ctx = createHookContext({
      c: await createMockContext(),
      db: mockDb,
      auth: mockAuth,
      model: 'User',
      operation: 'create',
      result: { id: '1', email: 'test@example.com' },
    });

    await runAfterHooks('User', 'create', ctx);

    assert.deepEqual(ctx.result, { id: '1', email: 'test@example.com', transformed: true });
  });
});

describe('cancelledResponse', () => {
  it('returns the default cancelled response', async () => {
    const response = cancelledResponse(await createMockContext());

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Operation cancelled by lifecycle hook' });
  });
});
