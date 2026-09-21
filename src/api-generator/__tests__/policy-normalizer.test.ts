// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseModelBody } from '../../schema-dsl/__tests__/helpers.js';
import { normalizePolicies } from '../utils/policy.js';

describe('normalizePolicies', () => {
  it('normalizes role, allow list, and where clause', () => {
    const model = parseModelBody(`
      id: UUID @id
      @policy(role: USER, allow: [select, insert, update], where: "id = {{auth.user.id}}")
      @policy(role: ADMIN, allow: all)
    `);

    assert.deepEqual(normalizePolicies(model), [
      {
        role: 'USER',
        operations: ['select', 'insert', 'update'],
        where: 'id = {{auth.user.id}}',
      },
      {
        role: 'ADMIN',
        operations: 'all',
      },
    ]);
  });

  it('accepts triple-quoted multiline where predicates', () => {
    const model = parseModelBody(`
      id: UUID @id
      @policy(
        role: OWNER,
        allow: [select],
        where: """
          restaurant_id IN (
            SELECT restaurant_id
            FROM "user"
            WHERE id = {{auth.user.id}}
          )
        """
      )
    `);

    const policies = normalizePolicies(model);
    assert.equal(policies.length, 1);
    assert.match(policies[0]!.where!, /restaurant_id IN \(/);
    assert.match(policies[0]!.where!, /\{\{auth\.user\.id\}\}/);
    assert.equal(policies[0]!.where!.startsWith('restaurant_id'), true);
  });
});
