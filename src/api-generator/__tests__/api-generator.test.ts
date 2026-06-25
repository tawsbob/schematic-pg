// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { parse } from '../../schema-dsl/index.js';
import type { AppEnv } from '../../api/types.js';
import { generateAppFile } from '../app-generator.js';
import { generatePoliciesFile } from '../policy-generator.js';
import { generateRouteFiles, getRouteMountEntries } from '../route-generator.js';
import { generateValidationSchemas } from '../zod-schema-generator.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);
const missingCustomRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/missing-routes');
const fixtureCustomRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/custom-routes');

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

  it('generates list query schemas with default filterable fields and omit metadata', () => {
    const output = generateValidationSchemas(schema);

    assert.match(output, /export const UserListQuerySchema = z/);
    assert.match(output, /email_contains: z\.coerce\.string\(\)\.optional\(\)/);
    assert.match(output, /role_in: z\.coerce\.string\(\)\.optional\(\)/);
    assert.match(output, /export const USER_OMIT_FIELDS = \["passwordHash"\] as const;/);
    assert.match(output, /export type UserResponse = Omit<User, 'passwordHash'>;/);
    const userQueryFields =
      output.match(/export const USER_LIST_QUERY_FIELDS = (\[[\s\S]*?\]) as const;/)?.[1] ?? '';

    assert.doesNotMatch(userQueryFields, /"name": "id"/);
    assert.doesNotMatch(userQueryFields, /"name": "passwordHash"/);
    assert.doesNotMatch(userQueryFields, /"name": "updatedAt"/);
    assert.match(output, /export const PRODUCT_OMIT_FIELDS = \[\] as const;/);
    assert.match(output, /export type ProductResponse = Product;/);
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

  it('injects policy checks for models with @policy attributes', () => {
    const routes = generateRouteFiles(schema);
    const users = routes.get('users.ts');
    const logs = routes.get('logs.ts');

    assert.match(users!, /assertPolicy\('User', auth\.role, 'select'\)/);
    assert.match(users!, /resolvePolicyWhere\(policy, auth\)/);
    assert.match(users!, /mergeWhere\(\{ id: params\.id \}, policyWhere\)/);
    assert.doesNotMatch(logs!, /assertPolicy/);
    assert.doesNotMatch(logs!, /resolvePolicyWhere/);
  });

  it('generates list routes with query filters and omit wrappers on all handlers', () => {
    const routes = generateRouteFiles(schema);
    const users = routes.get('users.ts')!;
    const products = routes.get('products.ts')!;

    assert.match(users, /validateQuery\(UserListQuerySchema\)/);
    assert.match(users, /buildListQuery\(/);
    assert.match(users, /mergeWhere\(where, policyWhere\)/);
    assert.match(users, /omitFieldsMany\(rows, USER_OMIT_FIELDS\)/);
    assert.match(users, /omitFields\(row, USER_OMIT_FIELDS\)/);
    assert.match(users, /c\.json\(omitFields\(row, USER_OMIT_FIELDS\), 201\)/);

    assert.match(products, /validateQuery\(ProductListQuerySchema\)/);
    assert.match(products, /omitFieldsMany\(rows, PRODUCT_OMIT_FIELDS\)/);
    assert.doesNotMatch(products, /mergeWhere\(where, policyWhere\)/);
  });

  it('maps route mount entries for all models', () => {
    const mounts = getRouteMountEntries(schema);

    assert.deepEqual(
      mounts.map((entry) => entry.basePath),
      ['users', 'profiles', 'orders', 'logs', 'products', 'product-orders'],
    );
  });
});

describe('PolicyGenerator', () => {
  it('generates policy metadata from app.schema', () => {
    const output = generatePoliciesFile(schema);

    assert.match(output, /import type \{ NormalizedPolicy \} from 'schematic-pg\/api\/auth\/policy'/);
    assert.match(output, /export const POLICIES: Record<string, NormalizedPolicy\[\]> = \{/);
    assert.match(output, /role: 'USER', operations: \['select', 'insert', 'update'\]/);
    assert.match(output, /where: "id = \{\{auth\.user\.id\}\}"/);
    assert.match(output, /role: 'ADMIN', operations: 'all'/);
  });
});

describe('AppGenerator', () => {
  it('generates app entry with createApp export and conditional serve', () => {
    const output = generateAppFile(schema, { customRoutesDir: missingCustomRoutesDir });

    assert.match(output, /import \{ Hono \} from 'hono'/);
    assert.match(output, /import type \{ AppEnv \} from 'schematic-pg\/api\/types'/);
    assert.match(output, /import \{ createAuthMiddleware \} from 'schematic-pg\/api\/auth\/middleware'/);
    assert.match(output, /import \{ createDbClient \} from '\.\/db\.js'/);
    assert.match(output, /import \{ POLICIES \} from '\.\/policies\.js'/);
    assert.match(output, /import \{ configurePolicies \} from 'schematic-pg\/api\/auth\/policy'/);
    assert.match(output, /configurePolicies\(POLICIES\)/);
    assert.match(output, /app\.use\(createDbMiddleware\(\{ pool: options\.pool, createDbClient \}\)\)/);
    assert.match(output, /export function createApp\(options: CreateAppOptions = \{\}\): Hono<AppEnv>/);
    assert.match(output, /app\.use\(createAuthMiddleware\(options\.authResolver \?\? createJwtResolver\(\)\)\)/);
    assert.match(output, /import \{ logger \} from 'hono\/logger'/);
    assert.match(output, /import \{ prettyJSON \} from 'hono\/pretty-json'/);
    assert.match(output, /import \{ serve \} from '@hono\/node-server'/);
    assert.match(output, /app\.use\(logger\(\)\)/);
    assert.match(output, /app\.use\(prettyJSON\(\)\)/);
    assert.match(output, /app\.route\('\/users', usersRouter\)/);
    assert.match(output, /app\.route\('\/product-orders', productOrdersRouter\)/);
    assert.doesNotMatch(output, /import healthRouter from/);
    assert.match(output, /if \(isMain\)/);
    assert.match(output, /serve\(\{ fetch: createApp\(\)\.fetch, port \}/);
  });

  it('auto-imports custom routes from src/routes', () => {
    const output = generateAppFile(schema, { customRoutesDir: fixtureCustomRoutesDir });

    assert.match(output, /import healthRouter from '\.\.\/src\/routes\/health\.js'/);
    assert.match(output, /import webhooksStripeRouter from '\.\.\/src\/routes\/webhooks\/stripe\.js'/);
    assert.match(output, /app\.route\('\/health', healthRouter\)/);
    assert.match(output, /app\.route\('\/webhooks\/stripe', webhooksStripeRouter\)/);

    const usersMountIndex = output.indexOf("app.route('/users', usersRouter)");
    const healthMountIndex = output.indexOf("app.route('/health', healthRouter)");
    assert.ok(usersMountIndex >= 0);
    assert.ok(healthMountIndex > usersMountIndex);
  });

  it('fixture custom route responds when mounted on Hono', async () => {
    const { default: healthRouter } = await import('./fixtures/custom-routes/health.js');
    const app = new Hono<AppEnv>();
    app.route('/health', healthRouter);

    const response = await app.request('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});
