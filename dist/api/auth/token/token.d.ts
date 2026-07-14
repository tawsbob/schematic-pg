import { type TokenConfig } from './config.js';
export interface AccessTokenClaims {
    userId: string;
    role: string;
    [key: string]: unknown;
}
export interface TokenService {
    signAccessToken(claims: AccessTokenClaims): string;
    verifyAccessToken(token: string): Record<string, unknown>;
}
export declare function createTokenService(overrides?: Partial<TokenConfig>): TokenService;
