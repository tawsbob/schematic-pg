import { parseTtlSeconds } from '../token/config.js';
import { InvalidCookieConfigError } from './errors.js';

/** Default refresh-token lifetime when AUTH_REFRESH_TOKEN_TTL is unset (30 days). */
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';

/** Grace window after rotation where reuse does not revoke the whole family. */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

export const REFRESH_TOKEN_BYTES = 32;

export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface RefreshConfig {
  ttlSeconds: number;
  cookieName: string;
  cookiePath: string;
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
  reuseGraceSeconds: number;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new InvalidCookieConfigError(
    `AUTH_COOKIE_SECURE must be true or false, got "${value}"`,
  );
}

function parseSameSite(value: string | undefined): CookieSameSite {
  if (value === undefined || value === '') {
    return 'Lax';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'lax') {
    return 'Lax';
  }
  if (normalized === 'strict') {
    return 'Strict';
  }
  if (normalized === 'none') {
    return 'None';
  }

  throw new InvalidCookieConfigError(
    `AUTH_COOKIE_SAMESITE must be Lax, Strict, or None, got "${value}"`,
  );
}

function parseReuseGraceSeconds(value: string | undefined): number {
  if (value === undefined || value === '') {
    return REFRESH_REUSE_GRACE_SECONDS;
  }

  if (!/^\d+$/.test(value)) {
    throw new InvalidCookieConfigError(
      `AUTH_REFRESH_REUSE_GRACE_SECONDS must be a non-negative integer, got "${value}"`,
    );
  }

  return Number(value);
}

export function resolveRefreshConfig(overrides: Partial<RefreshConfig> = {}): RefreshConfig {
  const cookieSecure =
    overrides.cookieSecure ??
    parseBooleanEnv(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');

  const cookieSameSite = overrides.cookieSameSite ?? parseSameSite(process.env.AUTH_COOKIE_SAMESITE);

  if (cookieSameSite === 'None' && !cookieSecure) {
    throw new InvalidCookieConfigError(
      'AUTH_COOKIE_SAMESITE=None requires Secure cookies (set AUTH_COOKIE_SECURE=true)',
    );
  }

  return {
    ttlSeconds:
      overrides.ttlSeconds ??
      parseTtlSeconds(
        process.env.AUTH_REFRESH_TOKEN_TTL,
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
        'AUTH_REFRESH_TOKEN_TTL',
      ),
    cookieName: overrides.cookieName ?? REFRESH_COOKIE_NAME,
    cookiePath: overrides.cookiePath ?? REFRESH_COOKIE_PATH,
    cookieSecure,
    cookieSameSite,
    reuseGraceSeconds:
      overrides.reuseGraceSeconds ?? parseReuseGraceSeconds(process.env.AUTH_REFRESH_REUSE_GRACE_SECONDS),
  };
}
