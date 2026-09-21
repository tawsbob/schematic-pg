import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { UnauthorizedError } from './errors.js';
import { createPasswordService, type PasswordService } from './password/index.js';
import {
  assertAllowedAuthOrigin,
  clearRefreshCookie,
  createRefreshSessionStore,
  readRefreshCookie,
  setRefreshCookie,
  type RefreshSessionStore,
} from './refresh/index.js';
import { createTokenService, type TokenService } from './token/index.js';
import { omitFields } from '../utils/omit-fields.js';
import { validateJson } from '../middleware/validate.js';
import { PUBLIC_ROLE } from './types.js';

const DEFAULT_USER_MODEL = 'user';
const DEFAULT_EMAIL_FIELD = 'email';
const DEFAULT_PASSWORD_HASH_FIELD = 'passwordHash';
const DEFAULT_ROLE_FIELD = 'role';
const DEFAULT_NAME_FIELD = 'name';
const DEFAULT_ROLE = 'USER';
const DUMMY_PASSWORD = '__schematic-pg-timing-dummy__';
const INVALID_REFRESH_MESSAGE = 'Invalid refresh token';

type UserModelClient = {
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  findFirst: (args: {
    where: Record<string, unknown>;
  }) => Promise<Record<string, unknown> | null>;
  update: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
};

export interface CreateAuthRouterOptions {
  userModel?: string;
  emailField?: string;
  passwordHashField?: string;
  roleField?: string;
  nameField?: string;
  defaultRole?: string;
  omitFields?: string[];
  /** Merged into create payloads (e.g. required schema defaults like `{ balance: 0 }`). */
  defaultCreateFields?: Record<string, unknown>;
  passwordService?: PasswordService;
  tokenService?: TokenService;
  refreshSessionStore?: RefreshSessionStore;
}

function resolveUserModel(db: AppEnv['Variables']['db'], modelKey: string): UserModelClient {
  const model = (db as unknown as Record<string, unknown>)[modelKey];

  if (!model || typeof model !== 'object') {
    throw new Error(`Auth user model "${modelKey}" not found on db client`);
  }

  return model as UserModelClient;
}

function asUserRecord(row: Record<string, unknown>): Record<string, unknown> & { id: string } {
  if (typeof row.id !== 'string' && typeof row.id !== 'number') {
    throw new Error('User row is missing id');
  }

  return row as Record<string, unknown> & { id: string };
}

/**
 * Reusable auth router: POST /register, POST /login, POST /refresh, POST /logout, GET /me.
 * Mount via custom routes (src/routes/auth.ts → /auth).
 * Speaks to the DB client directly — does not go through model @policy.
 *
 * Access tokens are returned in JSON only (client keeps them in memory as Bearer).
 * Refresh tokens are opaque and set only as HttpOnly cookies — never in the JSON body.
 */
