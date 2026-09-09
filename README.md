# schematic-pg

<img width="1254" height="1254" alt="schematic" src="https://github.com/user-attachments/assets/5b8f35b3-7e99-4779-aca3-ec3dbe27be56" />


> A single-file backend framework for PostgreSQL and Node.js. Define your database schema, ACL policies, and validations in one declarative DSL — then generate the SQL, the API, and the types.

---

## Schema DSL

`app.schema` is the source of truth. From it, schematic-pg generates PostgreSQL DDL, a type-safe DB client, REST routes, Zod validators, and ACL policies.

A schema file always has three sections, in this order: `extensions`, `enums`, `models`.

```ts
extensions {
  pgcrypto
}

enums {
  UserRole { ADMIN, USER }
}

models {
  model User {
    id:    UUID @id @default(gen_random_uuid())
    email: VARCHAR(255) @unique
    role:  UserRole @default(USER)
  }
}
```

Each feature below is shown in isolation. Identifiers in SQL become `snake_case` automatically (`createdAt` → `created_at`, `User` → `"user"`). API field names stay camelCase.

### Extensions

Declare PostgreSQL extensions to enable. Options are optional.

```ts
extensions {
  pgcrypto { version: "1.3" }
  uuid-ossp
}
```

### Enums

Enums become PostgreSQL enum types. Use them as field types and as `@policy` roles.

```ts
enums {
  UserRole { ADMIN, USER, PUBLIC }
  OrderStatus { PENDING, SHIPPED, DELIVERED }
}
```

### Models

A model is a table plus its relations, policies, indexes, and triggers.

```ts
models {
  model Log {
    id:      UUID @id @default(gen_random_uuid())
    message: TEXT
  }
}
```

### Field types

Stored columns use PostgreSQL types. Append `?` for nullable, `[]` for arrays. Parametric types take arguments.

```ts
model Product {
  id:          UUID
  name:        VARCHAR(255)
  price:       DECIMAL(10, 2)
  stock:       INTEGER
  tags:        TEXT[]
  description: TEXT?
  metadata:    JSONB
  createdAt:   TIMESTAMP
}
```

Common types: `UUID`, `VARCHAR`, `TEXT`, `BOOLEAN`, `TIMESTAMP`, `DECIMAL`, `NUMERIC`, `INTEGER`, `SMALLINT`, `BIGINT`, `SERIAL`, `JSONB`, `POINT`, `BYTEA`, `DATE`, `TIME`, `INTERVAL`, `REAL`, `DOUBLE`.

