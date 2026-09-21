import { createHash, randomBytes } from 'node:crypto';
import { REFRESH_TOKEN_BYTES } from './config.js';
/** Opaque refresh token as base64url (no padding). */
export function generateRefreshToken(byteLength = REFRESH_TOKEN_BYTES) {
    return randomBytes(byteLength).toString('base64url');
}
/** SHA-256 hex digest of the raw refresh token (what we store in Postgres). */
export function hashRefreshToken(rawToken) {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
