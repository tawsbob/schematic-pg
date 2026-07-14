# schematic-pg

<img width="1254" height="1254" alt="schematic" src="https://github.com/user-attachments/assets/5b8f35b3-7e99-4779-aca3-ec3dbe27be56" />


> A single-file backend framework for PostgreSQL and Node.js. Define your database schema, ACL policies, and validations in one declarative DSL — then generate the SQL, the API, and the types.

---

## Documentation

- [Philosophy & features](docs/philosophy.md)
- [How it works](docs/how-it-works.md)
- [Database client](docs/database-client.md)
- [REST API](docs/rest-api.md)
- [Access control](docs/access-control.md)
- [Project structure](docs/project-structure.md)
- [Contributing (this repo)](docs/contributing.md)
- [Why schematic-pg?](docs/why.md)
- [Roadmap](docs/roadmap.md)

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

For `@policy` enforcement, JWT auth, and row-level filters, see [Access control](docs/access-control.md).

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

## License

MIT
