# Roadmap

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
