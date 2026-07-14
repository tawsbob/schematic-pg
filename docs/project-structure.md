# Project Structure

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

## This repository (framework source)

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
