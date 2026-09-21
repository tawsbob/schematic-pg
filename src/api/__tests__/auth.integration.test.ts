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
  cookie?: string;
  origin?: string;
}

async function request(
  app: Hono<AppEnv>,
  path: string,
  { method = 'GET', token, body, cookie, origin }: RequestOptions = {},
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function getSetCookieValues(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function parseRefreshCookie(response: Response): string | null {
  for (const header of getSetCookieValues(response)) {
    const match = /(?:^|,\s*)refresh_token=([^;]+)/.exec(header);
    if (match?.[1] && match[1] !== '') {
      return match[1];
    }
  }
  return null;
}

function assertHttpOnlyRefreshCookie(response: Response): string {
  const cookies = getSetCookieValues(response);
  assert.ok(cookies.length > 0, 'expected Set-Cookie header');
  const refreshHeader = cookies.find((value) => /refresh_token=/.test(value));
  assert.ok(refreshHeader, 'expected refresh_token cookie');
  assert.match(refreshHeader!, /HttpOnly/i);
  assert.match(refreshHeader!, /Path=\/auth/i);
  const raw = parseRefreshCookie(response);
  assert.ok(raw);
  return raw!;
}

describe('Auth integration (register / login / refresh)', { concurrency: 1 }, () => {
  let pool: Pool;
  let app: Hono<AppEnv>;

  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.AUTH_PEPPER = TEST_AUTH_PEPPER;
    process.env.AUTH_COOKIE_SECURE = 'false';
    process.env.AUTH_COOKIE_SAMESITE = 'Lax';
    // Integration reuse test exercises family revoke without waiting the default 10s grace.
    process.env.AUTH_REFRESH_REUSE_GRACE_SECONDS = '0';
    delete process.env.CORS_ORIGIN;

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
      expiresIn: number;
      user: { id: string; email: string; passwordHash?: string };
      refreshToken?: string;
      refresh_token?: string;
    };

    assert.ok(registered.token);
    assert.equal(typeof registered.expiresIn, 'number');
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.passwordHash, undefined);
    assert.equal(registered.refreshToken, undefined);
    assert.equal(registered.refresh_token, undefined);
    assertHttpOnlyRefreshCookie(registerResponse);

    const loginResponse = await request(app, '/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    assert.equal(loginResponse.status, 200);
    const loggedIn = (await loginResponse.json()) as {
      token: string;
      expiresIn: number;
      user: { id: string; passwordHash?: string };
      refreshToken?: string;
    };

    assert.ok(loggedIn.token);
    assert.equal(typeof loggedIn.expiresIn, 'number');
    assert.equal(loggedIn.user.passwordHash, undefined);
    assert.equal(loggedIn.refreshToken, undefined);
    assertHttpOnlyRefreshCookie(loginResponse);

    const meResponse = await request(app, '/auth/me', { token: loggedIn.token });
    assert.equal(meResponse.status, 200);
    const me = (await meResponse.json()) as { role: string; user?: { id: string } };
    assert.equal(me.role, 'USER');
    assert.equal(me.user?.id, loggedIn.user.id);

    const usersResponse = await request(app, '/users', { token: loggedIn.token });
    assert.equal(usersResponse.status, 200);
  });

  it('refresh rotates the cookie and returns a new access token', async () => {
    const email = `auth-refresh-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const loginResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Refresh User' },
    });
    assert.equal(loginResponse.status, 201);
    const firstCookie = assertHttpOnlyRefreshCookie(loginResponse);
    await loginResponse.json();

    const refreshResponse = await request(app, '/auth/refresh', {
      method: 'POST',
      cookie: `refresh_token=${firstCookie}`,
    });
    assert.equal(refreshResponse.status, 200);
    const refreshed = (await refreshResponse.json()) as {
      token: string;
      expiresIn: number;
      refreshToken?: string;
    };
    assert.ok(refreshed.token);
    assert.equal(typeof refreshed.expiresIn, 'number');
    assert.equal(refreshed.refreshToken, undefined);
    const secondCookie = assertHttpOnlyRefreshCookie(refreshResponse);
    assert.notEqual(secondCookie, firstCookie);

    const meResponse = await request(app, '/auth/me', { token: refreshed.token });
    assert.equal(meResponse.status, 200);

    const opaqueAsBearer = await request(app, '/auth/me', { token: firstCookie });
    assert.equal(opaqueAsBearer.status, 401);
  });

  it('rejects replay of a rotated refresh cookie after the grace window', async () => {
    const email = `auth-reuse-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const registerResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Reuse User' },
    });
    assert.equal(registerResponse.status, 201);
    const firstCookie = assertHttpOnlyRefreshCookie(registerResponse);
    await registerResponse.json();

    const firstRefresh = await request(app, '/auth/refresh', {
      method: 'POST',
      cookie: `refresh_token=${firstCookie}`,
    });
    assert.equal(firstRefresh.status, 200);
    const secondCookie = assertHttpOnlyRefreshCookie(firstRefresh);
    await firstRefresh.json();

    const replay = await request(app, '/auth/refresh', {
      method: 'POST',
      cookie: `refresh_token=${firstCookie}`,
    });
    assert.equal(replay.status, 401);
    const replayBody = (await replay.json()) as { error: string };
    assert.equal(replayBody.error, 'Invalid refresh token');

    const afterFamilyRevoke = await request(app, '/auth/refresh', {
      method: 'POST',
      cookie: `refresh_token=${secondCookie}`,
    });
    assert.equal(afterFamilyRevoke.status, 401);
  });

  it('logout clears the cookie and blocks later refresh', async () => {
    const email = `auth-logout-${Date.now()}@example.com`;
    const password = 'secure-password-1';

    const registerResponse = await request(app, '/auth/register', {
      method: 'POST',
      body: { email, password, name: 'Logout User' },
    });
    assert.equal(registerResponse.status, 201);
    const cookie = assertHttpOnlyRefreshCookie(registerResponse);
    await registerResponse.json();

    const logoutResponse = await request(app, '/auth/logout', {
      method: 'POST',
      cookie: `refresh_token=${cookie}`,
    });
    assert.equal(logoutResponse.status, 204);
    const cleared = getSetCookieValues(logoutResponse).join(';');
    assert.match(cleared, /refresh_token=/);
    assert.match(cleared, /Max-Age=0/i);

    const refreshResponse = await request(app, '/auth/refresh', {
      method: 'POST',
      cookie: `refresh_token=${cookie}`,
    });
    assert.equal(refreshResponse.status, 401);
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
