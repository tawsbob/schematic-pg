// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenError } from '../errors.js';
import {
  assertPolicy,
  configurePolicies,
  mergeWhere,
  resolvePolicyWhere,
  SQL_WHERE_KEY,
  type NormalizedPolicy,
} from '../policy.js';
import { bindAuthTemplate } from '../template.js';
import type { AuthContext } from '../types.js';

const TEST_POLICIES: Record<string, NormalizedPolicy[]> = {
  User: [
    { role: 'USER', operations: ['select', 'insert', 'update'], where: 'id = {{auth.user.id}}' },
    { role: 'ADMIN', operations: 'all' },
  ],
  Product: [
    {
      role: 'OWNER',
      operations: ['select', 'update', 'delete'],
      where: `restaurant_id IN (
        SELECT restaurant_id
        FROM "user"
        WHERE id = {{auth.user.id}}
      )`,
    },
    {
      role: 'MANAGER',
      operations: ['select'],
      where: `EXISTS (
        SELECT 1
        FROM restaurant_member rm
        WHERE rm.restaurant_id = product.restaurant_id
          AND rm.user_id = {{auth.user.id}}
          AND rm.is_active = true
      )`,
    },
    {
      role: 'STAFF',
      operations: ['select'],
      where: 'restaurant_id = {{auth.user.id}} AND is_active = true',
    },
  ],
  MultiAuth: [
    {
      role: 'USER',
      operations: ['select'],
      where: 'owner_id = {{auth.user.id}} OR created_by = {{auth.user.id}}',
    },
  ],
};

configurePolicies(TEST_POLICIES);

const userAuth: AuthContext = {
  role: 'USER',
  user: { id: 'user-123' },
};

const adminAuth: AuthContext = {
  role: 'ADMIN',
  user: { id: 'admin-1' },
};

describe('assertPolicy', () => {
  it('allows configured role and operation', () => {
    const policy = assertPolicy('User', 'USER', 'select');

    assert.equal(policy.role, 'USER');
    assert.deepEqual(policy.operations, ['select', 'insert', 'update']);
  });

  it('allows ADMIN all operations', () => {
    const policy = assertPolicy('User', 'ADMIN', 'delete');

    assert.equal(policy.role, 'ADMIN');
    assert.equal(policy.operations, 'all');
  });

  it('denies missing role policy', () => {
    assert.throws(
      () => assertPolicy('User', 'PUBLIC', 'select'),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });

  it('denies disallowed operation', () => {
    assert.throws(
      () => assertPolicy('User', 'USER', 'delete'),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });
});

describe('bindAuthTemplate', () => {
  it('binds auth values as parameters without interpolating into SQL', () => {
    const bound = bindAuthTemplate('id = {{auth.user.id}}', userAuth);

    assert.equal(bound.sql, 'id = $1');
    assert.deepEqual(bound.params, ['user-123']);
    assert.equal(bound.sql.includes('user-123'), false);
  });

  it('binds multiple auth placeholders in order', () => {
    const bound = bindAuthTemplate(
      'owner_id = {{auth.user.id}} OR created_by = {{auth.user.id}}',
      userAuth,
    );

    assert.equal(bound.sql, 'owner_id = $1 OR created_by = $2');
    assert.deepEqual(bound.params, ['user-123', 'user-123']);
  });

  it('rejects positional parameters in the schema text', () => {
    assert.throws(
      () => bindAuthTemplate('id = $1', userAuth),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });

  it('rejects statement separators', () => {
    assert.throws(
      () => bindAuthTemplate('id = {{auth.user.id}}; DROP TABLE "user"', userAuth),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });
});

describe('resolvePolicyWhere', () => {
  it('resolves simple ownership policy into a parameterized $sql fragment', () => {
    const policy = assertPolicy('User', 'USER', 'select');
    const where = resolvePolicyWhere(policy, userAuth);

    assert.deepEqual(where, {
      [SQL_WHERE_KEY]: { sql: 'id = $1', params: ['user-123'] },
    });
  });

  it('returns undefined when policy has no where clause (role-only)', () => {
    const policy = assertPolicy('User', 'ADMIN', 'select');

    assert.equal(resolvePolicyWhere(policy, adminAuth), undefined);
  });

  it('preserves IN subqueries with auth parameters', () => {
    const policy = assertPolicy('Product', 'OWNER', 'select');
    const where = resolvePolicyWhere(policy, { role: 'OWNER', user: { id: 'owner-1' } });

    const fragment = where![SQL_WHERE_KEY] as { sql: string; params: unknown[] };
    assert.match(fragment.sql, /restaurant_id IN \(/);
    assert.match(fragment.sql, /WHERE id = \$1/);
    assert.deepEqual(fragment.params, ['owner-1']);
    assert.equal(fragment.sql.includes('owner-1'), false);
  });

  it('preserves EXISTS subqueries', () => {
    const policy = assertPolicy('Product', 'MANAGER', 'select');
    const where = resolvePolicyWhere(policy, { role: 'MANAGER', user: { id: 'mgr-1' } });

    const fragment = where![SQL_WHERE_KEY] as { sql: string; params: unknown[] };
    assert.match(fragment.sql, /^EXISTS \(/);
    assert.match(fragment.sql, /rm\.user_id = \$1/);
    assert.deepEqual(fragment.params, ['mgr-1']);
  });

  it('preserves AND / OR boolean expressions', () => {
    const policy = assertPolicy('Product', 'STAFF', 'select');
    const where = resolvePolicyWhere(policy, { role: 'STAFF', user: { id: 'staff-1' } });

    assert.deepEqual(where, {
      [SQL_WHERE_KEY]: {
        sql: 'restaurant_id = $1 AND is_active = true',
        params: ['staff-1'],
      },
    });
  });

  it('supports multiple auth parameters in one predicate', () => {
    const policy = assertPolicy('MultiAuth', 'USER', 'select');
    const where = resolvePolicyWhere(policy, userAuth);

    assert.deepEqual(where, {
      [SQL_WHERE_KEY]: {
        sql: 'owner_id = $1 OR created_by = $2',
        params: ['user-123', 'user-123'],
      },
    });
  });

  it('keeps independent where clauses per role when multiple policies exist', () => {
    const owner = resolvePolicyWhere(assertPolicy('Product', 'OWNER', 'select'), {
      role: 'OWNER',
      user: { id: 'o-1' },
    });
    const staff = resolvePolicyWhere(assertPolicy('Product', 'STAFF', 'select'), {
      role: 'STAFF',
      user: { id: 's-1' },
    });

    assert.notDeepEqual(owner, staff);
    assert.match((owner![SQL_WHERE_KEY] as { sql: string }).sql, /IN \(/);
    assert.match((staff![SQL_WHERE_KEY] as { sql: string }).sql, /AND is_active/);
  });
});

describe('mergeWhere', () => {
  it('merges route params with policy where via AND', () => {
    const policyWhere = {
      [SQL_WHERE_KEY]: { sql: 'id = $1', params: ['user-123'] },
    };
    const merged = mergeWhere({ id: 'route-id' }, policyWhere);

    assert.deepEqual(merged, {
      AND: [{ id: 'route-id' }, policyWhere],
    });
  });

  it('returns primary when policy where is empty', () => {
    assert.deepEqual(mergeWhere({ id: 'route-id' }), { id: 'route-id' });
  });
});
