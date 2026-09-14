import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';

describe('toSnakeCase', () => {
  it('converts PascalCase model names', () => {
    assert.equal(toSnakeCase('UserProfile'), 'user_profile');
  });

  it('converts camelCase field names', () => {
    assert.equal(toSnakeCase('totalAmount'), 'total_amount');
    assert.equal(toSnakeCase('isActive'), 'is_active');
    assert.equal(toSnakeCase('userId'), 'user_id');
  });

  it('converts index names', () => {
    assert.equal(toSnakeCase('activeUsersNameIdx'), 'active_users_name_idx');
  });

  it('converts letter-digit boundaries', () => {
    assert.equal(toSnakeCase('Log2024'), 'log_2024');
    assert.equal(toSnakeCase('MetricP0'), 'metric_p_0');
  });

  it('leaves lowercase strings unchanged', () => {
    assert.equal(toSnakeCase('email'), 'email');
  });
});

describe('toTableName', () => {
  it('uses singular snake_case table names', () => {
    assert.equal(toTableName('User'), 'user');
    assert.equal(toTableName('ProductOrder'), 'product_order');
  });
});

describe('quoteIdentifier', () => {
  it('quotes reserved PostgreSQL identifiers', () => {
    assert.equal(quoteIdentifier('user'), '"user"');
    assert.equal(quoteIdentifier('order'), '"order"');
    assert.equal(quoteIdentifier('profile'), 'profile');
  });
});
