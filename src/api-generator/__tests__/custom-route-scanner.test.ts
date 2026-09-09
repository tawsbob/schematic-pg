// Run: npm test

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { discoverCustomRoutes, partitionCustomRoutes } from '../custom-route-scanner.js';

const fixtureRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/custom-routes');
const fixtureOverlayRoutesDir = path.resolve(
  'src/api-generator/__tests__/fixtures/custom-routes-overlay',
);

describe('discoverCustomRoutes', () => {
  it('returns an empty list when the directory is missing', () => {
    const entries = discoverCustomRoutes(path.resolve('src/api-generator/__tests__/fixtures/missing-routes'));

    assert.deepEqual(entries, []);
  });

  it('discovers flat custom route files', () => {
    const entries = discoverCustomRoutes(fixtureRoutesDir);
    const health = entries.find((entry) => entry.basePath === 'health');

    assert.ok(health);
    assert.equal(health.importName, 'healthRouter');
    assert.equal(health.importPath, '../src/routes/health.js');
    assert.equal(health.routeImportPath, '../../src/routes/health.js');
  });

  it('discovers nested custom route files', () => {
    const entries = discoverCustomRoutes(fixtureRoutesDir);
    const stripe = entries.find((entry) => entry.basePath === 'webhooks/stripe');

    assert.ok(stripe);
    assert.equal(stripe.importName, 'webhooksStripeRouter');
    assert.equal(stripe.importPath, '../src/routes/webhooks/stripe.js');
  });

  it('returns entries sorted by basePath', () => {
    const entries = discoverCustomRoutes(fixtureRoutesDir);

    assert.deepEqual(
      entries.map((entry) => entry.basePath),
      ['health', 'webhooks/stripe'],
    );
  });
});

describe('partitionCustomRoutes', () => {
  it('treats model base paths as overlays and other paths as standalone', () => {
    const schema = parse(`
extensions {}
enums {}
models {
  model User {
    id: UUID @id
  }
}
`);
    const entries = [
      ...discoverCustomRoutes(fixtureRoutesDir),
      ...discoverCustomRoutes(fixtureOverlayRoutesDir),
    ];
    const { overlays, standalone } = partitionCustomRoutes(entries, schema);

    assert.ok(overlays.has('User'));
    assert.deepEqual(
      standalone.map((entry) => entry.basePath),
      ['health', 'webhooks/stripe'],
    );
  });
});
