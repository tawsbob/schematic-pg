/** Default refresh-token lifetime when AUTH_REFRESH_TOKEN_TTL is unset (30 days). */
export declare const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2592000;
export declare const REFRESH_COOKIE_NAME = "refresh_token";
export declare const REFRESH_COOKIE_PATH = "/auth";
/** Grace window after rotation where reuse does not revoke the whole family. */
export declare const REFRESH_REUSE_GRACE_SECONDS = 10;
export declare const REFRESH_TOKEN_BYTES = 32;
export type CookieSameSite = 'Strict' | 'Lax' | 'None';
export interface RefreshConfig {
    ttlSeconds: number;
    cookieName: string;
    cookiePath: string;
    cookieSecure: boolean;
    cookieSameSite: CookieSameSite;
    reuseGraceSeconds: number;
}
export declare function resolveRefreshConfig(overrides?: Partial<RefreshConfig>): RefreshConfig;
