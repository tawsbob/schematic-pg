import { Hono } from 'hono';
import { z } from 'zod';
import { UnauthorizedError } from './errors.js';
import { createPasswordService } from './password/index.js';
import { createTokenService } from './token/index.js';
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
function resolveUserModel(db, modelKey) {
    const model = db[modelKey];
    if (!model || typeof model !== 'object') {
        throw new Error(`Auth user model "${modelKey}" not found on db client`);
    }
    return model;
}
function asUserRecord(row) {
    if (typeof row.id !== 'string' && typeof row.id !== 'number') {
        throw new Error('User row is missing id');
    }
    return row;
}
/**
 * Reusable auth router: POST /register, POST /login, GET /me.
 * Mount via custom routes (src/routes/auth.ts → /auth).
 * Speaks to the DB client directly — does not go through model @policy.
 */
export function createAuthRouter(options = {}) {
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
    let dummyHashPromise = null;
    function getDummyHash() {
        if (!dummyHashPromise) {
            dummyHashPromise = passwordService.hashPassword(DUMMY_PASSWORD);
        }
        return dummyHashPromise;
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
    const router = new Hono();
    router.post('/register', validateJson(registerSchema), async (c) => {
        const db = c.get('db');
        const body = c.req.valid('json');
        const users = resolveUserModel(db, userModel);
        const passwordHash = await passwordService.hashPassword(body.password);
        const createData = {
            ...defaultCreateFields,
            [emailField]: body.email,
            [passwordHashField]: passwordHash,
            [roleField]: defaultRole,
        };
        if (body.name !== undefined) {
            createData[nameField] = body.name;
        }
        const row = asUserRecord(await users.create(createData));
        const role = String(row[roleField] ?? defaultRole);
        const token = tokenService.signAccessToken({ userId: String(row.id), role });
        return c.json({
            token,
            user: omitFields(row, fieldsToOmit),
        }, 201);
    });
    router.post('/login', validateJson(loginSchema), async (c) => {
        const db = c.get('db');
        const body = c.req.valid('json');
        const users = resolveUserModel(db, userModel);
        const row = await users.findFirst({ where: { [emailField]: body.email } });
        const storedHash = row && typeof row[passwordHashField] === 'string'
            ? row[passwordHashField]
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
            user = asUserRecord(await users.update({
                where: { id: user.id },
                data: { [passwordHashField]: newHash },
            }));
        }
        const role = String(user[roleField] ?? defaultRole);
        const token = tokenService.signAccessToken({ userId: String(user.id), role });
        return c.json({
            token,
            user: omitFields(user, fieldsToOmit),
        });
    });
    router.get('/me', (c) => {
        const auth = c.get('auth');
        return c.json(auth ?? { role: PUBLIC_ROLE });
    });
    return router;
}
