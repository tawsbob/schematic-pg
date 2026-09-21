import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../../types.js';
import {
  resolveRefreshConfig,
  type RefreshConfig,
} from './config.js';

export function getRefreshCookieOptions(overrides: Partial<RefreshConfig> = {}) {
  const config = resolveRefreshConfig(overrides);
  return {
    config,
    options: {
      httpOnly: true as const,
      path: config.cookiePath,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: config.ttlSeconds,
    },
  };
}

export function setRefreshCookie(
  c: Context<AppEnv>,
  rawToken: string,
  overrides: Partial<RefreshConfig> = {},
): void {
  const { config, options } = getRefreshCookieOptions(overrides);
  setCookie(c, config.cookieName, rawToken, options);
}

export function clearRefreshCookie(
  c: Context<AppEnv>,
  overrides: Partial<RefreshConfig> = {},
): void {
  const { config, options } = getRefreshCookieOptions(overrides);
  deleteCookie(c, config.cookieName, {
    path: options.path,
    secure: options.secure,
    sameSite: options.sameSite,
  });
}

export function readRefreshCookie(
  c: Context<AppEnv>,
  overrides: Partial<RefreshConfig> = {},
): string | undefined {
  const { config } = getRefreshCookieOptions(overrides);
  const value = getCookie(c, config.cookieName);
  return value && value.length > 0 ? value : undefined;
}
