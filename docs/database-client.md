# Database Client

A type-safe query layer generated from your schema AST. The API mirrors Prisma ergonomics (`db.user.create`, `db.user.findMany`, `db.$transaction`, …) but every query is built as parameterized raw SQL against a `pg` `Pool` — no ORM, no query-builder library.

## Generate

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

## Usage

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

## Per-model API

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

## Transactions

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

## Raw queries (`$queryRaw` / `$executeRaw`)

An escape hatch for SQL the query API can't express — window functions, CTEs, full-text search, custom aggregates. Both methods live on the top-level client **and** on the `tx` client inside `$transaction`.

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

## Eager loading (`include`)

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

### Loading strategies

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

### How it works

```
findMany({ include })  →  buildLoadPlan (relation tree from schema metadata)
                        →  SELECT root rows
                        →  for each included relation: SELECT … WHERE fk = ANY($parentIds)
                        →  stitch (hash-join children onto parents in O(n))
```

Relation metadata is generated into `generated/db-model-meta.ts` and resolved through an in-memory model registry inside `createDbClient`. Include depth is capped at 10 levels.

Generated types: `{Model}Include` and `{Model}IncludeArgs` in `generated/db-types.ts`.

## Where filters

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

## Naming and types

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

## Error handling

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

## Runtime architecture

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

## Integration tests

One command starts Docker Postgres, generates the client and API, and runs all integration tests (DB client + ACL):

```bash
npm run test:integration
```

This resets the `public` schema, bootstraps from `app.schema`, seeds test data, and exercises:

- **DB client** — CRUD, filters, nested `include` eager-loading, `$transaction` (commit, rollback, constraint errors), and error handling ([`src/db/__tests__/db-client.integration.test.ts`](../src/db/__tests__/db-client.integration.test.ts))
- **ACL over HTTP** — role checks, row-level filters, JWT auth, and open endpoints ([`src/api/__tests__/acl.integration.test.ts`](../src/api/__tests__/acl.integration.test.ts); see [Access control](access-control.md))

Tests run in-process via Hono `app.request()` against the exported `createApp()` factory from `generated/app.ts`.
