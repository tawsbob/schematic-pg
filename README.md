# schematic-pg

<img width="1254" height="1254" alt="schematic" src="https://github.com/user-attachments/assets/5b8f35b3-7e99-4779-aca3-ec3dbe27be56" />


> A single-file backend framework for PostgreSQL and Node.js. Define your database schema, ACL policies, and validations in one declarative DSL — then generate the SQL, the API, and the types.

---

## Philosophy

Most backend frameworks force you to scatter your truth across migrations, ORM models, Zod schemas, route handlers, and access control lists. schematic-pg inverts that: **your schema definition is the source of truth** for everything — the database, the REST API, and the runtime validations.

- **One file.** Schema, relations, triggers, indexes, and ACL in a single `.schema` file.
- **Zero ORM.** We generate raw PostgreSQL and parameterized queries. No hidden query builders — relation loading is explicit via `include`, with batched queries that avoid N+1 and cartesian explosion.
- **Hand-written parser.** A small, fast recursive-descent lexer/parser with zero parser-generator dependencies.
- **Hono-based runtime.** Lightweight HTTP handlers generated from your schema, with Zod validation on every write.

---

## Features

- **Declarative Schema DSL** — PostgreSQL-native types, enums, extensions, indexes, and triggers
- **Automatic SQL Generation** — idempotent DDL with snake_case naming conventions
- **Type-safe Database Client** — Prisma-like query API over parameterized raw SQL (`pg` Pool, no ORM), with nested `include` eager-loading, `db.$transaction()` for atomic multi-model writes, and a parameterized `$queryRaw` / `$executeRaw` escape hatch
- **Type-safe REST API** — Hono routes with generated Zod validation
- **Custom routes** — Hand-written Hono routers in `src/routes/` auto-imported into the generated app
- **Lifecycle hooks** — Before/after create, update, and delete with Express-style `next()` cancel semantics; scaffold via `hooks:add`
- **Inline ACL** — Row-level and role-based access control via `@policy` directives, enforced at runtime in generated routes
- **Validation Rules** — `@regex` and `@range` constraints that flow into generated Zod request validators (with custom error messages from the schema)
- **Migration Ready** — Full regeneration today, diff-based migrations tomorrow

---

## The DSL

```ts
extensions {
  pgcrypto { version: "1.3" }
  postgis
  uuid-ossp
}

enums {
  UserRole { ADMIN, USER, PUBLIC }
  OrderStatus { PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED }
}

models {

  model User {
    id:        UUID        @id @default(gen_random_uuid())
    email:     VARCHAR(255) @unique
    name:      VARCHAR(150)
    role:      UserRole    @default(USER)
    age:       SMALLINT?
    balance:   INTEGER
    isActive:  BOOLEAN     @default(true)
    createdAt: TIMESTAMP   @default(now())
    updatedAt: TIMESTAMP?

    profile:   Profile?
    orders:    Order[]

    @policy(role: USER, allow: [select, insert, update], where: "id = {{auth.user.id}}")
    @policy(role: ADMIN, allow: all)

    @@index(fields: [role, isActive])
    @@index(fields: [name], where: "isActive = true", name: "active_users_name_idx", type: BTREE)

    @@trigger {
      timing: BEFORE,
      event: UPDATE,
      level: ROW,
      execute: """
        IF (OLD.balance <> NEW.balance) THEN
          RAISE EXCEPTION 'Balance cannot be updated directly';
        END IF;
        RETURN NEW;
      """
    }
  }

  model Profile {
    id:       UUID        @id @default(gen_random_uuid())
    userId:   UUID        @unique
    bio:      TEXT
    avatar:   VARCHAR(255)
    location: POINT

    user:     User        @relation(
      fields: [userId],
      references: [id],
      onDelete: CASCADE,
      onUpdate: SET_NULL
    )
  }

  model Order {
    id:          UUID        @id @default(gen_random_uuid())
    userId:      UUID
    status:      OrderStatus @default(PENDING)
    totalAmount: DECIMAL(10, 2)
    items:       JSONB
    createdAt:   TIMESTAMP   @default(now())
    updatedAt:   TIMESTAMP?

    user:        User        @relation(fields: [userId], references: [id])
    products:    ProductOrder[]

    @@index(fields: [userId])
    @@index(fields: [status, createdAt], name: "order_status_created_idx")
  }

  model Product {
    id:          UUID        @id @default(gen_random_uuid())
    name:        VARCHAR(255)
    description: TEXT
    price:       DECIMAL(10, 2) @range(min: 0.01, max: 999999.99)
    stock:       INTEGER        @range(min: 0)
    category:    VARCHAR(100)
    tags:        TEXT[]
    metadata:    JSONB
    createdAt:   TIMESTAMP   @default(now())
    updatedAt:   TIMESTAMP?

    orders:      ProductOrder[]

    @@trigger {
      timing: AFTER,
      event: UPDATE,
      level: ROW,
      execute: """
        IF (OLD.stock <> NEW.stock) THEN
          INSERT INTO log (message) VALUES ('Product stock changed');
        END IF;
        RETURN NEW;
      """
    }
  }

  model ProductOrder {
    id:        SERIAL
    orderId:   UUID
    productId: UUID
    quantity:  INTEGER
    price:     DECIMAL(10, 2)

    order:     Order   @relation(fields: [orderId], references: [id])
    product:   Product @relation(fields: [productId], references: [id])

    @@id(fields: [orderId, productId])
  }

}
```

### Relations (`@relation`)

Relation fields point at another model (`Profile?`, `Order[]`). The side that owns the foreign-key column must declare `@relation` with `fields` and `references`:

