# How It Works

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
