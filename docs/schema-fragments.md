# Schema fragments

Author the schema as one file (`app.schema`) or as multiple domain fragments under `schema/`. Downstream tooling — SQL, migrations, the DB client, and the REST API — always sees one merged schema.

## Discovery

When a CLI command takes an optional `[schema]` path, schematic-pg resolves the source in this order:

1. **Explicit path** — a `.schema` file, or a directory of `*.schema` files
2. **`./schema/*.schema`** — if that directory exists and contains at least one `.schema` file
3. **`./app.schema`** — single-file fallback

`schematic-pg init` still scaffolds a single `app.schema`. Split into fragments when the project grows; an empty `schema/` directory does not switch modes.

```bash
schematic-pg generate              # schema/ if present, else app.schema
schematic-pg generate schema/      # force fragments directory
schematic-pg generate app.schema   # force single file
schematic-pg dev                   # watches the resolved source
```

## Fragment shape

Each fragment is a normal schema document. Include only the sections you need — empty `extensions {}` / `enums {}` / `models {}` / `functions {}` shells are unnecessary.

When a file has more than one section, keep this order:

`extensions` → `enums` → `models` → `functions`

Cross-file references are allowed. A model in `user.schema` may use an enum or related model declared in another fragment. Strict validation runs **once on the merged result**, so:

- Duplicate model / enum / function / extension names fail the build (errors name both files)
- A field type that is not a primitive, enum, or model fails validation (no silent raw SQL fallthrough)

## Layout example

This repository uses domain fragments:

```
schema/
  extensions.schema   # PostgreSQL extensions
  user.schema         # UserRole, User, Profile, getUserBalance
  order.schema        # OrderStatus, Order, ProductOrder
  product.schema      # Log, Product, searchProducts
```

**Extensions only:**

```ts
extensions {
  pgcrypto { version: "1.3" }
  uuid-ossp
}
```

**Models only:**

```ts
models {
  model Log {
    id:        UUID @id @default(gen_random_uuid())
    message:   TEXT
    createdAt: TIMESTAMP @default(now())
  }
}
```

**Domain fragment** (enums + models + functions):

```ts
enums {
  UserRole { ADMIN, USER, PUBLIC }
}

models {
  model User {
    id:    UUID @id @default(gen_random_uuid())
    email: VARCHAR(255) @unique
    role:  UserRole @default(USER)

    profile: Profile?
  }

  model Profile {
    id:     UUID @id @default(gen_random_uuid())
    userId: UUID @unique
    user:   User @relation(fields: [userId], references: [id])
  }
}

functions {
  function getUserBalance(userId: UUID): INTEGER {
    language: sql
    volatility: STABLE
    execute: """
      SELECT balance FROM "user" WHERE id = user_id
    """
  }
}
```

## Merge rules

Fragments are parsed individually, then merged:

1. Concatenate `extensions`, `enums`, `models`, and `functions`
2. Sort each list **by declaration name** (not file name or glob order)
3. Emit a canonical schema document for snapshots
4. Validate the merged AST once

Renaming or reordering fragment files with no semantic change produces the same `schema.sql`, the same codegen, and the same `.schema-state/` snapshot. File comments above a declaration are kept in the fragment file but are not part of the canonical snapshot text.

## Snapshot and migrations

`.schema-state/app.schema` always stores the **merged canonical text**, never a directory of fragments. `db:diff` / `db:migrate` compare that snapshot to the current loaded schema (file or fragments).

Edit fragments → `schematic-pg db:diff --name …` → apply with `db:migrate` (or use `dev`, which re-bootstraps locally). See [Migrations](migrations.md).

## Dev watch

`schematic-pg dev` watches:

- the single schema file in single-file mode, or
- the fragments directory recursively (files ending in `.schema`) in fragments mode

On change it regenerates, bootstraps, and restarts the server.