```ts
model User {
  profile: Profile?   // inverse — no @relation needed
  orders:  Order[]
}

model Profile {
  userId: UUID @unique
  user:   User @relation(
    fields: [userId],
    references: [id],
    onDelete: CASCADE,   // optional
    onUpdate: SET_NULL   // optional
  )
}

model Order {
  userId: UUID
  user:   User @relation(fields: [userId], references: [id])
}
```

| Argument | Required | Side | Purpose |
|----------|----------|------|---------|
| `fields` | Yes (FK side) | FK owner | Local column(s) on this model |
| `references` | Yes (FK side) | FK owner | Target column(s) on the related model |
| `onDelete` | No | FK side | PostgreSQL `ON DELETE` action (`CASCADE`, `SET NULL`, …) |
| `onUpdate` | No | FK side | PostgreSQL `ON UPDATE` action |
| `name` | No | Both (must match) | Disambiguates multiple relations between the same two models |

**FK owner vs inverse.** Put `fields` and `references` on the model that stores the foreign key (`Profile.userId` → `user` on `Profile`). The other side (`User.profile`) is inferred automatically — list fields become `hasMany`, optional scalars become `hasOne` / `belongsTo` on the FK side.

**`name` is only for disambiguation.** When a single link exists between two models (like `User` ↔ `Profile`), you do not need `name` on either side. Use matching `name` values only when two models relate more than once:

```ts
model User {
  writtenPosts: Post[] @relation(name: "PostAuthor")
  editedPosts:  Post[] @relation(name: "PostEditor")
}

model Post {
  authorId: UUID
  editorId: UUID?
  author: User @relation(name: "PostAuthor", fields: [authorId], references: [id])
  editor: User? @relation(name: "PostEditor", fields: [editorId], references: [id])
}
```

If either side declares `name`, the other side must use the same `name` (or omit `@relation` entirely on the inverse when no `name` is used anywhere).

**Runtime keys.** `include` and API relation paths use the **field name** (`profile`, `orders`, `user`) — not the optional `name` argument. `name` is never used for SQL constraint names; foreign keys are named from table and column names.

---

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│   schema.dsl    │────▶│  Lexer +     │────▶│       AST        │
│  (your source)  │     │   Parser     │     │  (typed nodes)   │
└─────────────────┘     └──────────────┘     └────────┬─────────┘
                                                      │
           ┌──────────────────────────────────────────┼──────────┐
           │                                          │          │
           ▼                                          ▼          ▼
    ┌─────────────┐                          ┌──────────────┐ ┌─────────────┐
    │  SQL DDL    │                          │  DB Client   │ │ Hono Routes │
    │ Generator   │                          │  Generator   │ │ Generator   │
    └─────────────┘                          └──────────────┘ └─────────────┘
           │                                          │          │
           ▼                                          ▼          ▼
    ┌─────────────┐                          ┌──────────────┐ ┌─────────────┐
    │  schema.sql │                          │ generated/   │ │ Hono Routes │
    │ (PostgreSQL)│                          │ db.ts, types │ │ + policies  │
    └─────────────┘                          └──────────────┘ └─────────────┘
```

1. **Parse** — The hand-written lexer and recursive-descent parser turn your `.schema` file into a typed AST.
2. **Generate SQL** — The DDL generator emits idempotent PostgreSQL: extensions, enums, tables, foreign keys, indexes, and triggers. All identifiers are automatically converted to `snake_case`.
3. **Generate DB client** — The client generator emits TypeScript interfaces (including `{Model}Include` types), relation metadata, and a `createDbClient(pool)` factory with per-model CRUD methods, nested `include` eager-loading, and `$transaction` for atomic multi-model writes. All SQL uses `$1`, `$2`, … placeholders — user input is never interpolated.
4. **Generate API** — The route generator emits Hono routers with:
   - Zod-validated request bodies and path params (driven by `@regex` and `@range`)
   - Full CRUD handlers backed by the generated DB client
   - Role-based ACL enforcement (driven by `@policy`) with row-level `WHERE` injection
   - Pluggable authentication middleware (default: Bearer JWT)
5. **Run** — `generated/app.ts` mounts all routers and starts a Node.js server. You get a validated REST API in seconds.

---

## Quick Start

Install the CLI and scaffold a new project:

```bash
npx schematic-pg init my-app
cd my-app
```

Edit `app.schema`, then start the full dev loop:

```bash
make dev
# → starts PostgreSQL, generates code, bootstraps the DB, runs the dev server,
#   and watches app.schema for changes (regenerate + bootstrap + restart)
# → http://localhost:3000
```

Or run each step individually:

```bash
# Start PostgreSQL (PostGIS-enabled, matches .env defaults)
docker compose up -d --wait

# Generate, bootstrap, start server, and watch app.schema (default)
npx schematic-pg dev
# → http://localhost:3000

