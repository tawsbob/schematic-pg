import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Hono } from 'hono';
import type { AppEnv } from '../../../types.js';
import { UnauthorizedError } from '../../errors.js';
import {
  clearRefreshCookie,
  createRefreshSessionStore,
  generateRefreshToken,
  getRefreshCookieOptions,
  hashRefreshToken,
  resolveRefreshConfig,
  setRefreshCookie,
  type RefreshDb,
  type RefreshRawOps,
} from '../index.js';
import { InvalidCookieConfigError } from '../errors.js';
import { assertAllowedAuthOrigin } from '../origin.js';
import { ForbiddenError } from '../../errors.js';

describe('refresh token hashing', () => {
  it('generates opaque base64url tokens of expected length', () => {
    const token = generateRefreshToken(32);
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.ok(token.length >= 40);
  });

  it('hashes stably with SHA-256 hex', () => {
    const token = 'test-refresh-token';
    const first = hashRefreshToken(token);
    const second = hashRefreshToken(token);
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, token);
  });
});

describe('resolveRefreshConfig', () => {
  const previous = {
    ttl: process.env.AUTH_REFRESH_TOKEN_TTL,
    secure: process.env.AUTH_COOKIE_SECURE,
    sameSite: process.env.AUTH_COOKIE_SAMESITE,
    nodeEnv: process.env.NODE_ENV,
  };

  afterEach(() => {
    restoreEnv('AUTH_REFRESH_TOKEN_TTL', previous.ttl);
    restoreEnv('AUTH_COOKIE_SECURE', previous.secure);
    restoreEnv('AUTH_COOKIE_SAMESITE', previous.sameSite);
    restoreEnv('NODE_ENV', previous.nodeEnv);
  });

  it('defaults to 30d TTL, Lax, and Secure only in production', () => {
    delete process.env.AUTH_REFRESH_TOKEN_TTL;
    delete process.env.AUTH_COOKIE_SECURE;
    delete process.env.AUTH_COOKIE_SAMESITE;
    process.env.NODE_ENV = 'development';

    const config = resolveRefreshConfig();
    assert.equal(config.ttlSeconds, 2_592_000);
    assert.equal(config.cookieSameSite, 'Lax');
    assert.equal(config.cookieSecure, false);
  });

  it('enables Secure by default when NODE_ENV is production', () => {
    delete process.env.AUTH_COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    assert.equal(resolveRefreshConfig().cookieSecure, true);
  });

  it('rejects SameSite=None without Secure', () => {
    process.env.AUTH_COOKIE_SAMESITE = 'None';
    process.env.AUTH_COOKIE_SECURE = 'false';
    assert.throws(() => resolveRefreshConfig(), InvalidCookieConfigError);
  });
});

describe('refresh cookie helpers', () => {
  const previousSecure = process.env.AUTH_COOKIE_SECURE;
  const previousSameSite = process.env.AUTH_COOKIE_SAMESITE;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.AUTH_COOKIE_SECURE = 'false';
    process.env.AUTH_COOKIE_SAMESITE = 'Lax';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    restoreEnv('AUTH_COOKIE_SECURE', previousSecure);
    restoreEnv('AUTH_COOKIE_SAMESITE', previousSameSite);
    restoreEnv('NODE_ENV', previousNodeEnv);
  });

  it('sets HttpOnly Path=/auth cookies without exposing the token in JSON', async () => {
    const app = new Hono<AppEnv>();
    app.get('/auth/login', (c) => {
      setRefreshCookie(c, 'opaque-refresh-value');
      return c.json({ token: 'access-only', expiresIn: 3600 });
    });

    const response = await app.request('/auth/login');
    const setCookie = response.headers.get('set-cookie') ?? '';
    const body = (await response.json()) as Record<string, unknown>;

    assert.match(setCookie, /refresh_token=opaque-refresh-value/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Path=\/auth/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.equal(body.token, 'access-only');
    assert.equal(body.refresh_token, undefined);
    assert.equal(body.refreshToken, undefined);
  });

  it('clears the cookie with the same path', async () => {
    const app = new Hono<AppEnv>();
    app.post('/auth/logout', (c) => {
      clearRefreshCookie(c);
      return c.body(null, 204);
    });

    const response = await app.request('/auth/logout', { method: 'POST' });
    const setCookie = response.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /refresh_token=/);
    assert.match(setCookie, /Path=\/auth/i);
    assert.match(setCookie, /Max-Age=0/i);
  });

  it('exposes cookie options for inspection', () => {
    const { options } = getRefreshCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, '/auth');
  });
});

describe('assertAllowedAuthOrigin', () => {
  const previousCors = process.env.CORS_ORIGIN;

  afterEach(() => {
    restoreEnv('CORS_ORIGIN', previousCors);
  });

  it('allows missing Origin', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    assert.doesNotThrow(() => assertAllowedAuthOrigin(undefined));
  });

  it('allows Origin in the concrete list', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173,https://app.example.com';
    assert.doesNotThrow(() => assertAllowedAuthOrigin('https://app.example.com'));
  });

  it('rejects Origin when CORS_ORIGIN is unset or *', () => {
    delete process.env.CORS_ORIGIN;
    assert.throws(() => assertAllowedAuthOrigin('http://localhost:5173'), ForbiddenError);

    process.env.CORS_ORIGIN = '*';
    assert.throws(() => assertAllowedAuthOrigin('http://localhost:5173'), ForbiddenError);
  });

  it('rejects Origin outside the allow-list', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    assert.throws(() => assertAllowedAuthOrigin('https://evil.example'), ForbiddenError);
  });
});

