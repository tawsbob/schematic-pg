// Run: npm test

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadRepoSchema } from '../../__tests__/helpers/repo-schema.js';
import { parse } from '../../schema-dsl/index.js';
import { Hono } from 'hono';
import type { AppEnv } from '../../api/types.js';
import { generateAppFile } from '../app-generator.js';
import { discoverCustomRoutes, partitionCustomRoutes } from '../custom-route-scanner.js';
import { generateHooksFile } from '../hooks-generator.js';
import { discoverHooks } from '../hook-scanner.js';
import { generatePoliciesFile } from '../policy-generator.js';
import { generateRouteFiles, getRouteMountEntries } from '../route-generator.js';
import { generateValidationSchemas } from '../zod-schema-generator.js';

const { schema } = loadRepoSchema();
const missingCustomRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/missing-routes');
const fixtureCustomRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/custom-routes');
const fixtureOverlayRoutesDir = path.resolve('src/api-generator/__tests__/fixtures/custom-routes-overlay');
const fixtureHooksDir = path.resolve('src/api-generator/__tests__/fixtures/hooks');

const modelRouteFile: Record<string, string> = {
  User: 'users.ts',
  Profile: 'profiles.ts',
  Order: 'orders.ts',
  Log: 'logs.ts',
  Product: 'products.ts',
  ProductOrder: 'product-orders.ts',
  Note: 'notes.ts',
  Announcement: 'announcements.ts',
};

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
    assert.match(output, /export const USER_INCLUDABLE_RELATIONS = \{/);
    assert.match(output, /export const UserGetQuerySchema = z/);
    assert.match(output, /include: z\.string\(\)\.optional\(\)/);
    assert.match(output, /export const API_OMIT_FIELDS_BY_MODEL = \{/);
    assert.match(output, /export const API_RELATION_TARGETS = \{/);
    assert.match(output, /export type UserResponse = Omit<User, 'passwordHash'>;/);
    const userQueryFields =
      output.match(/export const USER_LIST_QUERY_FIELDS = (\[[\s\S]*?\]) as const;/)?.[1] ?? '';

    assert.doesNotMatch(userQueryFields, /"name": "id"/);
    assert.doesNotMatch(userQueryFields, /"name": "passwordHash"/);
    assert.doesNotMatch(userQueryFields, /"name": "updatedAt"/);
    assert.match(output, /export const PRODUCT_OMIT_FIELDS = \[\] as const;/);
    assert.match(output, /export type ProductResponse = Product;/);

    const userListQuerySchema =
      output.match(/export const UserListQuerySchema = z[\s\S]*?}\);/)?.[0] ?? '';
    assert.doesNotMatch(userListQuerySchema, /isActive: z\.boolean\(\)\.optional\(\)/);
    assert.match(
      userListQuerySchema,
      /isActive: z\.preprocess\([\s\S]*?z\.union\(\[z\.boolean\(\), z\.enum\(\['true', 'false'\]\)\]\)/,
    );
  });
});

