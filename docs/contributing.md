# Contributing (this repo)

Contributors working on the framework itself clone the repo and use npm scripts (which delegate to the same CLI via `tsx`):

```bash
cp .env.example .env          # configure DATABASE_URL
npm run build                 # compile src/ → dist/ (required for schematic-pg/* imports)
npm run docker:up             # PostgreSQL on :5432
npm run generate              # write schema.sql from app.schema
npm run generate:client       # write generated/db*.ts
npm run generate:api          # write generated/app.ts, routes/, schemas/
npm run db:bootstrap          # apply DDL + snapshot schema state
npm run dev:api               # regenerate client + API and start server on :3000
npm run start                 # production server (migrate + run generated/app.ts)
npm test                      # unit tests
npm run test:integration      # Docker + generate + DB client + ACL integration tests
```
