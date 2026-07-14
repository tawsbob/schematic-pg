import { hash as argon2Hash, needsRehash as argon2NeedsRehash, verify as argon2Verify } from 'argon2';
import {
  applyPepper,
  DEFAULT_PASSWORD_CONFIG,
  resolvePepper,
  type PasswordConfig,
} from './config.js';
import { InvalidPasswordInputError } from './errors.js';

export interface PasswordService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, encodedHash: string): Promise<boolean>;
  needsRehash(encodedHash: string): boolean;
}

function assertPasswordInput(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length === 0) {
    throw new InvalidPasswordInputError();
  }
}

/**
 * Factory for the password service.
 * Uses Argon2id with automatic salt; output is the full `$argon2id$…` encoded string
 * (algo, version, params, salt, hash) so verify never needs a separate salt column.
 */
export function createPasswordService(config: PasswordConfig = DEFAULT_PASSWORD_CONFIG): PasswordService {
  const hashOptions = {
    memoryCost: config.memoryCost,
    timeCost: config.timeCost,
    parallelism: config.parallelism,
    type: config.type,
    version: config.version,
  };

  return {
    async hashPassword(password: string): Promise<string> {
      assertPasswordInput(password);
      const pepper = resolvePepper();
      // Never log password, pepper, or the resulting hash.
      return argon2Hash(applyPepper(password, pepper), hashOptions);
    },

    async verifyPassword(password: string, encodedHash: string): Promise<boolean> {
      assertPasswordInput(password);
      const pepper = resolvePepper();
      // Argon2 verify is constant-time for the crypto compare; no manual string compare.
      return argon2Verify(encodedHash, applyPepper(password, pepper));
    },

    needsRehash(encodedHash: string): boolean {
      return argon2NeedsRehash(encodedHash, {
        memoryCost: config.memoryCost,
        timeCost: config.timeCost,
        parallelism: config.parallelism,
        version: config.version,
      });
    },
  };
}

/** Default singleton — import as `passwordService` in app code. */
export const passwordService = createPasswordService();
