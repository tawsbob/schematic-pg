import { cors } from 'hono/cors';
const DEFAULT_CORS_ALLOW_HEADERS = ['Authorization', 'Content-Type', 'X-CSRF-Token'];
const CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const CORS_MAX_AGE_SECONDS = 86400;
function parseCommaSeparatedList(raw) {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) {
        return [];
    }
    return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
export function parseCorsOrigin(raw = process.env.CORS_ORIGIN) {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) {
        return null;
    }
    if (trimmed === '*') {
        return '*';
    }
    const origins = parseCommaSeparatedList(trimmed);
    if (origins.length === 0) {
        return null;
    }
    return origins.length === 1 ? origins[0] : origins;
}
/** Extra headers from `CORS_ALLOW_HEADERS` (comma-separated). Does not include defaults. */
export function parseCorsAllowHeaders(raw = process.env.CORS_ALLOW_HEADERS) {
    return parseCommaSeparatedList(raw);
}
function resolveAllowHeaders(optionsAllowHeaders) {
    if (optionsAllowHeaders !== undefined) {
        return optionsAllowHeaders;
    }
    const extras = parseCorsAllowHeaders();
    if (extras.length === 0) {
        return DEFAULT_CORS_ALLOW_HEADERS;
    }
    const seen = new Set(DEFAULT_CORS_ALLOW_HEADERS.map((header) => header.toLowerCase()));
    const merged = [...DEFAULT_CORS_ALLOW_HEADERS];
    for (const header of extras) {
        const key = header.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(header);
    }
    return merged;
}
export function createCorsMiddleware(options = {}) {
    const origin = options.origin !== undefined ? options.origin : parseCorsOrigin();
    if (origin == null) {
        return async (_c, next) => {
            await next();
        };
    }
    const allowHeaders = resolveAllowHeaders(options.allowHeaders);
    const credentials = origin !== '*';
    return cors({
        origin,
        credentials,
        allowHeaders,
        allowMethods: CORS_ALLOW_METHODS,
        maxAge: CORS_MAX_AGE_SECONDS,
    });
}
