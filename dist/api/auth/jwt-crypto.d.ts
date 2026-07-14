/** HS256 only — matches createJwtResolver / createTokenService. */
export declare const JWT_ALGORITHM = "HS256";
export declare function base64UrlEncode(value: string | Buffer): string;
export declare function base64UrlDecode(value: string): Buffer;
export declare function signHs256Jwt(payload: Record<string, unknown>, secret: string): string;
/**
 * Verify HS256 signature and optional exp/nbf.
 * Tokens without exp/nbf remain valid (backward compatible with older test JWTs).
 */
export declare function verifyHs256Jwt(token: string, secret: string, nowSeconds?: number): Record<string, unknown>;
