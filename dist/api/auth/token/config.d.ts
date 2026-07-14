/** Default access-token lifetime when AUTH_ACCESS_TOKEN_TTL is unset (1 hour). */
export declare const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
export interface TokenConfig {
    secret?: string;
    ttlSeconds: number;
    roleClaim: string;
    userIdClaim: string;
}
export declare function parseTtlSeconds(value: string | undefined, defaultSeconds?: number): number;
export declare function resolveTokenConfig(overrides?: Partial<TokenConfig>): TokenConfig;
