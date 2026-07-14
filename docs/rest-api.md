# REST API

A Hono-based HTTP layer generated from your schema AST. Each model gets a router with full CRUD endpoints. Request bodies and path parameters are validated with Zod schemas derived from field types and `@regex` / `@range` attributes — validation error messages come directly from the `message` parameter in your schema.

## Generate

```bash
npx schematic-pg generate:api
# or: npm run generate:api
```

Requires `generate:client` first (routes call `createDbClient` from `generated/db.ts`). Use `npx schematic-pg generate` to run both.

Outputs:

| File | Purpose |
|------|---------|
| `generated/app.ts` | Hono app entry point — mounts routers, auth + DB middleware, starts the server |
| `generated/policies.ts` | Per-model ACL metadata derived from `@policy` attributes |
| `generated/schemas/validation.ts` | Per-model Zod schemas: `{Model}CreateSchema`, `{Model}UpdateSchema`, `{Model}ParamSchema` |
| `generated/routes/*.ts` | One Hono router per model with GET / POST / PUT / DELETE handlers |
| `src/routes/*.ts` | *(hand-written)* Custom Hono routers auto-imported into `generated/app.ts` on each `generate:api` run |

## Start the server

```bash
npx schematic-pg dev
# or: npm run dev
# → regenerates client + API, then starts http://localhost:3000
```

For production (no regenerate, no schema watch):

```bash
npx schematic-pg start
# or: npm run start
# → waits for DB, applies pending migrations, starts http://localhost:3000
```

Or run the generated entry point directly after generation (skips migration wait):

```bash
npx tsx generated/app.ts
```

