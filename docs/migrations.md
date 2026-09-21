# Migrations tutorial

schema-driven migrations: edit the schema (`app.schema` or `schema/*.schema`), generate SQL from the diff against a local snapshot, commit numbered `.sql` files, then apply them in staging/production.

## Mental model

Three pieces stay in sync:

| Piece | Role |
|--------|------|
| Schema source (`app.schema` or `schema/*.schema`) | Desired schema (source of truth you edit) |
| `.schema-state/app.schema` | Merged snapshot of the schema **last applied** to the DB |
| `migrations/*.sql` | Ordered SQL that moves the DB from old → new |

`db:diff` compares **snapshot vs the current loaded schema**, not live Postgres introspection. With fragments, the snapshot is always the merged canonical text (see [Schema fragments](schema-fragments.md)).

Apply tracking uses the `_schema_migrations` table (`id`, `name`, `filename`, `applied_at`). Filenames look like `0001_add_users.sql`.

**Commit both** `migrations/` and `.schema-state/` in app repositories so CI and teammates share the same baseline. A missing snapshot blocks `db:diff` until you run `db:bootstrap` (which writes the merged snapshot).

---

## 1. First-time database (bootstrap)

For a new or empty database:

```bash
npx schematic-pg db:bootstrap
# or via: npx schematic-pg dev  (runs bootstrap for you)
```

That:

1. Resets the `public` schema (`DROP SCHEMA ... CASCADE`)
2. Generates full DDL from the loaded schema and runs it against `DATABASE_URL`
3. Writes `.schema-state/app.schema` as the baseline (merged canonical text)

No `migrations/` files are required at this stage. Prefer bootstrap for greenfield local/dev setups — including `dev` watch reloads, which re-bootstrap on every schema change.

---

## 2. Evolve an existing database

### Edit

Change the schema source (add a model, field, constraint, etc. in `app.schema` or a fragment under `schema/`).

### Preview

```bash
npx schematic-pg db:diff
```

Prints the SQL that would bring the snapshot in line with the current schema. If the plan includes drops, the CLI warns about destructive changes.

### Write a migration file

```bash
npx schematic-pg db:diff --name add_users
# → migrations/0001_add_users.sql  (id auto-increments)
```

Review the generated SQL before committing—especially after a destructive warning.

### Apply

```bash
npx schematic-pg db:migrate
```

Each pending file runs in a transaction. On success it is recorded in `_schema_migrations`. After all pending files apply, the snapshot is refreshed from the current loaded schema.

### Check status

```bash
npx schematic-pg db:migrate:status
```

Shows snapshot presence, pending schema drift (snapshot vs current schema), and which migration files are `applied` / `pending`.

### Typical local loop

```text
edit schema (app.schema or schema/*.schema)
  → db:diff                 # review SQL
  → db:diff --name foo      # write migrations/NNNN_foo.sql
  → commit migrations/ + .schema-state/ + schema source
  → db:migrate              # apply locally (+ refresh snapshot)
  → generate                # refresh API/client if needed
```

After `db:migrate`, commit the updated `.schema-state/app.schema` so the next `db:diff` starts from the applied baseline.

### Partitions

`@@partition` children are first-class migration objects:

| Schema change | Diff result |
|---------------|-------------|
| Add a `partition Name { … }` | `CREATE TABLE … PARTITION OF …` |
| Remove a `partition Name { … }` | `ALTER TABLE … DETACH PARTITION …` then `DROP TABLE … CASCADE` (destructive) |
| New partitioned model | `CREATE TABLE` parent (`PARTITION BY`) + create each child |
| Drop partitioned model | `DROP TABLE parent CASCADE` only (children go with it) |
| Rename a partition | Drop old + create new (data loss unless you edit the SQL) |
| Change `by` / `fields` / `expression` / HASH `count` | **Error** — unsupported rewrite; write a manual `migrations/*.sql` |
| Convert a normal table to partitioned (or back) | `ConvertToPartitioned` / `ConvertFromPartitioned` rewrite (destructive) |
| Change bounds/`in`/remainder on the same name | **Error** — drop the old name and add a new one |

`DropPartition`, `ConvertToPartitioned`, and `ConvertFromPartitioned` are included in the destructive-change warning from `db:diff`. You can delete the `DROP TABLE` line after `DETACH` if you want to keep the data as a standalone table.

#### Converting to / from a partitioned table

Postgres cannot `ALTER` a heap table into `PARTITION BY`. When you add or remove `@@partition` on an existing model, `db:diff` emits a rewrite:

