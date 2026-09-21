import type { Context } from 'hono';
import type { AppEnv } from '../../types.js';
import { type RefreshConfig } from './config.js';
export declare function getRefreshCookieOptions(overrides?: Partial<RefreshConfig>): {
    config: RefreshConfig;
    options: {
        httpOnly: true;
        path: string;
        secure: boolean;
        sameSite: import("./config.js").CookieSameSite;
        maxAge: number;
    };
};
export declare function setRefreshCookie(c: Context<AppEnv>, rawToken: string, overrides?: Partial<RefreshConfig>): void;
export declare function clearRefreshCookie(c: Context<AppEnv>, overrides?: Partial<RefreshConfig>): void;
export declare function readRefreshCookie(c: Context<AppEnv>, overrides?: Partial<RefreshConfig>): string | undefined;
