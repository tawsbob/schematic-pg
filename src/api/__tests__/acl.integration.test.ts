import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Hono } from 'hono';
import { Pool } from 'pg';
import {
  assertDockerPostgres,
  assertGeneratedArtifacts,
  resetBootstrapAndSeed,
  TEST_JWT_SECRET,
  type SeededUsers,
} from '../../__tests__/helpers/integration.js';
import {
  signInvalidTestJwt,
  signTestJwt,
  signTestJwtWithoutSub,
} from '../../__tests__/helpers/jwt.js';
import { createApp } from '../../../generated/app.js';
import { createDbClient } from '../../../generated/db.js';
import type { AppEnv } from '../types.js';

interface RequestOptions {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

async function request(
  app: Hono<AppEnv>,
  path: string,
  { method = 'GET', token, body, query }: RequestOptions = {},
): Promise<Response> {
  const url = query
    ? `${path}?${new URLSearchParams(query).toString()}`
    : path;

  return app.request(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('ACL integration (Docker + HTTP)', { concurrency: 1 }, () => {
  let pool: Pool;
  let app: Hono<AppEnv>;
  let users: SeededUsers;
  let aliceToken: string;
  let adminToken: string;

  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    assertGeneratedArtifacts();

    pool = await assertDockerPostgres();
    ({ users } = await resetBootstrapAndSeed(pool));
    app = createApp({ pool });

    aliceToken = signTestJwt({ sub: users.alice.id, role: 'USER' }, TEST_JWT_SECRET);
    adminToken = signTestJwt({ sub: users.admin.id, role: 'ADMIN' }, TEST_JWT_SECRET);
  });

  after(async () => {
    await pool.end();
  });

  describe('anonymous callers (PUBLIC role)', () => {
    it('denies GET /users', async () => {
      const response = await request(app, '/users');

      assert.equal(response.status, 403);
    });

    it('denies GET /users/:id', async () => {
      const response = await request(app, `/users/${users.alice.id}`);

      assert.equal(response.status, 403);
    });

    it('denies DELETE /users/:id', async () => {
      const response = await request(app, `/users/${users.alice.id}`, { method: 'DELETE' });

      assert.equal(response.status, 403);
    });
  });

  describe('USER role (row-scoped access)', () => {
    it('returns only own row on GET /users', async () => {
      const response = await request(app, '/users', { token: aliceToken });

      assert.equal(response.status, 200);
      const rows = (await response.json()) as Array<{ id: string }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.id, users.alice.id);
    });

    it('returns own row on GET /users/:id', async () => {
      const response = await request(app, `/users/${users.alice.id}`, { token: aliceToken });

      assert.equal(response.status, 200);
      const row = (await response.json()) as { id: string };
      assert.equal(row.id, users.alice.id);
    });

    it('returns 404 when accessing another user row', async () => {
      const response = await request(app, `/users/${users.bob.id}`, { token: aliceToken });

      assert.equal(response.status, 404);
    });

    it('denies DELETE on own row (operation not allowed)', async () => {
      const response = await request(app, `/users/${users.alice.id}`, {
        method: 'DELETE',
        token: aliceToken,
      });

      assert.equal(response.status, 403);
    });

    it('allows POST /users (insert without row filter)', async () => {
      const response = await request(app, '/users', {
        method: 'POST',
        token: aliceToken,
        body: {
          email: 'new-user@b.com',
          name: 'New User',
          balance: 0,
        },
      });

      assert.equal(response.status, 201);
    });

    it('allows PUT on own row', async () => {
      const response = await request(app, `/users/${users.alice.id}`, {
        method: 'PUT',
        token: aliceToken,
        body: { name: 'Alice Updated' },
      });

      assert.equal(response.status, 200);
      const row = (await response.json()) as { name: string };
      assert.equal(row.name, 'Alice Updated');
    });

    it('returns 404 on PUT for another user row', async () => {
      const response = await request(app, `/users/${users.bob.id}`, {
        method: 'PUT',
        token: aliceToken,
        body: { name: 'Blocked Update' },
      });

      assert.equal(response.status, 404);
    });
  });

  describe('ADMIN role (full access)', () => {
    it('returns all users on GET /users', async () => {
      const response = await request(app, '/users', { token: adminToken });

      assert.equal(response.status, 200);
      const rows = (await response.json()) as Array<{ id: string }>;
      assert.ok(rows.length >= 4);
    });

    it('returns any user on GET /users/:id', async () => {
      const response = await request(app, `/users/${users.bob.id}`, { token: adminToken });

      assert.equal(response.status, 200);
      const row = (await response.json()) as { id: string };
      assert.equal(row.id, users.bob.id);
    });

    it('allows DELETE on any user row', async () => {
      const response = await request(app, `/users/${users.publicUser.id}`, {
        method: 'DELETE',
        token: adminToken,
      });

      assert.equal(response.status, 200);
    });
  });

  describe('JWT authentication errors', () => {
    it('returns 401 for invalid JWT signature', async () => {
      const invalidToken = signInvalidTestJwt(
        { sub: users.alice.id, role: 'USER' },
        TEST_JWT_SECRET,
      );
      const response = await request(app, '/users', { token: invalidToken });

      assert.equal(response.status, 401);
    });

    it('returns 401 when JWT is missing sub claim', async () => {
      const tokenWithoutSub = signTestJwtWithoutSub('USER', TEST_JWT_SECRET);
      const response = await request(app, '/users', { token: tokenWithoutSub });

      assert.equal(response.status, 401);
    });
  });

  describe('models without @policy (open endpoints)', () => {
    it('allows GET /logs without authentication', async () => {
      const response = await request(app, '/logs');

      assert.equal(response.status, 200);
    });
  });

  describe('query filters and response omit', () => {
    it('omits passwordHash from GET /users/:id responses', async () => {
      const response = await request(app, `/users/${users.alice.id}`, { token: aliceToken });

      assert.equal(response.status, 200);
      const row = (await response.json()) as Record<string, unknown>;
      assert.equal('passwordHash' in row, false);
    });

    it('omits passwordHash from POST /users responses', async () => {
      const response = await request(app, '/users', {
        method: 'POST',
        token: aliceToken,
        body: {
          email: 'omit-test@b.com',
          name: 'Omit Test',
          balance: 0,
          passwordHash: 'secret-value',
        },
      });

      assert.equal(response.status, 201);
      const row = (await response.json()) as Record<string, unknown>;
      assert.equal('passwordHash' in row, false);
    });

    it('filters products by category query param', async () => {
      const createAlpha = await request(app, '/products', {
        method: 'POST',
        body: {
          name: 'Alpha',
          description: 'First',
          price: '10.00',
          stock: 1,
          category: 'books',
          tags: ['a'],
          metadata: { tier: 'a' },
        },
      });
      assert.equal(createAlpha.status, 201);

      const createBeta = await request(app, '/products', {
        method: 'POST',
        body: {
          name: 'Beta',
          description: 'Second',
          price: '20.00',
          stock: 2,
          category: 'games',
          tags: ['b'],
          metadata: { tier: 'b' },
        },
      });
      assert.equal(createBeta.status, 201);

      const response = await request(app, '/products', { query: { category: 'books' } });

      assert.equal(response.status, 200);
      const rows = (await response.json()) as Array<{ category: string; name: string }>;
      assert.ok(rows.length >= 1);
      assert.ok(rows.every((row) => row.category === 'books'));
      assert.ok(rows.some((row) => row.name === 'Alpha'));
      assert.ok(rows.every((row) => row.name !== 'Beta'));
    });

    it('applies user filters within policy scope on GET /users', async () => {
      const matching = await request(app, '/users', {
        token: aliceToken,
        query: { role: 'USER' },
      });

      assert.equal(matching.status, 200);
      const matchingRows = (await matching.json()) as Array<{ id: string }>;
      assert.equal(matchingRows.length, 1);
      assert.equal(matchingRows[0]!.id, users.alice.id);

      const nonMatching = await request(app, '/users', {
        token: aliceToken,
        query: { role: 'ADMIN' },
      });

      assert.equal(nonMatching.status, 200);
      const nonMatchingRows = (await nonMatching.json()) as Array<{ id: string }>;
      assert.equal(nonMatchingRows.length, 0);
    });

    it('returns 400 for invalid sort query params', async () => {
      const response = await request(app, '/products', {
        query: { sort: 'not-a-field' },
      });

      assert.equal(response.status, 400);
    });

    it('parses boolean query filters for isActive', async () => {
      const activeResponse = await request(app, '/users', {
        token: adminToken,
        query: { isActive: 'true' },
      });

      assert.equal(activeResponse.status, 200);
      const activeRows = (await activeResponse.json()) as Array<{ id: string; isActive: boolean }>;
      assert.ok(activeRows.length >= 1);
      assert.ok(activeRows.every((row) => row.isActive === true));
      assert.ok(activeRows.some((row) => row.id === users.alice.id));

      const inactiveResponse = await request(app, '/users', {
        token: adminToken,
        query: { isActive: 'false' },
      });

      assert.equal(inactiveResponse.status, 200);
      const inactiveRows = (await inactiveResponse.json()) as Array<{ id: string; isActive: boolean }>;
      assert.ok(inactiveRows.length >= 1);
      assert.ok(inactiveRows.every((row) => row.isActive === false));
      assert.ok(inactiveRows.some((row) => row.id === users.bob.id));

      const scopedResponse = await request(app, '/users', {
        token: aliceToken,
        query: { isActive: 'false' },
      });

      assert.equal(scopedResponse.status, 200);
      const scopedRows = (await scopedResponse.json()) as Array<{ id: string }>;
      assert.equal(scopedRows.length, 0);

      const invalidResponse = await request(app, '/users', {
        token: adminToken,
        query: { isActive: 'not-a-bool' },
      });

      assert.equal(invalidResponse.status, 400);
    });
  });

  describe('include query param', () => {
    before(async () => {
      const db = createDbClient(pool);

      await db.profile.create({
        userId: users.alice.id,
        bio: 'Hello',
        avatar: 'avatar.png',
        location: '(0,0)',
      });

      await db.order.create({
        userId: users.alice.id,
        totalAmount: '10.00',
        items: { count: 1 },
      });
    });

    it('returns nested profile on GET /users/:id?include=profile', async () => {
      const response = await request(app, `/users/${users.alice.id}`, {
        token: adminToken,
        query: { include: 'profile' },
      });

      assert.equal(response.status, 200);
      const row = (await response.json()) as { profile: { bio: string } | null };
      assert.ok(row.profile);
      assert.equal(row.profile.bio, 'Hello');
    });

    it('returns orders array on GET /users?include=orders', async () => {
      const response = await request(app, '/users', {
        token: adminToken,
        query: { include: 'orders' },
      });

      assert.equal(response.status, 200);
      const rows = (await response.json()) as Array<{ orders?: unknown[] }>;
      const alice = rows.find((row) => (row as { id: string }).id === users.alice.id);
      assert.ok(alice);
      assert.ok(Array.isArray(alice!.orders));
      assert.ok((alice!.orders ?? []).length >= 1);
    });

    it('returns 400 for invalid include query params', async () => {
      const response = await request(app, '/users', {
        token: adminToken,
        query: { include: 'notReal' },
      });

      assert.equal(response.status, 400);
    });

    it('strips nested omitted fields on include=orders.user', async () => {
      const response = await request(app, '/users', {
        token: adminToken,
        query: { include: 'orders.user' },
      });

      assert.equal(response.status, 200);
      const rows = (await response.json()) as Array<{
        id: string;
        orders?: Array<{ user?: Record<string, unknown> }>;
      }>;
      const alice = rows.find((row) => row.id === users.alice.id);
      assert.ok(alice);
      const nestedUser = alice!.orders?.[0]?.user;
      assert.ok(nestedUser);
      assert.equal('passwordHash' in nestedUser, false);
    });

    it('allows scoped user to include profile on own record', async () => {
      const response = await request(app, `/users/${users.alice.id}`, {
        token: aliceToken,
        query: { include: 'profile' },
      });

      assert.equal(response.status, 200);
      const row = (await response.json()) as { profile: { bio: string } | null };
      assert.ok(row.profile);
    });

    it('still enforces policy on GET /users/:id without include', async () => {
      const response = await request(app, `/users/${users.bob.id}`, {
        token: aliceToken,
      });

      assert.equal(response.status, 404);
    });
  });
});
