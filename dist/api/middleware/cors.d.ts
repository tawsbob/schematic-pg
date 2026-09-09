import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
export declare function parseCorsOrigin(raw?: string | undefined): string | string[] | null;
/** Extra headers from `CORS_ALLOW_HEADERS` (comma-separated). Does not include defaults. */
export declare function parseCorsAllowHeaders(raw?: string | undefined): string[];
export declare function createCorsMiddleware(options?: {
    origin?: string | string[] | null;
    allowHeaders?: string[];
}): MiddlewareHandler<AppEnv>;
