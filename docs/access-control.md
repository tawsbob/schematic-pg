# Access Control (`@policy`)

Define who can do what — and which rows they can touch — directly on your models. Policies are parsed from the schema, emitted to `generated/policies.ts`, and enforced in generated route handlers at runtime. For the fuller schema syntax including `@policy` examples, see [The DSL](../README.md#the-dsl).

## Defining policies

Attach one or more `@policy` attributes to a model:

```ts
model User {
  id:   UUID @id @default(gen_random_uuid())
  role: UserRole @default(USER)
  // ...

  @policy(role: USER, allow: [select], where: "id = {{auth.user.id}}")
  @policy(role: ADMIN, allow: all)
}
```

| Argument | Type | Description |
|----------|------|-------------|
| `role` | enum identifier | Role this policy applies to (must match a value in your schema enums, e.g. `UserRole`) |
| `allow` | `all` or `[select, insert, update, delete]` | Operations permitted for this role |
| `where` | string (optional) | Row-level filter applied on read/update/delete; supports `{{auth.*}}` templates |

**Operations map to HTTP methods:**

| HTTP | Policy operation |
|------|------------------|
| `GET` | `select` |
| `POST` | `insert` |
| `PUT` | `update` |
| `DELETE` | `delete` |

Models **without** `@policy` attributes are open — generated routes skip ACL checks entirely (e.g. `Log` in the sample schema).

Use `@rest` when an operation should not exist as HTTP at all (custom signup, checkout workflows). `@policy` only controls who may call a **generated** handler.

## How enforcement works

For each model that has policies, generated routes call the policy guard before every DB operation:

```typescript
const auth = c.get('auth');
const policy = assertPolicy('User', auth.role, 'select');
const policyWhere = resolvePolicyWhere(policy, auth);
const rows = await db.user.findMany({ where: policyWhere });
```

1. **`assertPolicy(model, role, operation)`** — Looks up the policy for the caller's role in `generated/policies.ts`. Throws `403 Forbidden` if the role has no policy or the operation is not in `allow`. Returns the matched policy.
2. **`resolvePolicyWhere(policy, auth)`** — Interpolates `{{auth.user.id}}` (and other `{{auth.*}}` paths) from the request auth context, then parses the result into a `WhereInput` object.
3. **`mergeWhere(routeWhere, policyWhere)`** — Combines route params (e.g. `:id`) with the policy filter via `AND` on read/update/delete.

`POST` (insert) checks operation permission only — no `where` injection.

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

## Where templates

Policy `where` clauses support `{{auth.*}}` placeholders resolved against the auth context:

```ts
where: "id = {{auth.user.id}}"
```

After interpolation, simple `field op value` forms are parsed into `WhereInput`:

| Form | Example |
|------|---------|
| Equality | `id = {{auth.user.id}}` → `{ id: '…' }` |
| Comparison | `balance >= 100` → `{ balance: { gte: 100 } }` |
| Inequality | `role != ADMIN` → `{ NOT: { role: 'ADMIN' } }` |

Complex multi-clause SQL in `where` is not supported yet — keep policies to a single condition for now.

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
