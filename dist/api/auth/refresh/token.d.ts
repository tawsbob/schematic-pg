/** Opaque refresh token as base64url (no padding). */
export declare function generateRefreshToken(byteLength?: number): string;
/** SHA-256 hex digest of the raw refresh token (what we store in Postgres). */
export declare function hashRefreshToken(rawToken: string): string;
