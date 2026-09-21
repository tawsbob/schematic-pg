import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { generateRouteFiles } from '../route-generator.js';
import { generatePoliciesFile } from '../policy-generator.js';
import { generateDbClientFiles } from '../../db/db-client-generator.js';
import { createReadOnlyModelClient } from '../../db/model-client.js';

const SOURCE = `models {
  model User {
    id: UUID @id
    email: VARCHAR(255)
    isActive: BOOLEAN
  }
}

views {
  view ActiveUser {
    id: UUID @id
    email: VARCHAR(255)

    as: """
      SELECT id, email FROM "user" WHERE is_active = true
    """

    @rest(only: [list, get])
    @policy(role: USER, allow: [select])
  }

  materialized view RoleCount {
    role: VARCHAR(50)
    count: INTEGER

    as: """
      SELECT 'USER' AS role, 1 AS count
    """

    @rest(only: [list])
  }
}`;

describe('API / DB — views', () => {
  const schema = parse(SOURCE);

  it('generates list and get routes without write handlers', () => {
    const routes = generateRouteFiles(schema);
    const activeUsers = routes.get('active-users.ts');
    assert.ok(activeUsers);
    assert.match(activeUsers, /ViewRouteGenerator/);
    assert.match(activeUsers, /router\.get\('\/'/);
    assert.match(activeUsers, /router\.get\('\/:id'/);
    assert.doesNotMatch(activeUsers, /router\.post/);
    assert.doesNotMatch(activeUsers, /router\.put/);
    assert.doesNotMatch(activeUsers, /router\.delete/);
  });

  it('emits view policies', () => {
    const policies = generatePoliciesFile(schema);
    assert.match(policies, /ActiveUser:/);
    assert.match(policies, /operations: \['select'\]/);
  });

  it('wires read-only clients in generated db client', () => {
    const { dbClient, dbTypes } = generateDbClientFiles(schema);
    assert.match(dbTypes, /export interface ActiveUser/);
    assert.doesNotMatch(dbTypes, /ActiveUserCreateInput/);
    assert.match(dbClient, /createReadOnlyModelClient<ActiveUser/);
    assert.match(dbClient, /activeUser:/);
  });

  it('exposes createReadOnlyModelClient surface', () => {
    assert.equal(typeof createReadOnlyModelClient, 'function');
  });
});