# One-shot dev server without schema watching:
npx schematic-pg dev --no-watch
```

Manual split when you need finer control:

```bash
npx schematic-pg generate
npx schematic-pg db:bootstrap
npx schematic-pg dev --no-watch
```

The `init` command creates everything you need to get running:

| File / directory | Purpose |
|------------------|---------|
| `AGENTS.md` | Agent-oriented guide for working with schematic-pg in this project |
| `app.schema` | Starter schema (one `User` model) — edit this |
| `.env` | `DATABASE_URL`, JWT settings |
| `docker-compose.yml` | Local PostGIS PostgreSQL on `:5432` |
| `Makefile` | `make dev` — docker compose (with health wait) + `schematic-pg dev` |
| `tsconfig.json` | TypeScript config for `generated/` and `src/routes/` |
| `package.json` | `schematic-pg` + runtime deps (`hono`, `pg`, `zod`, …) |
| `src/routes/health.ts` | Example custom route mounted at `/health` |

After `generate`, your project also contains:

| Output | Purpose |
|--------|---------|
| `schema.sql` | Idempotent PostgreSQL DDL |
| `generated/db*.ts` | Type-safe DB client |
| `generated/app.ts` | Hono server entry point |
| `generated/routes/*.ts` | CRUD routers per model |
| `generated/policies.ts` | ACL metadata from `@policy` |
| `generated/schemas/validation.ts` | Zod request validators |

Generated code imports the runtime from the `schematic-pg` package (`schematic-pg/api/*`, `schematic-pg/db/*`). You do not copy framework source into your project.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `PORT` | `3000` | HTTP listen port |
| `JWT_SECRET` | — | HMAC secret for the default Bearer JWT resolver |
| `JWT_ROLE_CLAIM` | `role` | JWT claim mapped to `auth.role` |
| `JWT_USER_ID_CLAIM` | `sub` | JWT claim mapped to `auth.user.id` |

Set these in `.env` before running `dev`, `start`, or `db:bootstrap`.

---

## CLI Reference

The `schematic-pg` binary is the primary interface. Each command accepts an optional path to a schema file (defaults to `app.schema` in the current directory).

### Project setup

```bash
schematic-pg init [dir] [--skip-install]  # Scaffold a new project (runs npm install by default)
```

### Code generation

```bash
schematic-pg generate [schema]        # schema.sql + db client + API (all three)
schematic-pg generate:sql [schema]    # SQL DDL to stdout
schematic-pg generate:client [schema]   # generated/db*.ts only
schematic-pg generate:api [schema]      # generated/app.ts, routes/, policies, schemas
```

Run `generate:client` before `generate:api` when using the split commands — routes depend on `generated/db.ts`.

### Lifecycle hooks scaffolding

```bash
schematic-pg hooks:add [schema] [--model ModelName]
```

Reads `app.schema`, prompts for a model (or accepts `--model`), and writes `src/hooks/{Model}.ts` with all six lifecycle hooks pre-filled. Delete any hooks you do not need, then run `generate:api` to wire them into POST/PUT/DELETE routes. Existing hook files are never overwritten.

### Development server

```bash
schematic-pg dev [schema] [--no-watch]
```

`dev` runs the full local loop:

1. `generate` — writes `schema.sql` and `generated/*`
2. `db:bootstrap` — waits for Postgres, applies DDL, snapshots schema state
3. Starts `generated/app.ts`
4. Watches `app.schema` (default) — on change, re-runs generate, bootstrap, and server restart

Pass `--no-watch` for a one-shot run without file watching.

Equivalent npm scripts in a project created by `init`:

```bash
make dev           # docker compose up -d --wait + schematic-pg dev
npm run dev        # schematic-pg dev
npm run start      # schematic-pg start (production)
npm run generate   # schematic-pg generate
```

### Production server

```bash
schematic-pg start [schema] [--no-migrate]
```

`start` runs the app in production mode — no code generation, no schema watching:

1. Verifies `generated/app.ts` exists (run `generate` in your build step if missing)
2. Waits for PostgreSQL to accept connections
3. Applies pending migration files (default; skip with `--no-migrate`)
4. Starts `generated/app.ts` with `NODE_ENV=production` until exit

The optional `[schema]` argument is only used for migration snapshot resolution (same as `db:migrate`).

| Step | `dev` | `start` |
|------|-------|---------|
| Generate code | Yes | No |
| DB bootstrap | Yes | No |
| Apply pending migrations | No | Yes (default) |
| Wait for Postgres | Yes (via bootstrap) | Yes |
| Schema file watch | Yes (default) | No |
| `NODE_ENV` | unset | `production` |

Example deploy flow:

```bash
npx schematic-pg generate          # build step in CI
npx schematic-pg start             # migrate DB + run server
# or: npm run start
```

Pass `--no-migrate` when migrations are applied separately (e.g. in a release job):

```bash
npx schematic-pg db:migrate
npx schematic-pg start --no-migrate
```

Equivalent npm scripts in a project created by `init`:

```bash
npm run start      # schematic-pg start
```

### Database commands

```bash
schematic-pg db:ping [schema]              # Test DATABASE_URL connection (SELECT 1)
schematic-pg db:bootstrap [schema]         # Apply DDL from schema + write .schema-state snapshot
schematic-pg db:diff [schema]              # Print pending schema changes (snapshot vs app.schema)
schematic-pg db:diff --name add_users      # Write a migration file under migrations/
schematic-pg db:migrate [schema]           # Apply pending migration files
schematic-pg db:migrate:status [schema]    # Show snapshot + migration file status
```

`db:bootstrap` is the recommended first-time setup. Use `db:diff` / `db:migrate` when evolving an existing database.

Alternatively, apply SQL manually:

```bash
psql $DATABASE_URL -f schema.sql
```

### Help

```bash
schematic-pg --help
```

---

## Local development (this repo)

Contributors working on the framework itself clone the repo and use npm scripts (which delegate to the same CLI via `tsx`):

```bash
cp .env.example .env          # configure DATABASE_URL
npm run build                 # compile src/ → dist/ (required for schematic-pg/* imports)
npm run docker:up             # PostGIS-enabled PostgreSQL on :5432
npm run generate              # write schema.sql from app.schema
npm run generate:client       # write generated/db*.ts
npm run generate:api          # write generated/app.ts, routes/, schemas/
npm run db:bootstrap          # apply DDL + snapshot schema state
npm run dev:api               # regenerate client + API and start server on :3000
npm run start                 # production server (migrate + run generated/app.ts)
npm test                      # unit tests
npm run test:integration      # Docker + generate + DB client + ACL integration tests
```

---

## Database Client

A type-safe query layer generated from your schema AST. The API mirrors Prisma ergonomics (`db.user.create`, `db.user.findMany`, `db.$transaction`, …) but every query is built as parameterized raw SQL against a `pg` `Pool` — no ORM, no query-builder library.

### Generate

```bash
npx schematic-pg generate:client
# or: npm run generate:client   (inside a scaffolded project)
```

Outputs:

| File | Purpose |
|------|---------|
| `generated/db-types.ts` | Per-model interfaces: `User`, `UserCreateInput`, `UserWhereInput`, `UserInclude`, enum unions |
| `generated/db-model-meta.ts` | Serialized field/column and relation metadata consumed at runtime |
| `generated/db.ts` | `createDbClient(pool)` factory wiring all models and `$transaction` |

### Usage

```typescript
import { Pool } from 'pg';
import { createDbClient } from './generated/db.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = createDbClient(pool);

// Create
const user = await db.user.create({
  email: 'a@b.com',
  name: 'Alice',
  balance: 0,
});

// Read
const one = await db.user.findUnique({ id: user.id });
const first = await db.user.findFirst({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
});
const many = await db.user.findMany({
  where: { role: { in: ['ADMIN', 'USER'] }, isActive: true },
  orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  take: 10,
  skip: 0,
});
const total = await db.user.count({ where: { role: 'ADMIN' } });

// Eager-load relations (nested)
const usersWithOrders = await db.user.findMany({
  where: { role: 'ADMIN' },
  include: {
    profile: true,
    orders: {
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        products: {
          include: { product: true },
        },
      },
    },
  },
});

// include works on all read methods
const oneWithProfile = await db.user.findUnique(
  { id: user.id },
  { include: { profile: true } },
);

// Update
const updated = await db.user.update({
  where: { id: user.id },
  data: { name: 'Bob' },
});
const { count } = await db.user.updateMany({
  where: { isActive: false },
  data: { name: 'Inactive' },
});

// Delete
const deleted = await db.user.delete({ id: user.id });
await db.user.deleteMany({ where: { role: 'PUBLIC' } });
```

### Per-model API

Each model in `app.schema` becomes a camelCase property on the client (`User` → `db.user`, `ProductOrder` → `db.productOrder`) with these methods:

| Method | SQL shape |
|--------|-----------|
| `create(data)` | `INSERT INTO … VALUES ($1, …) RETURNING *` |
| `findUnique(where, { include, … })` | `SELECT * … WHERE … LIMIT 1` (+ batched relation queries when `include` is set) |
| `findFirst({ where, orderBy, include, … })` | `SELECT * … ORDER BY … LIMIT 1` (+ relation queries when `include` is set) |
| `findMany({ where, orderBy, take, skip, include, … })` | `SELECT * … ORDER BY … LIMIT … OFFSET …` (+ relation queries when `include` is set) |
| `count({ where })` | `SELECT COUNT(*) …` (no `include`) |
| `update({ where, data })` | `UPDATE … SET … WHERE … RETURNING *` |
| `updateMany({ where, data })` | `UPDATE … SET … WHERE … RETURNING *` |
| `delete(where)` | `DELETE … WHERE … RETURNING *` |
| `deleteMany({ where })` | `DELETE … WHERE … RETURNING *` |

Mutations return the full row (`RETURNING *`). Rows are mapped from `snake_case` columns to `camelCase` TypeScript fields.

The client also exposes a top-level `$transaction` method (see below).

### Transactions

Run multiple model operations in a single PostgreSQL transaction. The callback receives a transaction-scoped client (`tx`) with the same per-model API as `db`, but bound to one `PoolClient` for the duration of the callback.

```typescript
const order = await db.$transaction(async (tx) => {
  const created = await tx.order.create({
    userId: user.id,
    totalAmount: '19.99',
    items: { sku: 'book' },
  });

  await tx.productOrder.create({
    orderId: created.id,
    productId: product.id,
    quantity: 2,
    price: '9.99',
  });

  await tx.product.update({
    where: { id: product.id },
    data: { stock: newStock },
  });

  return created; // committed when the callback resolves
});
```

**Semantics:**

| Behavior | Detail |
|----------|--------|
| Commit | Callback resolves → `COMMIT` |
| Rollback | Callback throws → `ROLLBACK`, original error rethrown |
| Constraint errors | `UniqueConstraintError`, `ForeignKeyConstraintError`, etc. still propagate and roll back earlier writes in the same transaction |
| Read-your-writes | Queries inside `tx` (including `findUnique` / `include`) use the same connection and see uncommitted rows before commit |
| Return value | Whatever the callback returns is passed through after commit |

The generated `TxClient` type is the transaction-scoped client (all model clients, no nested `$transaction`). Calling `$transaction` inside a transaction callback is unsupported in v1.

Import typed errors from the package entry the generated client uses at runtime:

```typescript
import { UniqueConstraintError } from 'schematic-pg/db/errors';

try {
  await db.$transaction(async (tx) => {
    await tx.order.create({ /* … */ });
    await tx.user.create({ email: 'taken@b.com', name: 'X', balance: 0 });
  });
} catch (error) {
  if (error instanceof UniqueConstraintError) {
    console.log(error.fields); // earlier writes in the tx were rolled back
  }
}
```

Under the hood, queries go through a minimal `Queryable` interface satisfied by both `pg` `Pool` (autocommit, default client) and `PoolClient` (inside `$transaction`). The runtime helper `runInTransaction` lives in `schematic-pg/db/transaction`.

### Raw queries (`$queryRaw` / `$executeRaw`)

An escape hatch for SQL the query API can't express — window functions, CTEs, PostGIS, full-text search, custom aggregates. Both methods live on the top-level client **and** on the `tx` client inside `$transaction`.

```typescript
// Read rows
const rows = await db.$queryRaw<{ id: string; email: string }>(
  'SELECT id, email FROM "user" WHERE email = $1',
  ['a@b.com'],
);

