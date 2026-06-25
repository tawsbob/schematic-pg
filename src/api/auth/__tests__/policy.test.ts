// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenError } from '../errors.js';
import {
  assertPolicy,
  configurePolicies,
  mergeWhere,
  resolvePolicyWhere,
  type NormalizedPolicy,
} from '../policy.js';
import type { AuthContext } from '../types.js';

const TEST_POLICIES: Record<string, NormalizedPolicy[]> = {
  User: [
    { role: 'USER', operations: ['select', 'insert', 'update'], where: 'id = {{auth.user.id}}' },
    { role: 'ADMIN', operations: 'all' },
  ],
};

configurePolicies(TEST_POLICIES);

const userAuth: AuthContext = {
  role: 'USER',
  user: { id: 'user-123' },
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

describe('resolvePolicyWhere', () => {
  it('resolves auth template into where input', () => {
    const policy = assertPolicy('User', 'USER', 'select');
    const where = resolvePolicyWhere(policy, userAuth);

    assert.deepEqual(where, { id: 'user-123' });
  });

  it('returns undefined when policy has no where clause', () => {
    const policy = assertPolicy('User', 'ADMIN', 'select');

    assert.equal(resolvePolicyWhere(policy, userAuth), undefined);
  });
});

describe('mergeWhere', () => {
  it('merges route params with policy where via AND', () => {
    const merged = mergeWhere({ id: 'route-id' }, { id: 'user-123' });

    assert.deepEqual(merged, {
      AND: [{ id: 'route-id' }, { id: 'user-123' }],
    });
  });

  it('returns primary when policy where is empty', () => {
    assert.deepEqual(mergeWhere({ id: 'route-id' }), { id: 'route-id' });
  });
});
