// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { generateAppFile } from '../app-generator.js';
import { generateRouteFiles, getRouteMountEntries } from '../route-generator.js';
import { generateValidationSchemas } from '../zod-schema-generator.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);

describe('ZodSchemaGenerator', () => {
  it('generates create schemas with regex and range messages from app.schema', () => {
    const output = generateValidationSchemas(schema);

    assert.match(output, /export const UserCreateSchema = z\.object\(/);
    assert.match(output, /message: 'Invalid email address'/);
    assert.match(output, /message: 'Age must be between 1 and 120'/);
    assert.match(output, /export const UserUpdateSchema = z\.object\(/);
    assert.match(output, /export const UserParamSchema = z\.object\(/);
    assert.match(output, /export const ProductOrderParamSchema = z\.object\(/);
  });
});

describe('RouteGenerator', () => {
  it('generates CRUD routes for all models', () => {
    const routes = generateRouteFiles(schema);

    assert.equal(routes.size, schema.models.length);

    for (const model of schema.models) {
      const normalizedName =
        model.name === 'User'
          ? 'users.ts'
          : model.name === 'Profile'
            ? 'profiles.ts'
            : model.name === 'Order'
              ? 'orders.ts'
              : model.name === 'Log'
                ? 'logs.ts'
                : model.name === 'Product'
                  ? 'products.ts'
                  : 'product-orders.ts';

      const content = routes.get(normalizedName);
      assert.ok(content, `missing route file for ${model.name}`);
      assert.match(content!, /router\.get\('\/'/);
      assert.match(content!, /router\.post\('\/'/);
      assert.match(content!, /router\.put\('/);
      assert.match(content!, /router\.delete\('/);
    }
  });

  it('generates composite primary key path params for ProductOrder', () => {
    const routes = generateRouteFiles(schema);
    const content = routes.get('product-orders.ts');

    assert.match(content!, /router\.get\('\/:orderId\/:productId'/);
    assert.match(content!, /findUnique\(\{ orderId: params\.orderId, productId: params\.productId \}\)/);
  });

  it('maps route mount entries for all models', () => {
    const mounts = getRouteMountEntries(schema);

    assert.deepEqual(
      mounts.map((entry) => entry.basePath),
      ['users', 'profiles', 'orders', 'logs', 'products', 'product-orders'],
    );
  });
});

describe('AppGenerator', () => {
  it('generates app entry with logger, prettyJSON, routes, and serve', () => {
    const output = generateAppFile(schema);

    assert.match(output, /import \{ Hono \} from 'hono'/);
    assert.match(output, /import \{ logger \} from 'hono\/logger'/);
    assert.match(output, /import \{ prettyJSON \} from 'hono\/pretty-json'/);
    assert.match(output, /import \{ serve \} from '@hono\/node-server'/);
    assert.match(output, /app\.use\(logger\(\)\)/);
    assert.match(output, /app\.use\(prettyJSON\(\)\)/);
    assert.match(output, /app\.route\('\/users', usersRouter\)/);
    assert.match(output, /app\.route\('\/product-orders', productOrdersRouter\)/);
    assert.match(output, /const port = Number\(process\.env\.PORT \?\? 3000\)/);
    assert.match(output, /serve\(\{ fetch: app\.fetch, port \}/);
  });
});
