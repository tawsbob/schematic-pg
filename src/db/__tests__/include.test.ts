// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadRepoSchema } from '../../__tests__/helpers/repo-schema.js';
import { stitch } from '../include/hydrator.js';
import { buildLoadPlan } from '../include/planner.js';
import { buildModelMeta, buildModelMetas } from '../model-meta.js';

const { schema } = loadRepoSchema();
const metas = buildModelMetas(schema);
const registry = new Map(metas.map((meta) => [meta.name, meta]));
const userMeta = registry.get('User');
assert.ok(userMeta);

describe('buildLoadPlan', () => {
  it('builds nested include tree', () => {
    const plan = buildLoadPlan(
      userMeta,
      {
        orders: {
          include: {
            products: true,
          },
        },
      },
      registry,
    );

    assert.equal(plan.model.name, 'User');
    assert.equal(plan.children.length, 1);
    assert.equal(plan.children[0]!.relation?.name, 'orders');
    assert.equal(plan.children[0]!.children.length, 1);
    assert.equal(plan.children[0]!.children[0]!.relation?.name, 'products');
    assert.equal(plan.strategy, 'split');
  });

  it('throws for unknown include relation', () => {
    assert.throws(
      () => buildLoadPlan(userMeta, { missing: true }, registry),
      /Unknown include relation "missing"/,
    );
  });
});

describe('stitch', () => {
  it('attaches hasMany children in O(n) buckets', () => {
    const relation = userMeta.relationByName.get('orders');
    assert.ok(relation);

    const parents = [
      { id: 'user-1', name: 'Alice' },
      { id: 'user-2', name: 'Bob' },
    ];
    const children = [
      { id: 'order-1', userId: 'user-1', status: 'PENDING' },
      { id: 'order-2', userId: 'user-1', status: 'SHIPPED' },
      { id: 'order-3', userId: 'user-2', status: 'PENDING' },
    ];

    stitch(parents, children, relation);

    assert.equal((parents[0]!.orders as unknown[]).length, 2);
    assert.equal((parents[1]!.orders as unknown[]).length, 1);
  });

  it('attaches hasOne child or null', () => {
    const relation = userMeta.relationByName.get('profile');
    assert.ok(relation);

    const parents = [{ id: 'user-1', name: 'Alice' }];
    const children = [{ id: 'profile-1', userId: 'user-1', bio: 'Hello' }];

    stitch(parents, children, relation);
    assert.equal((parents[0]!.profile as { bio: string }).bio, 'Hello');

    const emptyParents = [{ id: 'user-2', name: 'Bob' }];
    stitch(emptyParents, [], relation);
    assert.equal(emptyParents[0]!.profile, null);
  });
});