// Run a statement, get the affected row count
const affected = await db.$executeRaw(
  'UPDATE "user" SET name = $1 WHERE role = $2',
  ['Renamed', 'ADMIN'],
);

// Inside a transaction — runs on the same connection as the model calls
await db.$transaction(async (tx) => {
  const order = await tx.order.create({ /* … */ });
  const [row] = await tx.$queryRaw<{ total: string }>(
    'SELECT sum(price) AS total FROM "product_order" WHERE order_id = $1',
    [order.id],
  );
  // …
});
```

| Method | Signature | Returns |
|--------|-----------|---------|
| `$queryRaw` | `(sql: string, params?: unknown[])` | `Promise<T[]>` — the result rows |
| `$executeRaw` | `(sql: string, params?: unknown[])` | `Promise<number>` — affected row count |

**Security — always parameterize.** Values MUST go through the positional `params` array (`$1`, `$2`, …). **Never** interpolate user input into the `sql` string — that reintroduces SQL injection. There is deliberately no tagged-template (`` sql`…` ``) helper, because interpolation-based builders make the unsafe path look safe.

```typescript
// ✅ safe — value is a bound parameter
await db.$queryRaw('SELECT * FROM "user" WHERE email = $1', [email]);

// ❌ NEVER do this — string interpolation is injectable
await db.$queryRaw(`SELECT * FROM "user" WHERE email = '${email}'`);
```

**Rows are returned UNMAPPED.** Unlike the model client, raw results are handed back exactly as `pg` produces them: `snake_case` column names and the driver's default type coercion. There is no `snake_case → camelCase` renaming and no schema-driven type mapping (a raw query has no single owning model). Alias columns yourself if you want specific names.

Errors surface as the same typed `DatabaseError` subclasses (`UniqueConstraintError`, `ForeignKeyConstraintError`, …) as the rest of the client. The runtime helper `createRawClient` lives in `schematic-pg/db/raw`.

### Eager loading (`include`)

Load related models in one call and get back a nested JSON tree. Relation fields are inferred from your schema (`orders: Order[]`, `profile: Profile?`, `@relation(fields: …, references: …)`).

**Supported on:** `findMany`, `findFirst`, and `findUnique`. Not on `count`.

```typescript
// Shorthand — load all columns for the relation
await db.user.findMany({
  include: { profile: true, orders: true },
});

