import { availableParallelism } from 'node:os';
import { argon2id } from 'argon2';
import { MissingAuthPepperError } from './errors.js';

/**
 * Argon2id (hybrid) resists both GPU/ASIC cracking and side-channel leaks better
 * than pure argon2i/argon2d for password storage (OWASP Password Storage Cheat Sheet).
 * Version 19 (0x13) is the current Argon2 RFC reference version.
 */
export const ARGON2_VERSION = 19;

/**
 * Single source of truth for hash parameters. Do not scatter these literals.
 * memoryCost 65536 = 64 MiB; timeCost 3 ≈ interactive login cost.
 */
export const DEFAULT_PASSWORD_CONFIG = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: availableParallelism(),
  type: argon2id,
  version: ARGON2_VERSION,
} as const;

export type PasswordConfig = {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  type: typeof argon2id;
  version: number;
};

/** Pepper is application-side secret; never persisted with the hash. */
export function resolvePepper(env: NodeJS.ProcessEnv = process.env): string {
  const pepper = env.AUTH_PEPPER;

  if (pepper === undefined || pepper === null || pepper === '') {
    throw new MissingAuthPepperError();
  }

  return pepper;
}

/**
 * Bind password to the app by appending pepper before hash/verify.
 * Compromise of the hash DB alone is insufficient without AUTH_PEPPER.
 */
export function applyPepper(password: string, pepper: string): string {
  return password + pepper;
}
