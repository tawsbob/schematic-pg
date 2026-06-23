# SchemaForge

> A single-file backend framework for PostgreSQL and Node.js. Define your database schema, ACL policies, and validations in one declarative DSL — then generate the SQL, the API, and the types.

---

## Philosophy

Most backend frameworks force you to scatter your truth across migrations, ORM models, Zod schemas, route handlers, and access control lists. SchemaForge inverts that: **your schema definition is the source of truth** for everything — the database, the REST API, and the runtime validations.

- **One file.** Schema, relations, triggers, indexes, and ACL in a single `.schema` file.
- **Zero ORM.** We generate raw PostgreSQL and parameterized queries. No hidden query builders, no N+1 surprises.
- **Hand-written parser.** A small, fast recursive-descent lexer/parser with zero parser-generator dependencies.
- **Hono-based runtime.** Lightweight, edge-ready HTTP handlers generated from your policies.

---

## Features

- **Declarative Schema DSL** — PostgreSQL-native types, enums, extensions, indexes, and triggers
- **Automatic SQL Generation** — idempotent DDL with snake_case naming conventions
- **Type-safe REST API** — Hono routes with generated Zod validation
- **Inline ACL** — Row-level and role-based access control defined next to your models
- **Validation Rules** — `@regex` and `@range` constraints that flow into both SQL `CHECK` constraints and request validators
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

    profile:   Profile?    @relation(name: "UserProfile")
    orders:    Order[]

    @policy(role: USER, allow: [select, insert, update])
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
      name: "UserProfile",
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
    │  SQL DDL    │                          │  Hono Routes │ │ Zod Schemas │
    │ Generator   │                          │  Generator   │ │ Generator   │
    └─────────────┘                          └──────────────┘ └─────────────┘
           │                                          │          │
           ▼                                          ▼          ▼
    ┌─────────────┐                          ┌──────────────────────────┐
    │  schema.sql │                          │      REST API            │
    │  (PostgreSQL)│                          │   (Hono + node-postgres) │
    └─────────────┘                          └──────────────────────────┘
```

1. **Parse** — The hand-written lexer and recursive-descent parser turn your `.schema` file into a typed AST.
2. **Generate SQL** — The DDL generator emits idempotent PostgreSQL: extensions, enums, tables, foreign keys, indexes, and triggers. All identifiers are automatically converted to `snake_case`.
3. **Generate API** — The route generator emits Hono routers with:
   - Zod-validated request bodies (driven by `@regex` and `@range`)
   - Role-based ACL middleware (driven by `@policy`)
   - Parameterized raw SQL queries (no ORM, no surprises)
4. **Run** — `app.ts` mounts all generated routers. You get a type-safe, policy-enforced REST API in seconds.

---

## Quick Start

```bash
# 1. Create your schema
npx schemaforge init
# → creates app.schema

# 2. Generate SQL and API
npx schemaforge generate
# → outputs schema.sql
# → outputs generated/ (routes, schemas, middleware)

# 3. Apply to your database
psql $DATABASE_URL -f schema.sql

# 4. Start the server
npx schemaforge dev
# → Hono server on http://localhost:3000
```

---

## Project Structure

```
my-project/
├── app.schema              # Your single source of truth
├── schema.sql              # Generated PostgreSQL DDL
├── generated/
│   ├── app.ts              # Hono entry point
│   ├── db.ts               # node-postgres pool
│   ├── middleware/
│   │   ├── auth.ts         # JWT / session extraction
│   │   ├── acl.ts          # Policy enforcement
│   │   └── validate.ts     # Zod validation helpers
│   ├── routes/
│   │   ├── users.ts
│   │   ├── profiles.ts
│   │   ├── orders.ts
│   │   └── ...
│   └── schemas/
│       └── validation.ts   # Generated Zod schemas
└── package.json
```

---

## Why SchemaForge?

| Concern | ORM Approach | SchemaForge Approach |
|---------|-----------|----------------------|
| Schema truth | Migrations + models + Zod + routes | One `.schema` file |
| Query visibility | Hidden behind ORM methods | Raw, parameterized SQL |
| Performance | N+1, lazy loading pitfalls | Explicit joins, no magic |
| ACL | External service or manual checks | Inline `@policy` directives |
| Validation | Separate Zod schemas | Derived from `@regex` / `@range` |
| Dependencies | Heavy (Prisma, Drizzle, etc.) | Hono + pg + Zod + hand-written parser |

---

## Roadmap

- [x] Hand-written lexer & recursive-descent parser
- [x] SQL DDL generator (full regeneration)
- [ ] Hono route generator with Zod validation
- [ ] Static ACL middleware generation
- [ ] Diff-based migration planner
- [ ] Row-level policy injection (`WHERE` clause generation)
- [ ] Type generation for frontend consumption
- [ ] Tree-sitter grammar for editor support
- [ ] VS Code extension with syntax highlighting

---

## License

MIT
