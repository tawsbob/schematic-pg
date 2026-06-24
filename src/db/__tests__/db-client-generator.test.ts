// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { generateDbClientFiles } from '../db-client-generator.js';
import { toCamelCase, pluralize } from '../utils/naming.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);

describe('naming utils', () => {
  it('converts camelCase and snake_case both ways', () => {
    assert.equal(toCamelCase('created_at'), 'createdAt');
    assert.equal(toCamelCase('user_id'), 'userId');
  });

  it('pluralizes table-like names', () => {
    assert.equal(pluralize('user_profile'), 'user_profiles');
    assert.equal(pluralize('box'), 'boxes');
  });
});

describe('DbClientGenerator', () => {
  it('generates types and client wiring for app.schema', () => {
    const files = generateDbClientFiles(schema);

    assert.match(files.dbTypes, /export interface User \{/);
    assert.match(files.dbTypes, /export interface UserCreateInput \{/);
    assert.match(files.dbTypes, /export type UserRole = 'ADMIN' \| 'USER' \| 'PUBLIC';/);
    assert.match(files.dbClient, /export function createDbClient\(pool: Pool\)/);
    assert.match(files.dbClient, /user: createModelClient<User, UserCreateInput/);
    assert.match(files.modelMeta, /export const userModelMeta =/);
    assert.match(files.modelMeta, /"quotedTableName": "\\"user\\""/);
  });
});