Environment variables (also see [Quick Start](../README.md#quick-start)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — (required) | PostgreSQL connection string (loaded from `.env`) |
| `PORT` | `3000` | HTTP listen port |
| `JWT_SECRET` | — | HMAC secret for the default Bearer JWT resolver |
| `JWT_ROLE_CLAIM` | `role` | JWT claim mapped to `auth.role` |
| `JWT_USER_ID_CLAIM` | `sub` | JWT claim mapped to `auth.user.id` |

The server uses `@hono/node-server` and connects via a shared `pg` `Pool`. The DB client and auth context are injected into every request through Hono context (`c.get('db')`, `c.get('auth')`).

## Routes

Each model in `app.schema` maps to a kebab-case plural base path. Handlers delegate to the generated DB client — no ORM, same parameterized SQL as the client layer.

| Model | Base path | Primary key route |
|-------|-----------|-------------------|
| `User` | `/users` | `/users/:id` |
| `Profile` | `/profiles` | `/profiles/:id` |
| `Order` | `/orders` | `/orders/:id` |
| `Log` | `/logs` | `/logs/:id` |
| `Product` | `/products` | `/products/:id` |
| `ProductOrder` | `/product-orders` | `/product-orders/:orderId/:productId` |

Models with composite primary keys (`@@id(fields: [...])`) expose one path segment per key field.

## Custom routes

Not every endpoint maps to a CRUD model. For auth flows, webhooks, health checks, or other app-specific handlers, add hand-written Hono routers under `src/routes/`. Running `schematic-pg generate:api` (or `schematic-pg dev`) discovers these files and wires them into `generated/app.ts` — same global middleware (`db`, `auth`, error handling) as schema-generated routes.

**Convention**

| Rule | Example |
|------|---------|
| Location | `src/routes/**/*.ts` |
| Export | `export default router` where `router` is `Hono<AppEnv>` |
| Mount path | File path relative to `src/routes/`, without extension |
| Regenerate | `schematic-pg generate:api` or `schematic-pg dev` after adding or renaming files |

**Path mapping**

| File | Mounted at |
|------|------------|
| `src/routes/health.ts` | `/health` |
| `src/routes/webhooks/stripe.ts` | `/webhooks/stripe` |

**Example** — `src/routes/health.ts`:

```typescript
import { Hono } from 'hono';
import type { AppEnv } from 'schematic-pg/api/types';

const router = new Hono<AppEnv>();

router.get('/', (c) => c.json({ ok: true }));

export default router;
```

After `schematic-pg generate:api`, `generated/app.ts` includes:

```typescript
import healthRouter from '../src/routes/health.js';
// ...
app.route('/health', healthRouter);
```

Custom routes are mounted **after** all schema-generated routers. Handlers can use the same request context as generated routes:

```typescript
router.get('/me', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth');
  // ...
});
```

**Skipped files** — The scanner ignores `*.test.ts`, `*.d.ts`, and any file or directory whose name starts with `_`.

**Do not edit** `generated/app.ts` manually for custom routes — add files under `src/routes/` and regenerate.

## Lifecycle hooks

Run business logic before or after write operations (POST, PUT, DELETE) without editing generated route files. Hooks live under `src/hooks/` and are discovered when you run `schematic-pg generate:api` (or `schematic-pg dev`).

**Convention**

| Rule | Example |
|------|---------|
| Location | `src/hooks/{Model}.ts` (PascalCase model name) |
| Export | `export default defineHooks(...)` |
| Scaffold | `schematic-pg hooks:add` (interactive model picker) |
| Regenerate | `schematic-pg generate:api` or `schematic-pg dev` after adding or editing hooks |

**Request flow**

```
validate → assertPolicy → beforeHooks (can cancel) → db.create/update/delete → afterHooks → response
```

Before-hooks run after policy checks — unauthorized requests never execute hook logic. After-hooks see the DB result and can mutate `ctx.result` before the response is sent.

**`next()` contract**

| Action | Effect |
|--------|--------|
| `await next()` | Proceed to the next hook, or to the DB operation when all hooks call `next()` |
| `return ctx.abort(status, message)` | Cancel; return that JSON error response; DB untouched |
| `return ctx.json(body, status)` | Cancel with a custom response body |
| Return without calling `next()` | Cancel with default `409` |
| `throw` | Cancel; mapped by global error handler |

**Scaffold a hook file**

```bash
schematic-pg hooks:add          # interactive — pick a model
schematic-pg hooks:add --model User
# edit src/hooks/User.ts — delete unused hooks
schematic-pg generate:api
```

**Example** — `src/hooks/User.ts`:

```typescript
import { defineHooks } from 'schematic-pg/api/hooks';
import type { User, UserCreateInput, UserUpdateInput } from '../../generated/db-types.js';

export default defineHooks<User, UserCreateInput, UserUpdateInput>({
  async beforeCreate(ctx, next) {
    ctx.data.email = ctx.data.email.toLowerCase();
    if (ctx.data.balance < 0) {
      return ctx.abort(422, 'balance must be >= 0');
    }
    await next();
  },

  async afterCreate(ctx) {
    await ctx.db.log.create({
      level: 'info',
      message: `User created: ${ctx.result.id}`,
    });
  },

  async beforeDelete(ctx, next) {
    if (ctx.auth.role !== 'ADMIN') {
      return ctx.abort(403, 'Only admins can delete users');
    }
    await next();
  },
});
```

After `schematic-pg generate:api`, `generated/routes/users.ts` wraps POST/PUT/DELETE with hook calls, and `generated/app.ts` loads the registry:

```typescript
import { HOOKS } from './hooks.js';
import { configureHooks } from 'schematic-pg/api/hooks';
// ...
configureHooks(HOOKS);
```

**Hook context**

| Field | beforeCreate / beforeUpdate | beforeDelete | after* |
|-------|----------------------------|--------------|--------|
| `ctx.data` | Create/update payload (mutable) | — | — |
| `ctx.params` | Route params (`:id`, composite PK fields) | Route params | Route params |
| `ctx.result` | — | — | DB row (mutable) |
| `ctx.auth` | JWT auth context | JWT auth context | JWT auth context |
| `ctx.db` | Generated DB client | Generated DB client | Generated DB client |
| `ctx.abort(status, msg)` | Cancel with JSON error | Cancel with JSON error | — |
| `ctx.json(body, status)` | Cancel with custom body | Cancel with custom body | — |

**Skipped files** — The scanner ignores `*.test.ts`, `*.d.ts`, and any file whose name starts with `_`.

**Do not edit** generated route hook wiring manually — add or edit files under `src/hooks/` and regenerate.

## Endpoints

Every router exposes the same CRUD shape. Models with `@policy` attributes enforce role checks and row-level filters on every handler; models without policies behave as open endpoints. See [Access control](access-control.md) for policy syntax and enforcement.

| Method | Path | Handler | Validation |
|--------|------|---------|------------|
| `GET` | `/` | `findMany({ where: mergeWhere(queryWhere, policyWhere), orderBy, take, skip, include })` | Query params |
| `GET` | `/{pk}` | `findUnique(mergeWhere(pk, policyWhere), { include })` | Path params + query params |
| `POST` | `/` | `create(body)` — policy check only | JSON body |
| `PUT` | `/{pk}` | `update({ where: mergeWhere(pk, policyWhere), data })` | Path params + JSON body |
| `DELETE` | `/{pk}` | `delete(mergeWhere(pk, policyWhere))` | Path params |

`POST` returns `201 Created`. Missing records on `GET` return `404`. All handlers strip `@omit` fields from JSON responses before returning.

## Query filters (`GET /`)

All stored scalar fields are URL-filterable by default. Opt out with `@unfilterable` on a field. Fields marked `@omit` are never filterable.

Query params use **API field names** (camelCase), not SQL column names:

| Param | Maps to |
|-------|---------|
| `?role=ADMIN` | `{ role: 'ADMIN' }` |
| `?email_contains=@` | `{ email: { contains: '@' } }` |
| `?balance_gte=100` | `{ balance: { gte: 100 } }` |
| `?role_in=ADMIN,USER` | `{ role: { in: ['ADMIN', 'USER'] } }` |
| `?limit=20` | `take: 20` (max 100) |
| `?offset=40` | `skip: 40` |
| `?sort=-createdAt` | `orderBy: { createdAt: 'desc' }` |
| `?include=profile,orders` | `include: { profile: true, orders: true }` |
| `?include=orders.products.product` | nested boolean includes |

On models with `@policy`, user filters are combined with the policy row filter via `mergeWhere` (AND). A USER calling `GET /users?role=ADMIN` still only sees rows allowed by policy.

```bash
curl "http://localhost:3000/products?category=books&limit=10"
curl "http://localhost:3000/users?role=USER&isActive=true" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/users/USER_ID?include=profile,orders" -H "Authorization: Bearer $TOKEN"
```

## Relation includes (`GET /`, `GET /{pk}`)

Load related models via the `include` query param. Paths are comma-separated; use dots for nesting:

```bash
curl "http://localhost:3000/users?include=profile,orders"
curl "http://localhost:3000/users/USER_ID?include=orders.products.product"
```

Each segment must name a relation field on the current model (or nested target model). Unknown relations return `400`. Maximum depth and path count are capped (see `MAX_INCLUDE_DEPTH` / `MAX_INCLUDE_PATHS` in the runtime).

Opt out of HTTP includes on a relation field with `@unincludeable`:

```ts
orders: Order[] @unincludeable
```

**v1 limits:**

- Boolean includes only — no nested `where`, `take`, or `skip` via URL (use the DB client or a custom route for that).
- `@policy` row filters apply to the **root** model only; included relations are not policy-filtered separately.
- `@omit` fields are stripped recursively on nested included objects in read responses.

## Response shaping (`@omit`)

Mark sensitive stored fields with `@omit` to exclude them from generated route JSON responses. On read endpoints with `include`, omitted fields are stripped recursively on nested relation objects as well. Mutation responses (`POST`, `PUT`, `DELETE`) strip `@omit` fields on the root model only. The ORM client still returns full entities.

```ts
passwordHash: VARCHAR(255) @omit @unfilterable @default("")
```

Generated types include `{Model}Response` (for example `UserResponse = Omit<User, 'passwordHash'>`) in `generated/schemas/validation.ts`.

## Validation

Zod schemas are generated from stored fields (relation fields are excluded). Rules from the DSL:

```ts
email: VARCHAR(255) @regex(pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$", message: "Invalid email address")
age:   SMALLINT?    @range(min: 1, max: 120, message: "Age must be between 1 and 120")
```

Become generated validators with the same messages:

```typescript
email: z.string().regex(/^[\w.-]+@[\w.-]+\.\w+$/, { message: 'Invalid email address' }),
age:   z.number().int().min(1, { message: 'Age must be between 1 and 120' }).max(120, { message: 'Age must be between 1 and 120' }).nullable().optional(),
```

Validation runs through middleware in `src/api/middleware/validate.ts`. On failure the API responds with:

```json
{ "error": "Invalid email address" }
```

Fields with `@default` or optional (`?`) types are optional on create. Update schemas make all non-PK fields optional (partial updates).

## Example requests

```bash
# Health check (custom route from src/routes/health.ts)
curl http://localhost:3000/health

# List users with filters
curl "http://localhost:3000/users?role=USER&limit=10"

# List users
curl http://localhost:3000/users

# Get one user
curl http://localhost:3000/users/{uuid}

# Create a user
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","name":"Alice","balance":0}'

# Validation failure (schema message returned)
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email","name":"Alice","balance":0}'
# → {"error":"Invalid email address"}

# Update a user
curl -X PUT http://localhost:3000/users/{uuid} \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice Updated"}'

# Delete a user
curl -X DELETE http://localhost:3000/users/{uuid}

# Composite primary key
curl http://localhost:3000/product-orders/{orderId}/{productId}
```

## Error responses

| Status | When |
|--------|------|
| `400` | Zod validation failure or foreign key violation |
| `401` | Malformed or invalid JWT (when `Authorization: Bearer` is present) |
| `403` | Role not allowed for the requested operation (`@policy` denial) |
| `404` | Record not found on `GET`, or delete/update returned no rows |
| `409` | Unique constraint violation |
| `500` | Other database errors |

Global error handling lives in `src/api/middleware/errors.ts` and maps the same typed exceptions as the DB client layer.

## App configuration

The generated `app.ts` sets up:

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

const app = new Hono<AppEnv>();
app.use(logger());
app.use(prettyJSON());
app.use(createDbMiddleware());     // injects db from DATABASE_URL
app.use(createAuthMiddleware());   // injects auth (default: Bearer JWT)
app.onError(handleError);

app.route('/users', usersRouter);
// ... all generated routers
app.route('/health', healthRouter);
// ... all custom routers from src/routes/
```

## Runtime architecture

Generated routes and schemas are thin wrappers. The HTTP runtime ships inside the `schematic-pg` package (`schematic-pg/api/*`). In this repository, the source lives under `src/api/`:

```
schematic-pg/dist/api/       # Published runtime (import as schematic-pg/api/*)
├── types.ts                # Hono AppEnv (db + auth in context)
├── auth/
│   ├── jwt-resolver.ts     # Default Bearer JWT resolver (HS256)
│   ├── middleware.ts       # createAuthMiddleware(resolver?)
│   ├── policy.ts           # assertPolicy, resolvePolicyWhere, mergeWhere
│   └── ...
├── middleware/
│   ├── db.ts               # Pool + createDbClient + context middleware
│   ├── validate.ts         # Zod validation wrappers
│   └── errors.ts           # HTTP error mapping (401, 403, 409, …)
└── utils/
    └── route-naming.ts     # Model → kebab-case plural paths

your-project/src/routes/    # Hand-written custom Hono routers (auto-imported)
└── health.ts               # Example: GET /health
```

The generators live in this repo under `src/api-generator/` and are invoked by the CLI at build time.
