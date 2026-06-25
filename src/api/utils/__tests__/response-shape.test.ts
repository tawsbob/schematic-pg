import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shapeResponse } from '../response-shape.js';

const omitByModel = {
  User: ['passwordHash'],
  Order: [],
  Profile: [],
} as const;

const relationTargets = {
  User: {
    profile: 'Profile',
    orders: 'Order',
  },
  Order: {
    user: 'User',
    products: 'ProductOrder',
  },
} as const;

describe('shapeResponse', () => {
  it('strips omitted fields on the root model', () => {
    const row = {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: 'secret',
    };

    const result = shapeResponse(row, 'User', omitByModel, relationTargets);

    assert.equal('passwordHash' in result, false);
    assert.equal(result.email, 'a@b.com');
  });

  it('strips omitted fields on nested relation models', () => {
    const row = {
      id: 'user-1',
      email: 'a@b.com',
      orders: [
        {
          id: 'order-1',
          user: {
            id: 'user-1',
            email: 'a@b.com',
            passwordHash: 'secret',
          },
        },
      ],
    };

    const result = shapeResponse(row, 'User', omitByModel, relationTargets);
    const nestedUser = (result.orders as Array<{ user: Record<string, unknown> }>)[0]!.user;

    assert.equal('passwordHash' in nestedUser, false);
    assert.equal(nestedUser.email, 'a@b.com');
  });

  it('preserves null relation values', () => {
    const row = {
      id: 'user-1',
      profile: null,
    };

    const result = shapeResponse(row, 'User', omitByModel, relationTargets);

    assert.equal(result.profile, null);
  });
});
