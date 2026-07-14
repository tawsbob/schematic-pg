import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Hono } from 'hono';
import { Pool } from 'pg';
import {
  assertDockerPostgres,
  assertGeneratedArtifacts,
  resetBootstrapAndSeed,
  TEST_JWT_SECRET,
} from '../../__tests__/helpers/integration.js';
import { signHs256Jwt } from '../auth/jwt-crypto.js';
import { createApp } from '../../../generated/app.js';
import type { AppEnv } from '../types.js';

const TEST_AUTH_PEPPER = 'integration-test-pepper';

interface RequestOptions {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
}

async function request(
  app: Hono<AppEnv>,
  path: string,
  { method = 'GET', token, body }: RequestOptions = {},
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Auth integration (register / login)', { concurrency: 1 }, () => {
  let pool: Pool;
  let app: Hono<AppEnv>;

  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.AUTH_PEPPER = TEST_AUTH_PEPPER;

    assertGeneratedArtifacts();

    pool = await assertDockerPostgres();
    await resetBootstrapAndSeed(pool);
    app = createApp({ pool });
  });

  after(async () => {
    await pool.end();
  });

  it('register → login → authenticated /auth/me and protected GET /users', async () => {
    const email = `auth-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const registerResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Auth User' },
    });

    assert.equal(registerResponse.status, 201);
    const registered = (await registerResponse.json()) as {
      token: string;
      user: { id: string; email: string; passwordHash?: string };
    };

    assert.ok(registered.token);
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.passwordHash, undefined);

    const loginResponse = await request(app, '/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    assert.equal(loginResponse.status, 200);
    const loggedIn = (await loginResponse.json()) as {
      token: string;
      user: { id: string; passwordHash?: string };
    };

    assert.ok(loggedIn.token);
    assert.equal(loggedIn.user.passwordHash, undefined);

    const meResponse = await request(app, '/auth/me', { token: loggedIn.token });
    assert.equal(meResponse.status, 200);
    const me = (await meResponse.json()) as { role: string; user?: { id: string } };
    assert.equal(me.role, 'USER');
    assert.equal(me.user?.id, loggedIn.user.id);

    const usersResponse = await request(app, '/users', { token: loggedIn.token });
    assert.equal(usersResponse.status, 200);
  });

  it('rejects wrong password with 401', async () => {
    const email = `auth-wrong-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const registerResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Wrong Pass' },
    });
    assert.equal(registerResponse.status, 201);

    const loginResponse = await request(app, '/auth/login', {
      method: 'POST',
      body: { email, password: 'not-the-password' },
    });

    assert.equal(loginResponse.status, 401);
    const body = (await loginResponse.json()) as { error: string };
    assert.equal(body.error, 'Invalid email or password');
  });

  it('rejects duplicate email with 409', async () => {
    const email = `auth-dup-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const first = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Dup One' },
    });
    assert.equal(first.status, 201);

    const second = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Dup Two' },
    });
    assert.equal(second.status, 409);
  });

  it('rejects expired access tokens with 401', async () => {
    const email = `auth-exp-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const registerResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Expired' },
    });
    assert.equal(registerResponse.status, 201);
    const registered = (await registerResponse.json()) as { user: { id: string } };

    const expiredToken = signHs256Jwt(
      {
        sub: registered.user.id,
        role: 'USER',
        iat: Math.floor(Date.now() / 1000) - 120,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      TEST_JWT_SECRET,
    );

    const meResponse = await request(app, '/auth/me', { token: expiredToken });
    assert.equal(meResponse.status, 401);
  });
});