// Nested — arbitrary depth
await db.user.findMany({
  include: {
    orders: {
      include: {
        products: {
          include: { product: true },
        },
      },
    },
  },
});

// Filter, sort, and paginate inner relations
await db.user.findMany({
  include: {
    orders: {
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { products: true },
    },
  },
});
```

Each relation key accepts `true` or a `{ where?, orderBy?, take?, skip?, include? }` object (typed as `{Model}IncludeArgs` in `generated/db-types.ts`).

**Return shape:** scalar relation fields (`profile: Profile?`) become `Profile | null`. List relations (`orders: Order[]`) become arrays on the result object. Nested `include` keys are attached on each child row the same way.

#### Loading strategies

By default the client uses **query splitting**: one SQL query for the root rows, then one batched query per included relation level (`WHERE foreign_key = ANY($1)` with deduplicated parent keys). This avoids cartesian explosion when loading multiple `hasMany` relations at the same level (e.g. `profile` + `orders` on `User`).

```typescript
// Default — split queries (recommended for large result sets)
await db.user.findMany({
  include: { orders: true },
});

// Optional — single round-trip via PostgreSQL LATERAL + json_agg
await db.user.findMany({
  include: { profile: true, orders: true },
  relationLoadStrategy: 'join',
});
```

| Strategy | Option | Behavior |
|----------|--------|----------|
| Split (default) | omit or `'split'` | One query per relation edge; no row duplication on the wire |
| Join | `'join'` | One SQL statement; nested JSON built in PostgreSQL |

Use `'join'` when latency dominates (fewer round trips). Use the default split strategy when loading many rows or several sibling collections.

#### How it works

```
findMany({ include })  →  buildLoadPlan (relation tree from schema metadata)
                        →  SELECT root rows
                        →  for each included relation: SELECT … WHERE fk = ANY($parentIds)
                        →  stitch (hash-join children onto parents in O(n))
```

Relation metadata is generated into `generated/db-model-meta.ts` and resolved through an in-memory model registry inside `createDbClient`. Include depth is capped at 10 levels.

Generated types: `{Model}Include` and `{Model}IncludeArgs` in `generated/db-types.ts`.

### Where filters

Direct values are treated as equality. Structured operators are supported per field type:

```typescript
// Equality shorthand
{ email: 'a@b.com' }

