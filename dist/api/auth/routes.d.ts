import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { type PasswordService } from './password/index.js';
import { type TokenService } from './token/index.js';
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
}
/**
 * Reusable auth router: POST /register, POST /login, GET /me.
 * Mount via custom routes (src/routes/auth.ts → /auth).
 * Speaks to the DB client directly — does not go through model @policy.
 */
export declare function createAuthRouter(options?: CreateAuthRouterOptions): Hono<AppEnv>;
