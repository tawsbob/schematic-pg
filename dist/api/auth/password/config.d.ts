import { argon2id } from 'argon2';
/**
 * Argon2id (hybrid) resists both GPU/ASIC cracking and side-channel leaks better
 * than pure argon2i/argon2d for password storage (OWASP Password Storage Cheat Sheet).
 * Version 19 (0x13) is the current Argon2 RFC reference version.
 */
export declare const ARGON2_VERSION = 19;
/**
 * Single source of truth for hash parameters. Do not scatter these literals.
 * memoryCost 65536 = 64 MiB; timeCost 3 ≈ interactive login cost.
 */
export declare const DEFAULT_PASSWORD_CONFIG: {
    readonly memoryCost: 65536;
    readonly timeCost: 3;
    readonly parallelism: number;
    readonly type: 2;
    readonly version: 19;
};
export type PasswordConfig = {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
    type: typeof argon2id;
    version: number;
};
/** Pepper is application-side secret; never persisted with the hash. */
export declare function resolvePepper(env?: NodeJS.ProcessEnv): string;
/**
 * Bind password to the app by appending pepper before hash/verify.
 * Compromise of the hash DB alone is insufficient without AUTH_PEPPER.
 */
export declare function applyPepper(password: string, pepper: string): string;
