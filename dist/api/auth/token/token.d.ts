import { type TokenConfig } from './config.js';
export interface AccessTokenClaims {
    userId: string;
    role: string;
    [key: string]: unknown;
}
export interface TokenService {
    /** Access-token lifetime in seconds (from config / AUTH_ACCESS_TOKEN_TTL). */
    readonly accessTokenTtlSeconds: number;
    signAccessToken(claims: AccessTokenClaims): string;
    verifyAccessToken(token: string): Record<string, unknown>;
}
export declare function createTokenService(overrides?: Partial<TokenConfig>): TokenService;
