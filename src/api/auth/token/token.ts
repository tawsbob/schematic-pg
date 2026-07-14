import { signHs256Jwt, verifyHs256Jwt } from '../jwt-crypto.js';
import { resolveTokenConfig, type TokenConfig } from './config.js';
import { MissingJwtSecretError } from './errors.js';

export interface AccessTokenClaims {
  userId: string;
  role: string;
  [key: string]: unknown;
}

export interface TokenService {
  signAccessToken(claims: AccessTokenClaims): string;
  verifyAccessToken(token: string): Record<string, unknown>;
}

export function createTokenService(overrides: Partial<TokenConfig> = {}): TokenService {
  const config = resolveTokenConfig(overrides);

  return {
    signAccessToken(claims: AccessTokenClaims): string {
      const secret = config.secret;
      if (!secret) {
        throw new MissingJwtSecretError();
      }

      const { userId, role, ...extra } = claims;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const payload: Record<string, unknown> = {
        ...extra,
        [config.userIdClaim]: userId,
        [config.roleClaim]: role,
        iat: nowSeconds,
        exp: nowSeconds + config.ttlSeconds,
      };

      return signHs256Jwt(payload, secret);
    },

    verifyAccessToken(token: string): Record<string, unknown> {
      const secret = config.secret;
      if (!secret) {
        throw new MissingJwtSecretError();
      }

      return verifyHs256Jwt(token, secret);
    },
  };
}
