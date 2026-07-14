# Philosophy & features

Most backend frameworks force you to scatter your truth across migrations, ORM models, Zod schemas, route handlers, and access control lists. schematic-pg inverts that: **your schema definition is the source of truth** for everything — the database, the REST API, and the runtime validations.

- **One file.** Schema, relations, triggers, indexes, and ACL in a single `.schema` file.
- **Zero ORM.** We generate raw PostgreSQL and parameterized queries. No hidden query builders — relation loading is explicit via `include`, with batched queries that avoid N+1 and cartesian explosion.
- **Hand-written parser.** A small, fast recursive-descent lexer/parser with zero parser-generator dependencies.
- **Hono-based runtime.** Lightweight HTTP handlers generated from your schema, with Zod validation on every write.

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
