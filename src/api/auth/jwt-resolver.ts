import type { Context } from 'hono';
import type { AppEnv } from '../types.js';
import { UnauthorizedError } from './errors.js';
import { verifyHs256Jwt } from './jwt-crypto.js';
import type { AuthContext, AuthResolver, AuthUser } from './types.js';

const BEARER_PREFIX = 'Bearer ';
const DEFAULT_ROLE_CLAIM = 'role';
const DEFAULT_USER_ID_CLAIM = 'sub';

export interface JwtResolverOptions {
  secret?: string;
  roleClaim?: string;
  userIdClaim?: string;
}

export function createJwtResolver(options: JwtResolverOptions = {}): AuthResolver {
  const roleClaim = options.roleClaim ?? process.env.JWT_ROLE_CLAIM ?? DEFAULT_ROLE_CLAIM;
  const userIdClaim = options.userIdClaim ?? process.env.JWT_USER_ID_CLAIM ?? DEFAULT_USER_ID_CLAIM;

  return async (c: Context<AppEnv>): Promise<AuthContext | null> => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      return null;
    }

    const token = authHeader.slice(BEARER_PREFIX.length).trim();

    if (!token) {
      return null;
    }

    const secret = options.secret ?? process.env.JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedError('JWT_SECRET is not configured');
    }

    const payload = verifyHs256Jwt(token, secret);
    const role = String(payload[roleClaim] ?? 'PUBLIC');
    const userId = payload[userIdClaim];

    if (userId === undefined || userId === null || userId === '') {
      throw new UnauthorizedError(`JWT missing "${userIdClaim}" claim`);
    }

    const user: AuthUser = {
      id: String(userId),
      ...payload,
    };

    return { role, user };
  };
}
