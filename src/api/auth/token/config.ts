import { InvalidTokenTtlError } from './errors.js';

/** Default access-token lifetime when AUTH_ACCESS_TOKEN_TTL is unset (1 hour). */
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3_600;

const DEFAULT_ROLE_CLAIM = 'role';
const DEFAULT_USER_ID_CLAIM = 'sub';

const TTL_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
};

export interface TokenConfig {
  secret?: string;
  ttlSeconds: number;
  roleClaim: string;
  userIdClaim: string;
}

export function parseTtlSeconds(
  value: string | undefined,
  defaultSeconds: number = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultSeconds;
  }

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    if (seconds <= 0) {
      throw new InvalidTokenTtlError(`AUTH_ACCESS_TOKEN_TTL must be positive, got "${value}"`);
    }
    return seconds;
  }

  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) {
    throw new InvalidTokenTtlError(
      `AUTH_ACCESS_TOKEN_TTL must be seconds or a duration like 15m/1h, got "${value}"`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multiplier = TTL_UNIT_SECONDS[unit]!;
  const seconds = amount * multiplier;

  if (seconds <= 0) {
    throw new InvalidTokenTtlError(`AUTH_ACCESS_TOKEN_TTL must be positive, got "${value}"`);
  }

  return seconds;
}

export function resolveTokenConfig(overrides: Partial<TokenConfig> = {}): TokenConfig {
  return {
    secret: overrides.secret ?? process.env.JWT_SECRET,
    ttlSeconds:
      overrides.ttlSeconds ?? parseTtlSeconds(process.env.AUTH_ACCESS_TOKEN_TTL),
    roleClaim: overrides.roleClaim ?? process.env.JWT_ROLE_CLAIM ?? DEFAULT_ROLE_CLAIM,
    userIdClaim:
      overrides.userIdClaim ?? process.env.JWT_USER_ID_CLAIM ?? DEFAULT_USER_ID_CLAIM,
  };
}
