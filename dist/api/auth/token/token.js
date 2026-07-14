import { signHs256Jwt, verifyHs256Jwt } from '../jwt-crypto.js';
import { resolveTokenConfig } from './config.js';
import { MissingJwtSecretError } from './errors.js';
export function createTokenService(overrides = {}) {
    const config = resolveTokenConfig(overrides);
    return {
        signAccessToken(claims) {
            const secret = config.secret;
            if (!secret) {
                throw new MissingJwtSecretError();
            }
            const { userId, role, ...extra } = claims;
            const nowSeconds = Math.floor(Date.now() / 1000);
            const payload = {
                ...extra,
                [config.userIdClaim]: userId,
                [config.roleClaim]: role,
                iat: nowSeconds,
                exp: nowSeconds + config.ttlSeconds,
            };
            return signHs256Jwt(payload, secret);
        },
        verifyAccessToken(token) {
            const secret = config.secret;
            if (!secret) {
                throw new MissingJwtSecretError();
            }
            return verifyHs256Jwt(token, secret);
        },
    };
}
