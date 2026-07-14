import type { Hono } from 'hono';
/**
 * Mounts public API docs routes:
 * - GET /openapi.json — OpenAPI document
 * - GET /docs — Scalar API reference UI (CDN)
 */
export declare function mountApiDocs(app: Hono, document: object): void;
