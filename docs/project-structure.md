# Project Structure

After `schematic-pg init` and `schematic-pg generate`, a typical application looks like this:

```
my-app/
├── app.schema              # Starter single-file schema (from init)
├── schema/                 # Optional: split into *.schema fragments
│   ├── extensions.schema
│   ├── user.schema
│   └── …
├── schema.sql              # Generated PostgreSQL DDL
├── .env                    # DATABASE_URL, JWT_*, CORS_ORIGIN
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

The schema source of truth is either `app.schema` or `schema/*.schema` (fragments win when that directory has files). See [Schema fragments](schema-fragments.md).

Framework runtime (query builder, auth middleware, validation, hook registry) is **not** copied into your project — it is imported from `node_modules/schematic-pg` at runtime. Only `generated/`, `src/routes/`, and `src/hooks/` contain project-specific code.

## This repository (framework source)

```
postgrest.js/
├── src/
│   ├── schema-dsl/         # Lexer, parser, AST, merge
│   ├── schema-source/      # File / fragment discovery + load
│   ├── sql-generator/      # DDL + migration planner
│   ├── db/                 # Query builder + client runtime + include eager-loading
│   ├── api/                # Hono runtime (published as schematic-pg/api/*)
│   ├── api-generator/      # AST → routes, Zod, policies, app
│   ├── cli/                # init templates + command helpers
│   └── cli.ts              # schematic-pg CLI entry point
├── dist/                   # Compiled output (npm publish target)
├── generated/              # Sample output from schema/ (this repo)
├── schema/                 # Sample multi-file schema fragments
└── editors/                # VS Code extension + language server
```