describe('createRefreshSessionStore', () => {
  it('creates and rotates sessions', async () => {
    const db = createMemoryRefreshDb();
    const store = createRefreshSessionStore(db, { ttlSeconds: 3_600 });

    const created = await store.createSession('user-1');
    assert.ok(created.rawToken);
    assert.equal(created.userId, 'user-1');
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]!.token_hash, hashRefreshToken(created.rawToken));

    const rotated = await store.rotateSession(created.rawToken);
    assert.notEqual(rotated.rawToken, created.rawToken);
    assert.equal(rotated.familyId, created.familyId);
    assert.equal(db.rows.length, 2);
    assert.ok(db.rows[0]!.revoked_at);
    assert.equal(db.rows[1]!.revoked_at, null);
  });

  it('rejects reuse after the grace window and revokes the family', async () => {
    const db = createMemoryRefreshDb();
    const store = createRefreshSessionStore(db, {
      ttlSeconds: 3_600,
      reuseGraceSeconds: 0,
    });

    const created = await store.createSession('user-1');
    await store.rotateSession(created.rawToken);

    await assert.rejects(
      () => store.rotateSession(created.rawToken),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedError);
        assert.equal(error.message, 'Invalid refresh token');
        return true;
      },
    );

    assert.ok(db.rows.every((row) => row.revoked_at != null));
  });

  it('rejects reuse inside the grace window without revoking the family', async () => {
    const db = createMemoryRefreshDb();
    const store = createRefreshSessionStore(db, {
      ttlSeconds: 3_600,
      reuseGraceSeconds: 60,
    });

    const created = await store.createSession('user-1');
    const rotated = await store.rotateSession(created.rawToken);

    await assert.rejects(() => store.rotateSession(created.rawToken), UnauthorizedError);

    const active = db.rows.find((row) => row.token_hash === hashRefreshToken(rotated.rawToken));
    assert.ok(active);
    assert.equal(active!.revoked_at, null);
  });

  it('revokeFamilyByToken marks the family revoked', async () => {
    const db = createMemoryRefreshDb();
    const store = createRefreshSessionStore(db, { ttlSeconds: 3_600 });
    const created = await store.createSession('user-1');

    await store.revokeFamilyByToken(created.rawToken);
    assert.ok(db.rows[0]!.revoked_at);

    await assert.rejects(() => store.rotateSession(created.rawToken), UnauthorizedError);
  });
});

type MemoryRow = {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

function createMemoryRefreshDb(): RefreshDb & { rows: MemoryRow[] } {
  const rows: MemoryRow[] = [];

  const ops: RefreshRawOps = {
    async $executeRaw(sql, params = []) {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
        return 0;
      }

      if (sql.includes('INSERT INTO auth_refresh_session')) {
        rows.push({
          id: String(params[0]),
          user_id: String(params[1]),
          token_hash: String(params[2]),
          family_id: String(params[3]),
          expires_at: new Date(String(params[4])),
          revoked_at: null,
          created_at: new Date(),
        });
        return 1;
      }

      if (sql.includes('WHERE family_id = $1') && sql.includes('SET revoked_at')) {
        const familyId = String(params[0]);
        let count = 0;
        for (const row of rows) {
          if (row.family_id === familyId && row.revoked_at == null) {
            row.revoked_at = new Date();
            count += 1;
          }
        }
        return count;
      }

      return 0;
    },

    async $queryRaw(sql, params = []) {
      if (sql.includes('UPDATE auth_refresh_session') && sql.includes('RETURNING')) {
        const tokenHash = String(params[0]);
        const now = Date.now();
        const row = rows.find(
          (candidate) =>
            candidate.token_hash === tokenHash &&
            candidate.revoked_at == null &&
            candidate.expires_at.getTime() > now,
        );
        if (!row) {
          return [];
        }
        row.revoked_at = new Date();
        return [{ user_id: row.user_id, family_id: row.family_id }];
      }

      if (sql.includes('SELECT user_id, family_id, revoked_at, expires_at')) {
        const tokenHash = String(params[0]);
        const row = rows.find((candidate) => candidate.token_hash === tokenHash);
        if (!row) {
          return [];
        }
        return [
          {
            user_id: row.user_id,
            family_id: row.family_id,
            revoked_at: row.revoked_at,
            expires_at: row.expires_at,
          },
        ];
      }

      if (sql.includes('SELECT family_id')) {
        const tokenHash = String(params[0]);
        const row = rows.find((candidate) => candidate.token_hash === tokenHash);
        return row ? [{ family_id: row.family_id }] : [];
      }

      return [];
    },
  };

  return {
    rows,
    ...ops,
    async $transaction(fn) {
      return fn(ops);
    },
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
