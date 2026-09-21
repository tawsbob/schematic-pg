import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { resolveRefreshConfig, } from './config.js';
export function getRefreshCookieOptions(overrides = {}) {
    const config = resolveRefreshConfig(overrides);
    return {
        config,
        options: {
            httpOnly: true,
            path: config.cookiePath,
            secure: config.cookieSecure,
            sameSite: config.cookieSameSite,
            maxAge: config.ttlSeconds,
        },
    };
}
export function setRefreshCookie(c, rawToken, overrides = {}) {
    const { config, options } = getRefreshCookieOptions(overrides);
    setCookie(c, config.cookieName, rawToken, options);
}
export function clearRefreshCookie(c, overrides = {}) {
    const { config, options } = getRefreshCookieOptions(overrides);
    deleteCookie(c, config.cookieName, {
        path: options.path,
        secure: options.secure,
        sameSite: options.sameSite,
    });
}
export function readRefreshCookie(c, overrides = {}) {
    const { config } = getRefreshCookieOptions(overrides);
    const value = getCookie(c, config.cookieName);
    return value && value.length > 0 ? value : undefined;
}
