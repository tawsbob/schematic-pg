import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from './errors.js';
/** HS256 only — matches createJwtResolver / createTokenService. */
export const JWT_ALGORITHM = 'HS256';
export function base64UrlEncode(value) {
    const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    return buffer.toString('base64url');
}
export function base64UrlDecode(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, 'base64');
}
export function signHs256Jwt(payload, secret) {
    const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALGORITHM, typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${header}.${body}`;
    const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
    return `${signingInput}.${signature}`;
}
/**
 * Verify HS256 signature and optional exp/nbf.
 * Tokens without exp/nbf remain valid (backward compatible with older test JWTs).
 */
export function verifyHs256Jwt(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new UnauthorizedError('Invalid JWT format');
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret).update(signingInput).digest();
    const actualSignature = base64UrlDecode(encodedSignature);
    if (expectedSignature.length !== actualSignature.length ||
        !timingSafeEqual(expectedSignature, actualSignature)) {
        throw new UnauthorizedError('Invalid JWT signature');
    }
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8'));
    if (header.alg !== JWT_ALGORITHM) {
        throw new UnauthorizedError(`Unsupported JWT algorithm "${header.alg ?? 'unknown'}"`);
    }
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
    assertJwtTimeClaims(payload, nowSeconds);
    return payload;
}
function assertJwtTimeClaims(payload, nowSeconds) {
    const exp = payload.exp;
    if (exp !== undefined && exp !== null) {
        const expSeconds = Number(exp);
        if (!Number.isFinite(expSeconds) || nowSeconds >= expSeconds) {
            throw new UnauthorizedError('JWT has expired');
        }
    }
    const nbf = payload.nbf;
    if (nbf !== undefined && nbf !== null) {
        const nbfSeconds = Number(nbf);
        if (!Number.isFinite(nbfSeconds) || nowSeconds < nbfSeconds) {
            throw new UnauthorizedError('JWT is not yet valid');
        }
    }
}