// Explicit operators
{ email: { equals: 'a@b.com' } }
{ email: { contains: '@' } }      // LIKE %@%
{ email: { startsWith: 'a' } }    // LIKE a%
{ email: { endsWith: '.com' } }  // LIKE %.com
{ balance: { gt: 100 } }
{ balance: { lte: 500 } }
{ role: { in: ['ADMIN', 'USER'] } }

// Logical groups
{
  AND: [{ role: 'USER' }, { isActive: true }],
  OR: [{ role: 'ADMIN' }, { role: 'PUBLIC' }],
  NOT: { isActive: false },
}
```

### Naming and types

- **API**: camelCase field names (`createdAt`, `userId`)
- **SQL**: snake_case columns (`created_at`, `user_id`); reserved table names like `user` and `order` are quoted
- **Runtime mapping**:

| Schema type | TypeScript |
|-------------|------------|
| `UUID`, `VARCHAR`, `TEXT` | `string` |
| `INTEGER`, `SERIAL`, `SMALLINT` | `number` |
| `BOOLEAN` | `boolean` |
| `TIMESTAMP` | `Date` |
| `DECIMAL` | `string` (avoids float precision loss) |
| `JSONB` | `Record<string, unknown>` |
| `TEXT[]` | `string[]` |
| Enums | string literal union |
| Optional (`?`) | `T \| null` |

Fields with `@default` are optional on `CreateInput`. `@id` fields are omitted from create input when the database generates them.

### Error handling

PostgreSQL errors are mapped to typed exceptions:

| Class | PG code | When |
|-------|---------|------|
| `UniqueConstraintError` | `23505` | Duplicate unique column (includes `fields: string[]`) |
| `ForeignKeyConstraintError` | `23503` | Invalid relation reference |
| `NotFoundError` | — | Optional helper for missing records |
| `DatabaseError` | other | Generic wrapper with `code`, `detail`, `constraint` |

```typescript
import { UniqueConstraintError } from 'schematic-pg/db/errors';

