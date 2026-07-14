import type { Hono } from 'hono';

const SCALAR_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Reference</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/openapi.json',
      });
    </script>
  </body>
</html>
`;

/**
 * Mounts public API docs routes:
 * - GET /openapi.json — OpenAPI document
 * - GET /docs — Scalar API reference UI (CDN)
 */
export function mountApiDocs(app: Hono, document: object): void {
  app.get('/openapi.json', (c) => c.json(document));
  app.get('/docs', (c) => c.html(SCALAR_HTML));
}
