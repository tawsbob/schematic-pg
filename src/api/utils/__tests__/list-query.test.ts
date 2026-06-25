import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildListQuery } from '../list-query.js';

const userFields = [
  {
    name: 'email',
    kind: 'string' as const,
    operators: ['equals', 'contains', 'startsWith', 'endsWith'] as const,
  },
  {
    name: 'role',
    kind: 'enum' as const,
    operators: ['equals', 'in'] as const,
    enumValues: ['ADMIN', 'USER', 'PUBLIC'],
  },
  {
    name: 'balance',
    kind: 'numeric' as const,
    operators: ['equals', 'gt', 'gte', 'lt', 'lte'] as const,
  },
  {
    name: 'isActive',
    kind: 'boolean' as const,
    operators: ['equals'] as const,
  },
] as const;

const sortableFields = ['email', 'role', 'balance', 'isActive', 'createdAt'] as const;

describe('buildListQuery', () => {
  it('maps equality and operator suffix filters', () => {
    const result = buildListQuery(
      {
        email_contains: '@',
        role: 'ADMIN',
        balance_gte: '100',
        isActive: 'true',
      },
      userFields,
      sortableFields,
    );

    assert.deepEqual(result.where, {
      AND: [
        { email: { contains: '@' } },
        { role: 'ADMIN' },
        { balance: { gte: 100 } },
        { isActive: true },
      ],
    });
  });

  it('parses enum in filters', () => {
    const result = buildListQuery({ role_in: 'ADMIN,USER' }, userFields, sortableFields);

    assert.deepEqual(result.where, {
      role: { in: ['ADMIN', 'USER'] },
    });
  });

  it('maps pagination and sort', () => {
    const result = buildListQuery(
      { limit: '10', offset: '20', sort: '-createdAt' },
      userFields,
      sortableFields,
    );

    assert.equal(result.take, 10);
    assert.equal(result.skip, 20);
    assert.deepEqual(result.orderBy, { createdAt: 'desc' });
  });

  it('ignores operator filters when equality is set for the same field', () => {
    const result = buildListQuery(
      { email: 'a@b.com', email_contains: '@' },
      userFields,
      sortableFields,
    );

    assert.deepEqual(result.where, { email: 'a@b.com' });
  });

  it('throws for invalid sort fields', () => {
    assert.throws(
      () => buildListQuery({ sort: 'passwordHash' }, userFields, sortableFields),
      /Invalid sort field "passwordHash"/,
    );
  });
});