1. Drop incoming foreign keys that reference the table.
2. `ALTER TABLE … RENAME TO …_pre_partition`.
3. `CREATE TABLE` in the new shape (`PARTITION BY` when converting to partitioned).
4. To-partitioned only: create each child with `PARTITION OF`.
5. `INSERT INTO … SELECT …` for columns present on both sides (type casts when the column type changed). New columns take their defaults. Dropped columns are not copied.
6. Recreate indexes, triggers, and foreign keys on the new table.
7. Drop the staging table (`CASCADE` when converting back to a heap table, so partition children go with it).

Same-diff column, index, trigger, and foreign-key changes for that model are folded into this rewrite — you will not see separate `AddColumn` / `CreateIndex` / `AddConstraint` lines for it.

#### Production pitfalls

Treat convert migrations as a **maintenance-window** operation, not an online schema tweak.

- **Locks.** The rewrite holds exclusive locks on the table and on tables that have foreign keys to it for the duration of the copy. Small tables finish quickly; large tables mean downtime.
- **Disk and WAL.** The copy needs roughly twice the disk until the staging table is dropped, and it writes a full-table amount of WAL.
- **Transactional safety.** `db:migrate` runs each file in one transaction. If any row fails to land in a partition, or a type cast / `NOT NULL` fails, the whole migration rolls back and the old table remains.
- **Out-of-range rows.** Rows that match no child cause the `INSERT` to fail. Fix the bounds (or the data) before retrying. Diff does not invent a default partition to catch them.
- **Primary key shape.** Adding `@@partition` usually forces a composite primary key that includes the partition key. Uniqueness on `id` alone goes away, and REST paths may change (for example `/logs/:id` → `/logs/:id/:createdAt`). Update clients before applying.
- **Dropped columns.** Values in columns removed in the same schema edit are not copied.
- **Triggers.** Triggers do not run during the bulk `INSERT`. Existing rows are copied as-is; later writes still fire triggers.
- **Objects outside the schema.** Grants, views, row-level security policies, and replication publications are not modeled. They stay attached to the staging table. The final drop can fail (and roll back), or with `CASCADE` on convert-from can drop dependent views. The new table also does not inherit old privileges — re-grant after migrate if you manage grants outside schematic-pg.
- **Statistics.** The new table has no planner stats until `ANALYZE`. The first queries after migrate can be slow; run `ANALYZE` on the parent (and children if needed).
- **Logical replication.** Subscribers do not follow the rewrite. Publications that listed the old table keep pointing at the staging name until it is dropped.

Checklist before applying in production: backup, verify every existing row fits a declared partition, schedule a window, review the generated SQL, apply, then `ANALYZE` and re-check grants / dependents.

---

## 3. Dev vs production

| Step | `dev` | `start` |
|------|-------|---------|
| Generate code | Yes | No |
| DB bootstrap | Yes | No |
| Apply pending migrations | No | Yes (default) |
| Wait for Postgres | Yes (via bootstrap) | Yes |
| Schema file watch | Yes (default) | No |
| `NODE_ENV` | unset | `production` |

- **Local/dev:** `schematic-pg dev` keeps the DB in sync via bootstrap + snapshot. It does **not** apply `migrations/` files.
- **Staging/prod:** commit `migrations/` (and `.schema-state/`), generate in CI/build, then apply migrations with `db:migrate` and/or `start`.

Split migrate from process start when a release job owns the database step:

```bash
npx schematic-pg db:migrate
npx schematic-pg start --no-migrate
```

Or let `start` migrate and run:

```bash
npx schematic-pg generate   # build step
npx schematic-pg start      # wait for DB → migrate → serve
```

---

## 4. Command cheat sheet

```bash
schematic-pg db:bootstrap          # greenfield: DDL + snapshot
schematic-pg db:diff               # print SQL for snapshot → current schema
schematic-pg db:diff --name name   # write migrations/NNNN_name.sql
schematic-pg db:migrate            # apply pending .sql files + update snapshot
schematic-pg db:migrate:status     # snapshot drift + file status
schematic-pg start [--no-migrate]  # production server (migrates by default)
```

**Rule of thumb:** bootstrap once (or in `dev`); for anything you ship, use `db:diff --name` → commit the file → `db:migrate` / `start`.

---

## 5. Automating staging and production with GitHub Actions

Treat migrations as a first-class deploy artifact: generate them locally (or in a PR job that only *checks* drift), commit them, then apply them in environment-gated workflows against each database.