Relation fields use another model as the type (`Profile?`, `Order[]`). They are not stored columns — see [Relations](#relations-relation).

### Primary keys (`@id`, `@@id`)

Mark a single column with `@id`. Use `@@id` for a composite key.

```ts
model User {
  id: UUID @id @default(gen_random_uuid())
}
```

```ts
model ProductOrder {
  orderId:   UUID
  productId: UUID

  @@id(fields: [orderId, productId])
}
```

Composite keys expose one path segment per field (`/product-orders/:orderId/:productId`).

### Defaults (`@default`)

Literals, enum values, or call expressions. Fields with `@default` are optional on create.

```ts
model User {
  id:        UUID      @id @default(gen_random_uuid())
  role:      UserRole  @default(USER)
  isActive:  BOOLEAN   @default(true)
  createdAt: TIMESTAMP @default(now())
}
```

Built-in functions: `gen_random_uuid()`, `now()`.

### Unique constraints (`@unique`)

```ts
model User {
  email: VARCHAR(255) @unique
}
```

For a partial unique index, use `@@index` with `unique: true` instead — see [Indexes](#indexes-index).

### Validation (`@regex`, `@range`)

Constraints flow into generated Zod request validators. The `message` is returned as the API error.

```ts
model User {
  email: VARCHAR(255) @regex(pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$", message: "Invalid email address")
  age:   SMALLINT?    @range(min: 1, max: 120, message: "Age must be between 1 and 120")
}
```

Failed validation responds with `{ "error": "Invalid email address" }`.

### Response shaping (`@omit`)

Exclude a stored field from generated API JSON. The DB client still returns the full row.

```ts
model User {
  passwordHash: VARCHAR(255)? @omit
}
```

`@omit` fields are never URL-filterable. On read endpoints with `include`, they are stripped recursively on nested objects as well.

### Query filters (`@unfilterable`)

Scalar fields are URL-filterable by default (`?role=ADMIN`, `?balance_gte=100`). Opt out per field:

```ts
model User {
  id:        UUID      @id @unfilterable
  updatedAt: TIMESTAMP? @unfilterable
}
```

### Relation includes (`@unincludeable`)

Relation fields can be loaded via `?include=profile,orders`. Block that on a field:

```ts
model User {
  orders: Order[] @unincludeable
}
```

### Relations (`@relation`)

Relation fields point at another model. The side that owns the foreign-key column declares `@relation` with `fields` and `references`. The inverse side is inferred — no `@relation` needed.

**One-to-many**

```ts
model User {
  orders: Order[]
}

model Order {
  userId: UUID
  user:   User @relation(fields: [userId], references: [id])
}
```

**One-to-one** — unique FK on the owning side, optional inverse:

```ts
model User {
  profile: Profile?
}

model Profile {
  userId: UUID @unique
  user:   User @relation(fields: [userId], references: [id])
}
```

**Referential actions** (`onDelete`, `onUpdate`) are optional: `CASCADE`, `SET_NULL`, `RESTRICT`, `NO_ACTION`.

```ts
model Profile {
  userId: UUID @unique
  user:   User @relation(
    fields: [userId],
    references: [id],
    onDelete: CASCADE,
    onUpdate: SET_NULL
  )
}
```

**Named relations** — only when two models relate more than once. Both sides must use the same `name`:

```ts
model User {
  writtenPosts: Post[] @relation(name: "PostAuthor")
  editedPosts:  Post[] @relation(name: "PostEditor")
}

model Post {
  authorId: UUID
  editorId: UUID?
  author: User  @relation(name: "PostAuthor", fields: [authorId], references: [id])
  editor: User? @relation(name: "PostEditor", fields: [editorId], references: [id])
}
```

`include` and API paths use the **field name** (`profile`, `orders`, `author`) — not the optional `name` argument. Foreign keys are named from table and column names.

| Argument | Required | Purpose |
|----------|----------|---------|
| `fields` | Yes (FK side) | Local column(s) on this model |
| `references` | Yes (FK side) | Target column(s) on the related model |
| `onDelete` | No | PostgreSQL `ON DELETE` action |
| `onUpdate` | No | PostgreSQL `ON UPDATE` action |
| `name` | No | Disambiguates multiple relations between the same two models |

**Many-to-many** is an explicit join model with two `@relation`s (and usually `@@id`):

```ts
model ProductOrder {
  orderId:   UUID
  productId: UUID
  quantity:  INTEGER

  order:   Order   @relation(fields: [orderId], references: [id])
  product: Product @relation(fields: [productId], references: [id])

  @@id(fields: [orderId, productId])
}
```

### REST surface (`@rest`)

By default every model gets full CRUD. `@rest` chooses which HTTP handlers are generated. Disabled methods return `404` and are omitted from OpenAPI. The DB client is unaffected.

```ts
model User {
  id: UUID @id
  @rest(except: [create, update, delete])   // keep list + get
}
```

```ts
model Report {
  id: UUID @id
  @rest(only: [list, get])
}
```

```ts
model Internal {
  id: UUID @id
  @rest(false)   // no HTTP for this model (`@rest` alone is the same)
}
```

| DSL operation | HTTP | Path |
|---------------|------|------|
| `list` | `GET` | `/` |
| `get` | `GET` | `/{pk}` |
| `create` | `POST` | `/` |
| `update` | `PUT` | `/{pk}` |
| `delete` | `DELETE` | `/{pk}` |

Do not mix `only` and `except`. For custom handlers on the same path, see [REST API](docs/rest-api.md).

### Access control (`@policy`)

Attach one or more policies to a model. Models without `@policy` are open. `@policy` only gates **generated** handlers — use `@rest` when an operation should not exist as HTTP at all.

```ts
model User {
  id: UUID @id

  @policy(role: USER, allow: [select], where: "id = {{auth.user.id}}")
  @policy(role: ADMIN, allow: all)
}
```

| Argument | Description |
|----------|-------------|
| `role` | Enum identifier (typically a `UserRole` value) |
| `allow` | `all` or `[select, insert, update, delete]` |
| `where` | Optional row-level filter; supports `{{auth.user.id}}` |

`GET` → `select`, `POST` → `insert`, `PUT` → `update`, `DELETE` → `delete`. Unauthenticated requests default to `{ role: 'PUBLIC' }`.

`where` is a single condition today (`id = {{auth.user.id}}`, `balance >= 100`). See [Access control](docs/access-control.md) for enforcement, JWT claims, and pluggable auth.

### Indexes (`@@index`)

```ts
model User {
  role:     UserRole
  isActive: BOOLEAN
  name:     VARCHAR(150)
  email:    VARCHAR(255)

  @@index(fields: [role, isActive])
  @@index(fields: [name], where: "isActive = true", name: "active_users_name_idx", type: BTREE)
  @@index(fields: [email], unique: true, where: "role = 'PUBLIC'")
}
```

| Argument | Required | Purpose |
|----------|----------|---------|
| `fields` | Yes | Indexed columns |
| `where` | No | Partial index predicate |
| `name` | No | Explicit index name |
| `type` | No | `BTREE`, `GIN`, `GIST`, `HASH`, `BRIN` |
| `unique` | No | Unique index |

### Triggers (`@@trigger`)

`execute` is the PL/pgSQL function body (wrapped in `BEGIN` / `END` for you). A model may have multiple triggers.

```ts
model User {
  balance: INTEGER

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
```

| Argument | Values | Default |
|----------|--------|---------|
| `timing` | `BEFORE`, `AFTER` | — |
| `event` | `INSERT`, `UPDATE`, `DELETE` | — |
| `level` | `ROW`, `STATEMENT` | `ROW` |
| `execute` | Triple-quoted PL/pgSQL | — |

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
# → API docs at http://localhost:3000/docs
```

Or run each step individually:

```bash
# Start PostgreSQL ( matches .env defaults)
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
| `.env` | `DATABASE_URL`, JWT settings, `CORS_ORIGIN` |
| `docker-compose.yml` | Local PostgreSQL on `:5432` |
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
| `generated/routes/*.ts` | CRUD routers per model (`@rest` may omit methods) |
| `generated/policies.ts` | ACL metadata from `@policy` |
| `generated/schemas/validation.ts` | Zod request validators |

Generated code imports the runtime from the `schematic-pg` package (`schematic-pg/api/*`, `schematic-pg/db/*`). You do not copy framework source into your project.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `PORT` | `3000` | HTTP listen port |
| `JWT_SECRET` | — | HMAC secret for JWT sign + verify (required for auth) |
| `AUTH_PEPPER` | — | App-side pepper appended before Argon2 hash/verify (required for register/login) |
| `AUTH_ACCESS_TOKEN_TTL` | `1h` | Access token lifetime (`15m`, `1h`, or seconds) |
| `JWT_ROLE_CLAIM` | `role` | JWT claim mapped to `auth.role` |
| `JWT_USER_ID_CLAIM` | `sub` | JWT claim mapped to `auth.user.id` |
| `CORS_ORIGIN` | — (disabled) | Allowed browser origins. Unset disables CORS. Use `*` for any origin (no cookies), or a comma-separated list (`http://localhost:5173,https://app.example.com`). Concrete origins enable credentialed CORS |
| `CORS_ALLOW_HEADERS` | — | Extra allowed request headers (comma-separated), merged with `Authorization`, `Content-Type`, `X-CSRF-Token` |

Set these in `.env` before running `dev`, `start`, or `db:bootstrap`.

Browser frontends on another origin need `CORS_ORIGIN`. The generated app reads it at runtime (no regenerate). Preflight `OPTIONS` is handled automatically; concrete origins enable cookies via `credentials: 'include'`. See [CORS](docs/rest-api.md#cors).

---

## Authentication

schematic-pg verifies Bearer JWTs on every request and ships a reusable auth layer for **register / login / token issuance**. Runtime lives in the package (`schematic-pg/api/auth/*`); projects mount a thin custom route that auto-registers at `/auth`.

### Enable routes

`init` scaffolds `src/routes/auth.ts`:

```ts
import { createAuthRouter } from 'schematic-pg/api/auth/routes';

export default createAuthRouter();
```

After `generate:api`, the custom-route scanner mounts it at `/auth`. Options let you map your user model/fields (`userModel`, `emailField`, `passwordHashField`, `roleField`, `defaultCreateFields`, …).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/register` | Create user (hashes password, issues access token). Bypasses model `@policy` — do not weaken insert policies for signup. |
| `POST` | `/auth/login` | Verify password, optional rehash, issue access token |
| `GET` | `/auth/me` | Current `auth` context from the JWT middleware |

Register/login responses: `{ token, user }` with `passwordHash` omitted (`@omit` / `omitFields`).

### Password hashing

Use Argon2id via `schematic-pg/api/auth/password`:

```ts
import { passwordService } from 'schematic-pg/api/auth/password';
import { UnauthorizedError } from 'schematic-pg/api/auth/errors';

const hash = await passwordService.hashPassword(password);
const valid = await passwordService.verifyPassword(password, user.passwordHash);
if (!valid) throw new UnauthorizedError();
if (passwordService.needsRehash(user.passwordHash)) {
  const newHash = await passwordService.hashPassword(password);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
}
```

### Tokens

`createTokenService()` signs HS256 access tokens with `iat`/`exp`, using the same claim names as `createJwtResolver` (`sub` + `role` by default). The resolver rejects expired (`exp`) and not-yet-valid (`nbf`) tokens when those claims are present.

### Security notes

- **Argon2id** with automatic salt; encoded `$argon2id$…` digest stores algo, version, params, salt, and hash.
- **Pepper** (`AUTH_PEPPER`) is applied before hash/verify and never stored in the DB.
- **Verify** uses Argon2’s constant-time check — never compare hash strings manually.
- **No user enumeration** on login: same 401 message whether the email is missing or the password is wrong; verify always runs (dummy hash when no user).
- **Expiry enforcement** on JWT verify; issued tokens always carry `exp`.
- Never log passwords, hashes, pepper, or `JWT_SECRET`. Keep `passwordHash` `@omit` so it never appears in API JSON.

### Future extensions

Password reset, MFA, session/refresh-token management, and login rate limiting are intentionally out of scope for this release.

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
schematic-pg generate:api [schema]      # generated/app.ts, routes/, policies, schemas, openapi
```

Run `generate:client` before `generate:api` when using the split commands — routes depend on `generated/db.ts`. After the server starts, open [http://localhost:3000/docs](http://localhost:3000/docs) for Scalar docs (OpenAPI at `/openapi.json`).

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
schematic-pg db:bootstrap [schema]         # Reset public schema, apply DDL, write .schema-state snapshot
schematic-pg db:diff [schema]              # Print pending schema changes (snapshot vs app.schema)
schematic-pg db:diff --name add_users      # Write a migration file under migrations/
schematic-pg db:migrate [schema]           # Apply pending migration files
schematic-pg db:migrate:status [schema]    # Show snapshot + migration file status
```

`db:bootstrap` resets the `public` schema then applies full DDL — safe to re-run locally (including via `dev` watch). Use `db:diff` / `db:migrate` when evolving a database you need to keep.

For a full walkthrough (mental model, local loop, and automating staging/production with GitHub Actions), see [Migrations tutorial](docs/migrations.md).

Alternatively, apply SQL manually:

```bash
psql $DATABASE_URL -f schema.sql
```

### Help

```bash
schematic-pg --help
```

---

## Documentation

- [Philosophy & features](docs/philosophy.md)
- [How it works](docs/how-it-works.md)
- [Database client](docs/database-client.md)
- [REST API](docs/rest-api.md)
- [Access control](docs/access-control.md)
- [Migrations tutorial](docs/migrations.md) — schema diffs, `db:migrate`, and GitHub Actions for staging/production
- [Project structure](docs/project-structure.md)
- [Contributing (this repo)](docs/contributing.md)
- [Why schematic-pg?](docs/why.md)
- [Roadmap](docs/roadmap.md)

---

## License

MIT
