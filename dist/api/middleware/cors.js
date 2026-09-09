import { cors } from 'hono/cors';
const CORS_ALLOW_HEADERS = ['Authorization', 'Content-Type'];
const CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const CORS_MAX_AGE_SECONDS = 86400;
export function parseCorsOrigin(raw = process.env.CORS_ORIGIN) {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) {
        return null;
    }
    if (trimmed === '*') {
        return '*';
    }
    const origins = trimmed
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    if (origins.length === 0) {
        return null;
    }
    return origins.length === 1 ? origins[0] : origins;
}
export function createCorsMiddleware(options = {}) {
    const origin = options.origin !== undefined ? options.origin : parseCorsOrigin();
    if (origin == null) {
        return async (_c, next) => {
            await next();
        };
    }
    return cors({
        origin,
        allowHeaders: CORS_ALLOW_HEADERS,
        allowMethods: CORS_ALLOW_METHODS,
        maxAge: CORS_MAX_AGE_SECONDS,
    });
}
