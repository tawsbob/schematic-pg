import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
export declare function parseCorsOrigin(raw?: string | undefined): string | string[] | null;
export declare function createCorsMiddleware(options?: {
    origin?: string | string[] | null;
}): MiddlewareHandler<AppEnv>;
