// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { buildModelMeta } from '../model-meta.js';
import { buildRelations } from '../utils/relations.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);

describe('buildRelations', () => {
  it('builds inverse hasMany and hasOne relations', () => {
    const userModel = schema.models.find((model) => model.name === 'User');
    assert.ok(userModel);

    const relations = buildRelations(userModel, schema);
    const orders = relations.find((relation) => relation.name === 'orders');
    const profile = relations.find((relation) => relation.name === 'profile');

    assert.ok(orders);
    assert.equal(orders.kind, 'hasMany');
    assert.equal(orders.targetModel, 'Order');
    assert.equal(orders.localKey, 'id');
    assert.equal(orders.foreignKey, 'userId');
    assert.equal(orders.unique, false);

    assert.ok(profile);
    assert.equal(profile.kind, 'hasOne');
    assert.equal(profile.targetModel, 'Profile');
    assert.equal(profile.localKey, 'id');
    assert.equal(profile.foreignKey, 'userId');
    assert.equal(profile.relationName, undefined);
  });

  it('builds belongsTo relations from FK side', () => {
    const orderModel = schema.models.find((model) => model.name === 'Order');
    assert.ok(orderModel);

    const relations = buildRelations(orderModel, schema);
    const user = relations.find((relation) => relation.name === 'user');
    const products = relations.find((relation) => relation.name === 'products');

    assert.ok(user);
    assert.equal(user.kind, 'belongsTo');
    assert.equal(user.localKey, 'userId');
    assert.equal(user.foreignKey, 'id');

    assert.ok(products);
    assert.equal(products.kind, 'hasMany');
    assert.equal(products.targetModel, 'ProductOrder');
  });

  it('hydrates relation metadata on model meta', () => {
    const userModel = schema.models.find((model) => model.name === 'User');
    assert.ok(userModel);

    const meta = buildModelMeta(userModel, schema);
    assert.ok(meta.relationByName.get('orders'));
    assert.ok(meta.relationByName.get('profile'));
  });
});