try {
  await db.user.create({ email: 'taken@b.com', name: 'X', balance: 0 });
} catch (error) {
  if (error instanceof UniqueConstraintError) {
    console.log(error.fields); // ['email']
  }
}
```

### Runtime architecture

Generated code is a thin wrapper. The query engine ships inside the `schematic-pg` package (`schematic-pg/db/*`). In this repository, the source lives under `src/db/`:

```
schematic-pg/dist/db/        # Published runtime (import as schematic-pg/db/*)
├── queryable.ts            # Queryable seam (Pool | PoolClient)
├── transaction.ts          # runInTransaction (BEGIN / COMMIT / ROLLBACK)
├── query-builder.ts        # INSERT / SELECT / UPDATE / DELETE / COUNT
├── where-translator.ts     # WhereInput → SQL + params
├── model-client.ts         # createModelClient factory
├── include/                # Eager-loading planner, executor, hydrator, json_agg
├── utils/relations.ts      # Relation graph from schema AST
├── row-mapper.ts           # snake_case rows → camelCase + coercion
└── errors.ts               # UniqueConstraintError, ForeignKeyConstraintError, …
```

### Integration tests

One command starts Docker Postgres, generates the client and API, and runs all integration tests (DB client + ACL):

```bash
npm run test:integration
```

This resets the `public` schema, bootstraps from `app.schema`, seeds test data, and exercises:

- **DB client** — CRUD, filters, nested `include` eager-loading, `$transaction` (commit, rollback, constraint errors), and error handling ([`src/db/__tests__/db-client.integration.test.ts`](src/db/__tests__/db-client.integration.test.ts))
- **ACL over HTTP** — role checks, row-level filters, JWT auth, and open endpoints ([`src/api/__tests__/acl.integration.test.ts`](src/api/__tests__/acl.integration.test.ts))

Tests run in-process via Hono `app.request()` against the exported `createApp()` factory from `generated/app.ts`.

---

## REST API

A Hono-based HTTP layer generated from your schema AST. Each model gets a router with full CRUD endpoints. Request bodies and path parameters are validated with Zod schemas derived from field types and `@regex` / `@range` attributes — validation error messages come directly from the `message` parameter in your schema.

### Generate

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

### Start the server

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

Environment variables (also see [Quick Start](#quick-start)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — (required) | PostgreSQL connection string (loaded from `.env`) |
| `PORT` | `3000` | HTTP listen port |
| `JWT_SECRET` | — | HMAC secret for the default Bearer JWT resolver |
| `JWT_ROLE_CLAIM` | `role` | JWT claim mapped to `auth.role` |
| `JWT_USER_ID_CLAIM` | `sub` | JWT claim mapped to `auth.user.id` |

The server uses `@hono/node-server` and connects via a shared `pg` `Pool`. The DB client and auth context are injected into every request through Hono context (`c.get('db')`, `c.get('auth')`).

### Routes

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

### Custom routes

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

### Lifecycle hooks

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

### Endpoints

Every router exposes the same CRUD shape. Models with `@policy` attributes enforce role checks and row-level filters on every handler; models without policies behave as open endpoints.

| Method | Path | Handler | Validation |
|--------|------|---------|------------|
| `GET` | `/` | `findMany({ where: mergeWhere(queryWhere, policyWhere), orderBy, take, skip, include })` | Query params |
| `GET` | `/{pk}` | `findUnique(mergeWhere(pk, policyWhere), { include })` | Path params + query params |
| `POST` | `/` | `create(body)` — policy check only | JSON body |
| `PUT` | `/{pk}` | `update({ where: mergeWhere(pk, policyWhere), data })` | Path params + JSON body |
| `DELETE` | `/{pk}` | `delete(mergeWhere(pk, policyWhere))` | Path params |

`POST` returns `201 Created`. Missing records on `GET` return `404`. All handlers strip `@omit` fields from JSON responses before returning.

### Query filters (`GET /`)

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

### Relation includes (`GET /`, `GET /{pk}`)

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

### Response shaping (`@omit`)

Mark sensitive stored fields with `@omit` to exclude them from generated route JSON responses. On read endpoints with `include`, omitted fields are stripped recursively on nested relation objects as well. Mutation responses (`POST`, `PUT`, `DELETE`) strip `@omit` fields on the root model only. The ORM client still returns full entities.

```ts
passwordHash: VARCHAR(255) @omit @unfilterable @default("")
```

Generated types include `{Model}Response` (for example `UserResponse = Omit<User, 'passwordHash'>`) in `generated/schemas/validation.ts`.

### Validation

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

### Example requests

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

### Error responses

| Status | When |
|--------|------|
| `400` | Zod validation failure or foreign key violation |
| `401` | Malformed or invalid JWT (when `Authorization: Bearer` is present) |
| `403` | Role not allowed for the requested operation (`@policy` denial) |
| `404` | Record not found on `GET`, or delete/update returned no rows |
| `409` | Unique constraint violation |
| `500` | Other database errors |

Global error handling lives in `src/api/middleware/errors.ts` and maps the same typed exceptions as the DB client layer.

### App configuration

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

### Runtime architecture

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

---

## Access Control (`@policy`)

Define who can do what — and which rows they can touch — directly on your models. Policies are parsed from the schema, emitted to `generated/policies.ts`, and enforced in generated route handlers at runtime.

### Defining policies

Attach one or more `@policy` attributes to a model:

```ts
model User {
  id:   UUID @id @default(gen_random_uuid())
  role: UserRole @default(USER)
  // ...

  @policy(role: USER, allow: [select, insert, update], where: "id = {{auth.user.id}}")
  @policy(role: ADMIN, allow: all)
}
```

| Argument | Type | Description |
|----------|------|-------------|
| `role` | enum identifier | Role this policy applies to (must match a value in your schema enums, e.g. `UserRole`) |
| `allow` | `all` or `[select, insert, update, delete]` | Operations permitted for this role |
| `where` | string (optional) | Row-level filter applied on read/update/delete; supports `{{auth.*}}` templates |

**Operations map to HTTP methods:**

| HTTP | Policy operation |
|------|------------------|
| `GET` | `select` |
| `POST` | `insert` |
| `PUT` | `update` |
| `DELETE` | `delete` |

Models **without** `@policy` attributes are open — generated routes skip ACL checks entirely (e.g. `Log` in the sample schema).

### How enforcement works

For each model that has policies, generated routes call the policy guard before every DB operation:

```typescript
const auth = c.get('auth');
const policy = assertPolicy('User', auth.role, 'select');
const policyWhere = resolvePolicyWhere(policy, auth);
const rows = await db.user.findMany({ where: policyWhere });
```

1. **`assertPolicy(model, role, operation)`** — Looks up the policy for the caller's role in `generated/policies.ts`. Throws `403 Forbidden` if the role has no policy or the operation is not in `allow`. Returns the matched policy.
2. **`resolvePolicyWhere(policy, auth)`** — Interpolates `{{auth.user.id}}` (and other `{{auth.*}}` paths) from the request auth context, then parses the result into a `WhereInput` object.
3. **`mergeWhere(routeWhere, policyWhere)`** — Combines route params (e.g. `:id`) with the policy filter via `AND` on read/update/delete.

`POST` (insert) checks operation permission only — no `where` injection.

### Auth context

Every request gets an `auth` object on Hono context:

```typescript
type AuthContext = {
  role: string;
  user?: { id: string; [key: string]: unknown };
};
```

**Unauthenticated requests** (no `Authorization` header) default to `{ role: 'PUBLIC' }`. Missing token is not a `401` — only a malformed or invalid token when a Bearer header is present.

If the caller's role has no matching `@policy`, the runtime falls back to a `PUBLIC` role policy when one exists.

### Default JWT authentication

The generated app uses `createAuthMiddleware()` with a built-in Bearer JWT resolver (`src/api/auth/jwt-resolver.ts`):

```bash
curl http://localhost:3000/users \
  -H 'Authorization: Bearer <jwt>'
```

The resolver expects HS256 tokens and reads:

- `auth.role` ← claim named by `JWT_ROLE_CLAIM` (default: `role`)
- `auth.user.id` ← claim named by `JWT_USER_ID_CLAIM` (default: `sub`)

Set `JWT_SECRET` in `.env` when using the default resolver.

### Pluggable auth

Different systems resolve identity differently. Pass a custom `AuthResolver` to the middleware:

```typescript
import { createAuthMiddleware } from 'schematic-pg/api/auth/middleware';

app.use(createAuthMiddleware(async (c) => {
  const role = c.req.header('X-Role');
  const userId = c.req.header('X-User-Id');

  if (!role || !userId) {
    return null; // → defaults to { role: 'PUBLIC' }
  }

  return {
    role,
    user: { id: userId },
  };
}));
```

`AuthResolver` signature: `(c: Context<AppEnv>) => Promise<AuthContext | null>`.

Return `null` for anonymous callers; throw `UnauthorizedError` for invalid credentials.

### Where templates

Policy `where` clauses support `{{auth.*}}` placeholders resolved against the auth context:

```ts
where: "id = {{auth.user.id}}"
```

After interpolation, simple `field op value` forms are parsed into `WhereInput`:

| Form | Example |
|------|---------|
| Equality | `id = {{auth.user.id}}` → `{ id: '…' }` |
| Comparison | `balance >= 100` → `{ balance: { gte: 100 } }` |
| Inequality | `role != ADMIN` → `{ NOT: { role: 'ADMIN' } }` |

Complex multi-clause SQL in `where` is not supported yet — keep policies to a single condition for now.

### Generated policy metadata

`schematic-pg generate:api` emits `generated/policies.ts`:

```typescript
export const POLICIES: Record<string, NormalizedPolicy[]> = {
  User: [
    { role: 'USER', operations: ['select', 'insert', 'update'], where: "id = {{auth.user.id}}" },
    { role: 'ADMIN', operations: 'all' },
  ],
};
```

This file is consumed by `assertPolicy` at runtime — do not edit manually.

### Example: scoped user access

With the sample `User` policies above:

| Caller | `GET /users` | `GET /users/:id` | `DELETE /users/:id` |
|--------|--------------|------------------|---------------------|
| No token (`PUBLIC`) | `403` | `403` | `403` |
| JWT `role: USER`, `sub: <own-id>` | Returns own row only | Own row if `:id` matches | `403` (delete not in `allow`) |
| JWT `role: ADMIN` | Returns all rows | Any row | Allowed |

These scenarios are covered by `npm run test:integration` — see [`src/api/__tests__/acl.integration.test.ts`](src/api/__tests__/acl.integration.test.ts).

---

## Project Structure

After `schematic-pg init` and `schematic-pg generate`, a typical application looks like this:

```
my-app/
├── app.schema              # Your single source of truth
├── schema.sql              # Generated PostgreSQL DDL
├── .env                    # DATABASE_URL, JWT_* settings
├── docker-compose.yml      # Local PostgreSQL (optional)
├── tsconfig.json
├── package.json            # schematic-pg + hono + pg + zod
├── generated/
│   ├── db.ts               # createDbClient(pool) factory + $transaction
│   ├── db-types.ts         # Generated model + input interfaces
│   ├── db-model-meta.ts    # Runtime column metadata
│   ├── app.ts              # Hono entry point (starts server on :3000)
│   ├── policies.ts         # Generated ACL metadata from @policy
│   ├── hooks.ts            # Registry of src/hooks/* (wired at startup)
│   ├── routes/
│   │   ├── users.ts
│   │   ├── profiles.ts
│   │   └── ...
│   └── schemas/
│       └── validation.ts   # Generated Zod schemas
└── src/
    ├── routes/
    │   └── health.ts       # Custom route → GET /health
    └── hooks/
        └── User.ts         # Lifecycle hooks → POST/PUT/DELETE /users
```

Framework runtime (query builder, auth middleware, validation, hook registry) is **not** copied into your project — it is imported from `node_modules/schematic-pg` at runtime. Only `generated/`, `src/routes/`, and `src/hooks/` contain project-specific code.

### This repository (framework source)

```
postgrest.js/
├── src/
│   ├── schema-dsl/         # Lexer, parser, AST
│   ├── sql-generator/      # DDL + migration planner
│   ├── db/                 # Query builder + client runtime + include eager-loading
│   ├── api/                # Hono runtime (published as schematic-pg/api/*)
│   ├── api-generator/      # AST → routes, Zod, policies, app
│   ├── cli/                # init templates + command helpers
│   └── cli.ts              # schematic-pg CLI entry point
├── dist/                   # Compiled output (npm publish target)
├── generated/              # Sample output from app.schema (this repo)
├── app.schema              # Sample schema
└── editors/                # VS Code extension + language server
```

---

## Why schematic-pg?

| Concern | ORM Approach | schematic-pg Approach |
|---------|-----------|----------------------|
| Schema truth | Migrations + models + Zod + routes | One `.schema` file |
| Query visibility | Hidden behind ORM methods | Raw, parameterized SQL |
| Client ergonomics | ORM model API | Generated Prisma-like client, no ORM runtime |
| Performance | N+1, lazy loading pitfalls | Explicit `include`; batched split queries by default |
| ACL | External service or manual checks | Inline `@policy` directives |
| Validation | Separate Zod schemas | Derived from `@regex` / `@range` |
| Dependencies | Heavy (Prisma, Drizzle, etc.) | Hono + pg + Zod + hand-written parser |

---

## Roadmap

- [x] npm package + CLI (`schematic-pg init`, `generate`, `dev`, `start`, `db:*`)
- [x] Hand-written lexer & recursive-descent parser
- [x] SQL DDL generator (full regeneration)
- [x] Type-safe database client generator (`createDbClient`, `$transaction`, parameterized query builder)
- [x] Diff-based migration planner
- [x] Hono route generator with Zod validation
- [x] Static ACL middleware generation (`@policy` → `assertPolicy` in routes)
- [x] Row-level policy injection (`WHERE` clause from `where:` templates)
- [x] JWT authentication (default Bearer resolver, pluggable `AuthResolver`)
- [x] Custom routes (`src/routes/` auto-imported into generated app)
- [x] Lifecycle hooks (`src/hooks/` before/after create-update-delete, `hooks:add` CLI)
- [x] Relation `include` in DB client (nested eager-loading, split + json_agg strategies)
- [x] Database client transactions (`db.$transaction`, `Queryable` executor seam)
- [x] Parameterized raw-query escape hatch (`db.$queryRaw`, `db.$executeRaw`, tx-scoped)
- [ ] Type generation for frontend consumption
- [ ] Tree-sitter grammar for editor support
- [x] VS Code extension with syntax highlighting and language server
---

## License

MIT
