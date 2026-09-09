// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseModelBody } from '../../schema-dsl/__tests__/helpers.js';
import { normalizeRest, REST_OPERATIONS } from '../utils/rest.js';

describe('normalizeRest', () => {
  it('defaults to all operations when @rest is absent', () => {
    const model = parseModelBody('id: UUID @id');

    assert.deepEqual([...normalizeRest(model).operations].sort(), [...REST_OPERATIONS].sort());
  });

  it('disables all operations for bare @rest', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest
    `);

    assert.equal(normalizeRest(model).operations.size, 0);
  });

  it('disables all operations for @rest(false)', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(false)
    `);

    assert.equal(normalizeRest(model).operations.size, 0);
  });

  it('keeps all operations for @rest(true)', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(true)
    `);

    assert.deepEqual([...normalizeRest(model).operations].sort(), [...REST_OPERATIONS].sort());
  });

  it('applies only allow-list', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(only: [list, get])
    `);

    assert.deepEqual([...normalizeRest(model).operations].sort(), ['get', 'list']);
  });

  it('applies except deny-list', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(except: [create, update, delete])
    `);

    assert.deepEqual([...normalizeRest(model).operations].sort(), ['get', 'list']);
  });

  it('rejects mixing only and except', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(only: [list], except: [create])
    `);

    assert.throws(() => normalizeRest(model), /cannot mix only and except/);
  });

  it('rejects empty @rest()', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest()
    `);

    assert.throws(() => normalizeRest(model), /empty/);
  });

  it('rejects duplicate @rest attributes', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(only: [list])
      @rest(except: [create])
    `);

    assert.throws(() => normalizeRest(model), /duplicate @rest/);
  });

  it('rejects HTTP verbs with a hint', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(except: [POST, PUT, DELETE])
    `);

    assert.throws(() => normalizeRest(model), /use create instead of HTTP verb "POST"/);
  });

  it('rejects unknown operation names', () => {
    const model = parseModelBody(`
      id: UUID @id
      @rest(only: [upsert])
    `);

    assert.throws(() => normalizeRest(model), /Unknown @rest operation "upsert"/);
  });

  it('rejects @rest attached to a field', () => {
    const model = parseModelBody(`
      id: UUID @id @rest(except: [create, update, delete])
    `);

    assert.throws(
      () => normalizeRest(model),
      /must be a model attribute, not a field attribute on "id"/,
    );
  });
});