### Prerequisites

1. **Commit** `migrations/` and `.schema-state/` (do not gitignore them in app repos).
2. Store per-environment secrets, for example:
   - `DATABASE_URL` — Postgres connection string for that environment
   - Any app secrets your deploy needs (`JWT_SECRET`, `AUTH_PEPPER`, `CORS_ORIGIN`, …)
3. Use [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) named `staging` and `production` so secrets and approval rules stay separate.
4. Prefer a **dedicated migrate job** before (or as part of) deploy—not ad-hoc SQL on the server.

### Recommended release shape

```text
PR / main
  → CI: install, generate, test
  → (optional) fail if db:diff would emit new SQL (migrations not committed)

Deploy to staging
  → checkout → install → generate
  → db:migrate (DATABASE_URL = staging)
  → deploy / start --no-migrate

Deploy to production
  → same steps with production secrets + environment protections
```

### Example: migrate staging on push to `main`

Save as `.github/workflows/migrate-staging.yml` in your **application** repo:

```yaml
name: Migrate staging

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      # Build generated/ before migrate if your pipeline needs it for the app;
      # migrate itself only needs migrations/ + DATABASE_URL (+ snapshot for status).
      - run: npx schematic-pg generate

      - name: Apply pending migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx schematic-pg db:migrate

      - name: Migration status
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx schematic-pg db:migrate:status
```

Follow with your usual deploy job (container, SSH, PaaS, etc.) that runs:

```bash
npx schematic-pg start --no-migrate
```

so the app does not race a second migrate.

### Example: production migrate with environment approval

```yaml
name: Migrate production

on:
  workflow_dispatch:
  # Or: release published / tag tags: ['v*']

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production   # require reviewers in GitHub Environment settings
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npx schematic-pg generate

      - name: Apply pending migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx schematic-pg db:migrate
```

Gate `production` with required reviewers so a human approves before SQL runs.

### Optional: fail CI when migrations are missing

Catch “edited the schema but forgot `db:diff --name`”:

```yaml
- name: Ensure schema matches committed migrations baseline
  run: |
    set -euo pipefail
    # Requires committed .schema-state/ (post-migrate snapshot).
    OUT=$(npx schematic-pg db:diff)
    if [ "$OUT" != "No schema changes detected." ]; then
      echo "$OUT"
      echo "::error::Schema drift detected. Run: npx schematic-pg db:diff --name <name> and commit migrations/ + .schema-state/"
      exit 1
    fi
```

Run this on pull requests that touch `app.schema`, `schema/`, or `migrations/`.

### Combined migrate + start on a long-lived runner

If the Action (or self-hosted runner) **is** the app host:

```yaml
- run: npx schematic-pg generate
- env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    AUTH_PEPPER: ${{ secrets.AUTH_PEPPER }}
    NODE_ENV: production
  run: npx schematic-pg start
  # start waits for Postgres, applies pending migrations, then serves
```

For most cloud setups, prefer **migrate in CI → deploy artifacts → `start --no-migrate`** so a bad migration fails the release before traffic switches.

### Operational tips

- **Never** use `db:bootstrap` against a shared staging/production database that already has data; bootstrap is for empty greenfield DBs.
- Keep **one linear history** of `NNNN_*.sql` files; avoid rewriting applied migrations.
- Point each GitHub Environment at its own `DATABASE_URL`.
- Ensure the runner can reach Postgres (public URL, VPN, self-hosted runner in the VPC, or a tunnel).
- Snapshot updates from `db:migrate` happen on the machine that ran migrate; after a local migrate, commit `.schema-state/` so CI’s drift check and the next `db:diff` stay correct. CI migrate jobs do not need to push snapshot updates if developers already committed the post-migrate snapshot with the migration files.
- For first production cutover from a bootstrapped DB with no migration files yet: either baseline by inserting current filenames into `_schema_migrations` after aligning the live schema, or generate an initial migration from a known snapshot and apply once in a controlled window.

### Minimal checklist

- [ ] `migrations/` and `.schema-state/` are committed
- [ ] `DATABASE_URL` (and app secrets) set per GitHub Environment
- [ ] Staging workflow runs `db:migrate` on every merge to `main` (or your release branch)
- [ ] Production workflow is manual or tag-gated with environment protection
- [ ] App process uses `start --no-migrate` when migrate ran in a prior job
- [ ] PR check fails on uncommitted schema drift (`db:diff` not empty)
