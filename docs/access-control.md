# Access Control (`@policy`)

Define who can do what — and which rows they can touch — directly on your models. Policies are parsed from the schema, emitted to `generated/policies.ts`, and enforced in generated route handlers at runtime. For the schema syntax including `@policy` examples, see [Access control (`@policy`)](../README.md#access-control-policy).

## Defining policies

Attach one or more `@policy` attributes to a model:

```ts
model User {
  id:   UUID @id @default(gen_random_uuid())
  role: UserRole @default(USER)
  // ...

  @policy(role: USER, allow: [select], where: ownUser)
  @policy(role: ADMIN, allow: all)
}
```

| Argument | Type | Description |
|----------|------|-------------|
| `role` | enum identifier | Role this policy applies to (must match a value in your schema enums, e.g. `UserRole`) |
| `allow` | `all` or `[select, insert, update, delete]` | Operations permitted for this role |
| `where` | string, triple-quoted string, or predicate identifier (optional) | PostgreSQL boolean predicate applied on read/update/delete/insert; supports `{{auth.*}}` templates. An identifier must name an entry in the `predicates` section. |

**Operations map to HTTP methods:**

| HTTP | Policy operation |
|------|------------------|
| `GET` | `select` |
| `POST` | `insert` |
| `PUT` | `update` |
| `DELETE` | `delete` |

Models **without** `@policy` attributes are open — generated routes skip ACL checks entirely (e.g. `Log` in the sample schema).

Use `@rest` when an operation should not exist as HTTP at all (custom signup, checkout workflows). `@policy` only controls who may call a **generated** handler.

schematic-pg does **not** provide a built-in tenant, organization, or ownership model. Applications express their own authorization relationships as SQL predicates in `where`.

## How enforcement works

For each model that has policies, generated routes call the policy guard before every DB operation:

```typescript
const auth = c.get('auth');
const policy = assertPolicy('User', auth.role, 'select');
const policyWhere = resolvePolicyWhere(policy, auth);
const rows = await db.user.findMany({ where: mergeWhere(routeWhere, policyWhere) });
```

1. **`assertPolicy(model, role, operation)`** — Looks up the policy for the caller's role in `generated/policies.ts`. Throws `403 Forbidden` if the role has no policy or the operation is not in `allow`. Returns the matched policy.
2. **`resolvePolicyWhere(policy, auth)`** — Replaces each `{{auth.*}}` placeholder with a positional `$n` parameter (values are never concatenated into SQL), then returns a `$sql` `WhereInput` fragment.
3. **`mergeWhere(routeWhere, policyWhere)`** — Combines route params (e.g. `:id`) with the policy predicate via `AND` on read/update/delete.

`POST` (insert) checks operation permission and, when the matched policy has a `where`, enforces that predicate against the candidate row via `INSERT … SELECT … WHERE` (rejected inserts return `403`). Policies without `where` keep a normal `INSERT … VALUES`.

## Auth context

Every request gets an `auth` object on Hono context:

```typescript
type AuthContext = {
  role: string;
  user?: { id: string; [key: string]: unknown };
};
```

**Unauthenticated requests** (no `Authorization` header) default to `{ role: 'PUBLIC' }`. Missing token is not a `401` — only a malformed or invalid token when a Bearer header is present.

If the caller's role has no matching `@policy`, the runtime falls back to a `PUBLIC` role policy when one exists.

## Default JWT authentication

The generated app uses `createAuthMiddleware()` with a built-in Bearer JWT resolver (`src/api/auth/jwt-resolver.ts`):

```bash
curl http://localhost:3000/users \
  -H 'Authorization: Bearer <jwt>'
```

The resolver expects HS256 tokens and reads:

- `auth.role` ← claim named by `JWT_ROLE_CLAIM` (default: `role`)
- `auth.user.id` ← claim named by `JWT_USER_ID_CLAIM` (default: `sub`)

Set `JWT_SECRET` in `.env` when using the default resolver.

## Pluggable auth

Different systems resolve identity differently. Pass a custom `AuthResolver` to the middleware:

```typescript
import { createAuthMiddleware } from 'schematic-pg/api/auth/middleware';

app.use(createAuthMiddleware(async (c) => {
  const role = c.req.header('X-Role');
  const userId = c.req.header('X-User-Id');

  if (!role || !userId) {
    return null; // → defaults to { role: 'PUBLIC' }
  }

  return {
    role,
    user: { id: userId },
  };
}));
```

`AuthResolver` signature: `(c: Context<AppEnv>) => Promise<AuthContext | null>`.

Return `null` for anonymous callers; throw `UnauthorizedError` for invalid credentials.

## Where predicates

Policy `where` is a developer-authored PostgreSQL boolean expression, or a named entry from the `predicates` section. Dynamic authentication values use `{{auth.*}}` placeholders and become query parameters:

```ts
where: "id = {{auth.user.id}}"
```

becomes conceptually:

```sql
WHERE (id = $1)   -- $1 = authenticated user id
```

### Named predicates

Declare reusable SQL once in a `predicates` section (any fragment). Merge combines them by name. Each body is a string or a triple-quoted multiline string. `@policy` may reference a predicate by identifier; codegen inlines the SQL into `generated/policies.ts`.

```ts
predicates {
  ownUser: "id = {{auth.user.id}}"

  activeTeamMember: """
    team_id IN (
      SELECT team_id
      FROM team_member
      WHERE user_id = {{auth.user.id}}
        AND is_active = true
    )
  """
}

model User {
  id: UUID @id

  @policy(role: USER, allow: [select], where: ownUser)
  @policy(role: ADMIN, allow: all)
}

model Note {
  teamId: UUID

  @policy(role: USER, allow: [select, insert, update, delete], where: activeTeamMember)
  @policy(role: ADMIN, allow: all)
}
```

Unknown predicate names fail merged-schema validation. Prefer unqualified column names when a predicate is shared across models.

Arbitrary SQL expressions are supported, including `AND` / `OR`, `IN`, `EXISTS`, subqueries, functions, and casts. Use a triple-quoted string for multiline predicates (inline on `@policy` or in `predicates`):

**Ownership**

```ts
@policy(where: "user_id = {{auth.user.id}}", role: USER, allow: [select, update, delete])
```

**Scoped via subquery**

```ts
@policy(
  role: OWNER,
  allow: [select, update, delete],
  where: """
    restaurant_id IN (
      SELECT restaurant_id
      FROM "user"
      WHERE id = {{auth.user.id}}
    )
  """
)
```

**Membership via EXISTS**

```ts
@policy(
  role: MANAGER,
  allow: [select],
  where: """
    EXISTS (
      SELECT 1
      FROM restaurant_member rm
      WHERE rm.restaurant_id = product.restaurant_id
        AND rm.user_id = {{auth.user.id}}
        AND rm.is_active = true
    )
  """
)
```

Two roles that share the same predicate need two `@policy` attributes (one per `role`).

**Notes**

- Auth placeholders are parameterized; do not put `$1` / `$2` literals or `;` in the schema `where` text.
- String literals in SQL must use single quotes (`'ADMIN'`), not bare identifiers.
- Insert predicates can only see columns present in the request body — database defaults are not visible on the candidate row.
- Column names in predicates are PostgreSQL column names (`snake_case`), matching the generated tables.

## Generated policy metadata

`schematic-pg generate:api` emits `generated/policies.ts`:

```typescript
export const POLICIES: Record<string, NormalizedPolicy[]> = {
  User: [
    { role: 'USER', operations: ['select'], where: "id = {{auth.user.id}}" },
    { role: 'ADMIN', operations: 'all' },
  ],
};
```

This file is consumed by `assertPolicy` at runtime — do not edit manually.

## Example: scoped user access

With the sample `User` model (`@rest(except: [create, update, delete])` + the policies above):

| Caller | `GET /users` | `GET /users/:id` | `DELETE /users/:id` |
|--------|--------------|------------------|---------------------|
| No token (`PUBLIC`) | `403` | `403` | `404` (not generated) |
| JWT `role: USER`, `sub: <own-id>` | Returns own row only | Own row if `:id` matches | `404` (not generated) |
| JWT `role: ADMIN` | Returns all rows | Any row | `404` (not generated) |

Writes for `User` go through custom routes such as `POST /auth/register`. These scenarios are covered by `npm run test:integration` — see [`src/api/__tests__/acl.integration.test.ts`](../src/api/__tests__/acl.integration.test.ts).
