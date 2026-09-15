// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { z } from 'zod';
import { formatValidationError, validateJson, validateParam, validateQuery } from '../validate.js';

describe('formatValidationError', () => {
  it('prefixes the field path in the summary and lists all issues', () => {
    const body = formatValidationError([
      { path: ['email'], message: 'Invalid input: expected string, received number' },
      { path: ['name'], message: 'Too small: expected string to have >= 1 characters' },
    ]);

    assert.deepEqual(body, {
      error: 'email: Invalid input: expected string, received number',
      issues: [
        { path: 'email', message: 'Invalid input: expected string, received number' },
        { path: 'name', message: 'Too small: expected string to have >= 1 characters' },
      ],
    });
  });

  it('joins nested paths with dots', () => {
    const body = formatValidationError([{ path: ['items', 0, 'name'], message: 'Required' }]);

    assert.equal(body.error, 'items.0.name: Required');
    assert.equal(body.issues[0]?.path, 'items.0.name');
  });

  it('omits the path prefix for root-level issues', () => {
    const body = formatValidationError([
      { path: [], message: 'Invalid input: expected object, received array' },
    ]);

    assert.deepEqual(body, {
      error: 'Invalid input: expected object, received array',
      issues: [{ path: '', message: 'Invalid input: expected object, received array' }],
    });
  });

  it('falls back when there are no issues', () => {
    assert.deepEqual(formatValidationError([]), {
      error: 'Validation failed',
      issues: [],
    });
  });
});

describe('validateJson', () => {
  it('returns the failing field path and message', async () => {
    const app = new Hono();
    app.post(
      '/items',
      validateJson(z.object({ email: z.string(), age: z.number() })),
      (c) => c.json({ ok: true }),
    );

    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 123, age: 1 }),
    });
    const body = (await response.json()) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };

    assert.equal(response.status, 400);
    assert.equal(body.issues.length, 1);
    assert.equal(body.issues[0]?.path, 'email');
    assert.match(body.issues[0]?.message ?? '', /expected string/i);
    assert.match(body.error, /^email:/);
  });

  it('returns every invalid field', async () => {
    const app = new Hono();
    app.post(
      '/items',
      validateJson(z.object({ email: z.string(), age: z.number() })),
      (c) => c.json({ ok: true }),
    );

    const response = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 123, age: 'x' }),
    });
    const body = (await response.json()) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };
    const paths = body.issues.map((issue) => issue.path).sort();

    assert.equal(response.status, 400);
    assert.deepEqual(paths, ['age', 'email']);
  });
});

describe('validateParam', () => {
  it('includes the param name in the error', async () => {
    const app = new Hono();
    app.get('/items/:id', validateParam(z.object({ id: z.uuid() })), (c) => c.json({ ok: true }));

    const response = await app.request('/items/not-a-uuid');
    const body = (await response.json()) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };

    assert.equal(response.status, 400);
    assert.equal(body.issues[0]?.path, 'id');
    assert.match(body.error, /^id:/);
  });
});

describe('validateQuery', () => {
  it('includes the query param name in the error', async () => {
    const app = new Hono();
    app.get('/items', validateQuery(z.object({ limit: z.coerce.number().int() })), (c) =>
      c.json({ ok: true }),
    );

    const response = await app.request('/items?limit=abc');
    const body = (await response.json()) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };

    assert.equal(response.status, 400);
    assert.equal(body.issues[0]?.path, 'limit');
    assert.match(body.error, /^limit:/);
  });
});
