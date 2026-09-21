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

  it('resolves a named predicate identifier into SQL', () => {
    const model = parseModelBody(`
      id: UUID @id
      @policy(role: USER, allow: [select], where: ownUser)
    `);

    const policies = normalizePolicies(model, [
      {
        kind: 'Predicate',
        name: 'ownUser',
        sql: 'id = {{auth.user.id}}',
        loc: { line: 1, col: 1, start: 0, end: 0 },
      },
    ]);

    assert.deepEqual(policies, [
      {
        role: 'USER',
        operations: ['select'],
        where: 'id = {{auth.user.id}}',
      },
    ]);
  });

  it('resolves a named multiline predicate identifier into SQL', () => {
    const model = parseModelBody(`
      id: UUID @id
      teamId: UUID
      @policy(role: USER, allow: [select], where: activeTeamMember)
    `);

    const sql = `team_id IN (
      SELECT team_id
      FROM team_member
      WHERE user_id = {{auth.user.id}}
        AND is_active = true
    )`;

    const policies = normalizePolicies(model, [
      {
        kind: 'Predicate',
        name: 'activeTeamMember',
        sql,
        loc: { line: 1, col: 1, start: 0, end: 0 },
      },
    ]);

    assert.equal(policies.length, 1);
    assert.equal(policies[0]!.where, sql);
    assert.match(policies[0]!.where!, /team_id IN \(/);
    assert.match(policies[0]!.where!, /is_active = true/);
  });

  it('keeps a string where when predicates are present', () => {
    const model = parseModelBody(`
      id: UUID @id
      @policy(role: USER, allow: [select], where: "id = {{auth.user.id}}")
    `);

    const policies = normalizePolicies(model, [
      {
        kind: 'Predicate',
        name: 'ownUser',
        sql: 'id = other',
        loc: { line: 1, col: 1, start: 0, end: 0 },
      },
    ]);

    assert.equal(policies[0]!.where, 'id = {{auth.user.id}}');
  });

  it('throws when a where identifier is not a known predicate', () => {
    const model = parseModelBody(`
      id: UUID @id
      @policy(role: USER, allow: [select], where: missingPredicate)
    `);

    assert.throws(
      () => normalizePolicies(model, []),
      /Unknown policy predicate "missingPredicate"/,
    );
  });
});
