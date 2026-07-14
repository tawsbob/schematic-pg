import { type PasswordConfig } from './config.js';
export interface PasswordService {
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, encodedHash: string): Promise<boolean>;
    needsRehash(encodedHash: string): boolean;
}
/**
 * Factory for the password service.
 * Uses Argon2id with automatic salt; output is the full `$argon2id$…` encoded string
 * (algo, version, params, salt, hash) so verify never needs a separate salt column.
 */
export declare function createPasswordService(config?: PasswordConfig): PasswordService;
/** Default singleton — import as `passwordService` in app code. */
export declare const passwordService: PasswordService;
