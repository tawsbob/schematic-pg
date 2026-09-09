// Run: npm test

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Hono } from 'hono';
import type { AppEnv } from '../../types.js';
import { createCorsMiddleware, parseCorsAllowHeaders, parseCorsOrigin } from '../cors.js';

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

async function requestWithOrigin(
  app: Hono<AppEnv>,
  path: string,
  init: RequestInit & { origin?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.origin) {
    headers.set('Origin', init.origin);
  }

  return app.request(path, { ...init, headers });
}

describe('parseCorsOrigin', () => {
  it('returns null when unset, empty, or whitespace', () => {
    assert.equal(parseCorsOrigin(undefined), null);
    assert.equal(parseCorsOrigin(''), null);
    assert.equal(parseCorsOrigin('   '), null);
    assert.equal(parseCorsOrigin(', ,'), null);
  });

  it('returns * for wildcard', () => {
    assert.equal(parseCorsOrigin('*'), '*');
    assert.equal(parseCorsOrigin(' * '), '*');
  });

  it('returns a single origin or a trimmed list', () => {
    assert.equal(parseCorsOrigin('http://localhost:5173'), 'http://localhost:5173');
    assert.equal(parseCorsOrigin(' http://localhost:5173 '), 'http://localhost:5173');
    assert.equal(parseCorsOrigin('http://localhost:5173,'), 'http://localhost:5173');
    assert.deepEqual(parseCorsOrigin('http://localhost:5173,https://app.example.com'), [
      'http://localhost:5173',
      'https://app.example.com',
    ]);
    assert.deepEqual(parseCorsOrigin(' http://a.test , https://b.test '), [
      'http://a.test',
      'https://b.test',
    ]);
  });

  it('reads CORS_ORIGIN from the environment by default', () => {
    const previous = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:5173,https://app.example.com';

    try {
      assert.deepEqual(parseCorsOrigin(), ['http://localhost:5173', 'https://app.example.com']);
    } finally {
      restoreEnv('CORS_ORIGIN', previous);
    }
  });
});

describe('parseCorsAllowHeaders', () => {
  it('returns empty when unset, empty, or whitespace', () => {
    assert.deepEqual(parseCorsAllowHeaders(undefined), []);
    assert.deepEqual(parseCorsAllowHeaders(''), []);
    assert.deepEqual(parseCorsAllowHeaders('   '), []);
    assert.deepEqual(parseCorsAllowHeaders(', ,'), []);
  });

  it('returns a trimmed list', () => {
    assert.deepEqual(parseCorsAllowHeaders('X-Custom-Header'), ['X-Custom-Header']);
    assert.deepEqual(parseCorsAllowHeaders(' X-Foo , X-Bar '), ['X-Foo', 'X-Bar']);
  });

  it('reads CORS_ALLOW_HEADERS from the environment by default', () => {
    const previous = process.env.CORS_ALLOW_HEADERS;
    process.env.CORS_ALLOW_HEADERS = 'X-Foo,X-Bar';

    try {
      assert.deepEqual(parseCorsAllowHeaders(), ['X-Foo', 'X-Bar']);
    } finally {
      restoreEnv('CORS_ALLOW_HEADERS', previous);
    }
  });
});

describe('createCorsMiddleware', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  const originalCorsAllowHeaders = process.env.CORS_ALLOW_HEADERS;

  afterEach(() => {
    restoreEnv('CORS_ORIGIN', originalCorsOrigin);
    restoreEnv('CORS_ALLOW_HEADERS', originalCorsAllowHeaders);
  });

  it('does not add CORS headers when origin is disabled', async () => {
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware({ origin: null }));
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/health', { origin: 'http://localhost:5173' });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('does not add CORS headers when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN;
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware());
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/health', { origin: 'http://localhost:5173' });

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('echoes a matching origin, enables credentials, and answers preflight', async () => {
    const allowedOrigin = 'http://localhost:5173';
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware({ origin: allowedOrigin }));
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/health', { origin: allowedOrigin });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');

    const preflight = await requestWithOrigin(app, '/health', {
      method: 'OPTIONS',
      origin: allowedOrigin,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,x-csrf-token',
      },
    });

    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true');
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /Authorization/i);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /Content-Type/i);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /X-CSRF-Token/i);
    assert.match(preflight.headers.get('Access-Control-Allow-Methods') ?? '', /POST/);
  });

  it('returns credentials on a credentialed POST response', async () => {
    const allowedOrigin = 'http://localhost:3001';
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware({ origin: allowedOrigin }));
    app.post('/auth/refresh', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/auth/refresh', {
      method: 'POST',
      origin: allowedOrigin,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'test-token',
      },
      body: '{}',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  });

  it('allows any origin when CORS_ORIGIN is * without credentials', async () => {
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware({ origin: '*' }));
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/health', { origin: 'https://app.example.com' });

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  });

  it('allows listed origins and omits the header for others', async () => {
    const app = new Hono<AppEnv>();
    app.use(
      createCorsMiddleware({
        origin: ['http://localhost:5173', 'https://app.example.com'],
      }),
    );
    app.get('/health', (c) => c.json({ ok: true }));

    const allowed = await requestWithOrigin(app, '/health', { origin: 'https://app.example.com' });
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
    assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), 'true');

    const denied = await requestWithOrigin(app, '/health', { origin: 'https://evil.example' });
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('merges CORS_ALLOW_HEADERS extras into Allow-Headers', async () => {
    process.env.CORS_ALLOW_HEADERS = 'X-Custom-Header';
    const allowedOrigin = 'http://localhost:5173';
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware({ origin: allowedOrigin }));
    app.get('/health', (c) => c.json({ ok: true }));

    const preflight = await requestWithOrigin(app, '/health', {
      method: 'OPTIONS',
      origin: allowedOrigin,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-custom-header,authorization',
      },
    });

    const allowHeaders = preflight.headers.get('Access-Control-Allow-Headers') ?? '';
    assert.match(allowHeaders, /X-Custom-Header/i);
    assert.match(allowHeaders, /Authorization/i);
    assert.match(allowHeaders, /X-CSRF-Token/i);
  });

  it('uses options.allowHeaders instead of defaults and env extras', async () => {
    process.env.CORS_ALLOW_HEADERS = 'X-From-Env';
    const allowedOrigin = 'http://localhost:5173';
    const app = new Hono<AppEnv>();
    app.use(
      createCorsMiddleware({
        origin: allowedOrigin,
        allowHeaders: ['X-Only'],
      }),
    );
    app.get('/health', (c) => c.json({ ok: true }));

    const preflight = await requestWithOrigin(app, '/health', {
      method: 'OPTIONS',
      origin: allowedOrigin,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-only',
      },
    });

    const allowHeaders = preflight.headers.get('Access-Control-Allow-Headers') ?? '';
    assert.match(allowHeaders, /X-Only/i);
    assert.doesNotMatch(allowHeaders, /Authorization/i);
    assert.doesNotMatch(allowHeaders, /X-From-Env/i);
  });

  it('reads CORS_ORIGIN from the environment when no origin option is passed', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    const app = new Hono<AppEnv>();
    app.use(createCorsMiddleware());
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await requestWithOrigin(app, '/health', { origin: 'http://localhost:5173' });

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  });
});