export function createAuthRouter(options: CreateAuthRouterOptions = {}): Hono<AppEnv> {
  const userModel = options.userModel ?? DEFAULT_USER_MODEL;
  const emailField = options.emailField ?? DEFAULT_EMAIL_FIELD;
  const passwordHashField = options.passwordHashField ?? DEFAULT_PASSWORD_HASH_FIELD;
  const roleField = options.roleField ?? DEFAULT_ROLE_FIELD;
  const nameField = options.nameField ?? DEFAULT_NAME_FIELD;
  const defaultRole = options.defaultRole ?? DEFAULT_ROLE;
  const fieldsToOmit = options.omitFields ?? [passwordHashField];
  const defaultCreateFields = options.defaultCreateFields ?? {};
  const passwordService = options.passwordService ?? createPasswordService();
  const tokenService = options.tokenService ?? createTokenService();
  const refreshStores = new WeakMap<object, RefreshSessionStore>();

  let dummyHashPromise: Promise<string> | null = null;

  function getDummyHash(): Promise<string> {
    if (!dummyHashPromise) {
      dummyHashPromise = passwordService.hashPassword(DUMMY_PASSWORD);
    }
    return dummyHashPromise;
  }

  function getRefreshStore(db: AppEnv['Variables']['db']): RefreshSessionStore {
    if (options.refreshSessionStore) {
      return options.refreshSessionStore;
    }
    const cached = refreshStores.get(db as object);
    if (cached) {
      return cached;
    }
    const created = createRefreshSessionStore(db);
    refreshStores.set(db as object, created);
    return created;
  }

  const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
    name: z.string().min(1).optional(),
  });

  const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
  });

  const router = new Hono<AppEnv>();

  async function issueSessionResponse(
    c: Context<AppEnv>,
    user: Record<string, unknown> & { id: string },
    status: 200 | 201,
  ) {
    const db = c.get('db');
    const store = getRefreshStore(db);
    const role = String(user[roleField] ?? defaultRole);
    const userId = String(user.id);
    const token = tokenService.signAccessToken({ userId, role });
    const session = await store.createSession(userId);
    setRefreshCookie(c, session.rawToken);

    return c.json(
      {
        token,
        expiresIn: tokenService.accessTokenTtlSeconds,
        user: omitFields(user, fieldsToOmit),
      },
      status,
    );
  }

  router.post('/register', validateJson(registerSchema), async (c) => {
    const db = c.get('db');
    const body = c.req.valid('json');
    const users = resolveUserModel(db, userModel);
    const passwordHash = await passwordService.hashPassword(body.password);

    const createData: Record<string, unknown> = {
      ...defaultCreateFields,
      [emailField]: body.email,
      [passwordHashField]: passwordHash,
      [roleField]: defaultRole,
    };

    if (body.name !== undefined) {
      createData[nameField] = body.name;
    }

    const row = asUserRecord(await users.create(createData));
    return issueSessionResponse(c, row, 201);
  });

  router.post('/login', validateJson(loginSchema), async (c) => {
    const db = c.get('db');
    const body = c.req.valid('json');
    const users = resolveUserModel(db, userModel);

    const row = await users.findFirst({ where: { [emailField]: body.email } });
    const storedHash =
      row && typeof row[passwordHashField] === 'string'
        ? (row[passwordHashField] as string)
        : await getDummyHash();

    // Always verify to reduce user-enumeration timing differences.
    const valid = await passwordService.verifyPassword(body.password, storedHash);

    if (!row || !valid) {
      // Uniform message — do not reveal whether email exists.
      throw new UnauthorizedError('Invalid email or password');
    }

    let user = asUserRecord(row);

    if (passwordService.needsRehash(storedHash)) {
      const newHash = await passwordService.hashPassword(body.password);
      user = asUserRecord(
        await users.update({
          where: { id: user.id },
          data: { [passwordHashField]: newHash },
        }),
      );
    }

    return issueSessionResponse(c, user, 200);
  });

  router.post('/refresh', async (c) => {
    assertAllowedAuthOrigin(c.req.header('Origin'));

    const rawToken = readRefreshCookie(c);
    if (!rawToken) {
      clearRefreshCookie(c);
      throw new UnauthorizedError(INVALID_REFRESH_MESSAGE);
    }

    const db = c.get('db');
    const store = getRefreshStore(db);
    const users = resolveUserModel(db, userModel);

    let session;
    try {
      session = await store.rotateSession(rawToken);
    } catch (error) {
      clearRefreshCookie(c);
      throw error;
    }

    const row = await users.findFirst({ where: { id: session.userId } });
    if (!row) {
      clearRefreshCookie(c);
      throw new UnauthorizedError(INVALID_REFRESH_MESSAGE);
    }

    const user = asUserRecord(row);
    const role = String(user[roleField] ?? defaultRole);
    const token = tokenService.signAccessToken({
      userId: String(user.id),
      role,
    });
    setRefreshCookie(c, session.rawToken);

    return c.json({
      token,
      expiresIn: tokenService.accessTokenTtlSeconds,
    });
  });

  router.post('/logout', async (c) => {
    assertAllowedAuthOrigin(c.req.header('Origin'));

    const rawToken = readRefreshCookie(c);
    if (rawToken) {
      const db = c.get('db');
      const store = getRefreshStore(db);
      await store.revokeFamilyByToken(rawToken);
    }

    clearRefreshCookie(c);
    return c.body(null, 204);
  });

  router.get('/me', (c) => {
    const auth = c.get('auth');
    return c.json(auth ?? { role: PUBLIC_ROLE });
  });

  return router;
}