describe('RouteGenerator', () => {
  it('generates full CRUD for models without @rest, and read-only for User', () => {
    const routes = generateRouteFiles(schema);
    const routableModels = schema.models.filter((model) => modelRouteFile[model.name]);

    assert.equal(routes.size, routableModels.length);

    for (const model of routableModels) {
      const normalizedName = modelRouteFile[model.name]!;
      const content = routes.get(normalizedName);
      assert.ok(content, `missing route file for ${model.name}`);
      assert.match(content!, /router\.get\('\/'/);

      if (model.name === 'User') {
        assert.match(content!, /router\.get\('\/:id'/);
        assert.doesNotMatch(content!, /router\.post\('\/'/);
        assert.doesNotMatch(content!, /router\.put\('/);
        assert.doesNotMatch(content!, /router\.delete\('/);
      } else {
        assert.match(content!, /router\.post\('\/'/);
        assert.match(content!, /router\.put\('/);
        assert.match(content!, /router\.delete\('/);
      }
    }
  });

  it('omits route files for @rest(false) models without overlays', () => {
    const hidden = parse(`
extensions {}
enums {}
models {
  model Hidden {
    id: UUID @id
    @rest(false)
  }
}
`);
    const routes = generateRouteFiles(hidden);
    assert.equal(routes.size, 0);
    assert.deepEqual(getRouteMountEntries(hidden), []);
  });

  it('merges same-path custom overlays into generated model routers', () => {
    const { overlays, standalone } = partitionCustomRoutes(
      discoverCustomRoutes(fixtureOverlayRoutesDir),
      schema,
    );

    assert.ok(overlays.has('User'));
    assert.equal(standalone.length, 0);

    const routes = generateRouteFiles(schema, { overlays });
    const users = routes.get('users.ts')!;
    assert.match(users, /import usersRouterOverlay from '\.\.\/\.\.\/src\/routes\/users\.js'/);
    assert.match(users, /router\.route\('\/', usersRouterOverlay\)/);
    assert.doesNotMatch(users, /router\.post\('\/'/);

    const app = generateAppFile(schema, {
      customRoutesDir: fixtureOverlayRoutesDir,
      standaloneCustomRoutes: standalone,
      overlays,
    });
    assert.doesNotMatch(app, /import usersRouter from '\.\.\/src\/routes\/users\.js'/);
    assert.match(app, /app\.route\('\/users', usersRouter\)/);
  });

  it('generated GET and overlay POST share the same mount', async () => {
    const { default: overlayRouter } = await import('./fixtures/custom-routes-overlay/users.js');
    const app = new Hono<AppEnv>();
    const generated = new Hono<AppEnv>();
    generated.get('/', (c) => c.json({ generated: true }));
    generated.route('/', overlayRouter);
    app.route('/users', generated);

    const getResponse = await app.request('/users');
    assert.equal(getResponse.status, 200);
    assert.deepEqual(await getResponse.json(), { generated: true });

    const postResponse = await app.request('/users', { method: 'POST' });
    assert.equal(postResponse.status, 201);
    assert.deepEqual(await postResponse.json(), { overlay: true });
  });

  it('generates composite primary key path params for ProductOrder', () => {
    const routes = generateRouteFiles(schema);
    const content = routes.get('product-orders.ts');

    assert.match(content!, /router\.get\('\/:orderId\/:productId'/);
    assert.match(content!, /findUnique\(\{ orderId: params\.orderId, productId: params\.productId \}, \{ include \}\)/);
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

  it('passes policyWhere into create when insert is generated with policies', () => {
    const policyModel = parse(`
extensions {}
enums {}
models {
  model PolicySource {
    id: UUID @id
    @policy(role: USER, allow: [insert], where: "owner_id = {{auth.user.id}}")
  }
}
`).models[0]!;
    const policyAttribute = policyModel.attributes.find((attribute) => attribute.name === 'policy');
    assert.ok(policyAttribute);

    const withPolicy = {
      ...schema,
      models: schema.models.map((model) => {
        if (model.name !== 'Product') {
          return model;
        }

        return {
          ...model,
          attributes: [...model.attributes, policyAttribute],
        };
      }),
    };

    const routes = generateRouteFiles(withPolicy);
    const products = routes.get('products.ts')!;

    assert.match(products, /assertPolicy\('Product', auth\.role, 'insert'\)/);
    assert.match(products, /resolvePolicyWhere\(policy, auth\)/);
    assert.match(products, /create\(body, \{ where: policyWhere \}\)/);
  });

  it('generates list routes with query filters and omit wrappers on write handlers', () => {
    const routes = generateRouteFiles(schema);
    const users = routes.get('users.ts')!;
    const products = routes.get('products.ts')!;

    assert.match(users, /validateQuery\(UserListQuerySchema\)/);
    assert.match(users, /validateQuery\(UserGetQuerySchema\)/);
    assert.match(users, /buildReadQuery\(/);
    assert.match(users, /parseIncludeQuery\(/);
    assert.match(users, /shapeResponseMany\(rows, 'User'/);
    assert.match(users, /shapeResponse\(row, 'User'/);
    assert.match(users, /mergeWhere\(where, policyWhere\)/);
    assert.doesNotMatch(users, /omitFields\(row, USER_OMIT_FIELDS\)/);

    assert.match(products, /validateQuery\(ProductListQuerySchema\)/);
    assert.match(products, /shapeResponseMany\(rows, 'Product'/);
    assert.match(products, /omitFields\(row, PRODUCT_OMIT_FIELDS\)/);
    assert.match(products, /c\.json\(omitFields\(row, PRODUCT_OMIT_FIELDS\), 201\)/);
    assert.doesNotMatch(products, /mergeWhere\(where, policyWhere\)/);
  });

  it('maps route mount entries for all models', () => {
    const mounts = getRouteMountEntries(schema);

    assert.deepEqual(
      mounts.map((entry) => entry.basePath),
      [
        'announcements',
        'logs',
        'notes',
        'orders',
        'products',
        'product-orders',
        'profiles',
        'users',
      ],
    );
  });

  it('injects lifecycle hook wiring only for writable models with hook files', () => {
    const { modelsWithHooks } = discoverHooks(fixtureHooksDir, schema);
    const routes = generateRouteFiles(schema, modelsWithHooks);
    const users = routes.get('users.ts')!;
    const logs = routes.get('logs.ts')!;
    const products = routes.get('products.ts')!;

    assert.doesNotMatch(users, /runBeforeHooks/);
    assert.doesNotMatch(users, /runAfterHooks/);

    assert.match(logs, /import \{ cancelledResponse, createHookContext, runAfterHooks, runBeforeHooks \}/);
    assert.match(logs, /const hookCtx = createHookContext\(\{ c, db, auth, model: 'Log', operation: 'create', data: body \}\)/);
    assert.match(logs, /const gate = await runBeforeHooks\('Log', 'create', hookCtx\)/);
    assert.match(logs, /if \(!gate\.proceed\) return gate\.response \?\? cancelledResponse\(c\)/);
    assert.match(logs, /await db\.log\.create\(hookCtx\.data\)/);
    assert.match(logs, /await runAfterHooks\('Log', 'update', hookCtx\)/);
    assert.match(logs, /await runAfterHooks\('Log', 'delete', hookCtx\)/);

    assert.doesNotMatch(products, /runBeforeHooks/);
    assert.doesNotMatch(products, /runAfterHooks/);
  });
});

describe('PolicyGenerator', () => {
  it('generates policy metadata from app.schema', () => {
    const output = generatePoliciesFile(schema);

    assert.match(output, /import type \{ NormalizedPolicy \} from 'schematic-pg\/api\/auth\/policy'/);
    assert.match(output, /export const POLICIES: Record<string, NormalizedPolicy\[\]> = \{/);
    assert.match(output, /role: 'USER', operations: \['select'\]/);
    assert.match(output, /where: "id = \{\{auth\.user\.id\}\}"/);
    assert.match(output, /role: 'ADMIN', operations: 'all'/);
  });
});

describe('HooksGenerator', () => {
  it('generates hook registry metadata from discovered hook files', () => {
    const { entries } = discoverHooks(fixtureHooksDir, schema);
    const output = generateHooksFile(entries);

    assert.match(output, /import userHooks from '\.\.\/src\/hooks\/User\.js';/);
    assert.match(output, /export const HOOKS = \{/);
    assert.match(output, /User: userHooks,/);
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
    assert.match(output, /import \{ HOOKS \} from '\.\/hooks\.js'/);
    assert.match(output, /import \{ configurePolicies \} from 'schematic-pg\/api\/auth\/policy'/);
    assert.match(output, /import \{ configureHooks \} from 'schematic-pg\/api\/hooks'/);
    assert.match(output, /configurePolicies\(POLICIES\)/);
    assert.match(output, /configureHooks\(HOOKS\)/);
    assert.match(output, /import \{ createCorsMiddleware \} from 'schematic-pg\/api\/middleware\/cors'/);
    assert.match(output, /app\.use\(createCorsMiddleware\(\)\)/);
    assert.match(output, /app\.use\(createDbMiddleware\(\{ pool: options\.pool, createDbClient \}\)\)/);
    assert.match(output, /export function createApp\(options: CreateAppOptions = \{\}\): Hono<AppEnv>/);
    assert.match(output, /app\.use\(createAuthMiddleware\(options\.authResolver \?\? createJwtResolver\(\)\)\)/);
    const corsUseIndex = output.indexOf('app.use(createCorsMiddleware())');
    const docsMountIndex = output.indexOf('mountApiDocs(app, openApiDocument)');
    assert.ok(corsUseIndex >= 0 && corsUseIndex < docsMountIndex);
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
