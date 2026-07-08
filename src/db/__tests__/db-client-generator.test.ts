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
    assert.match(files.dbTypes, /export interface UserInclude \{/);
    assert.match(files.dbClient, /export function createDbClient\(pool: Pool\)/);
    assert.match(files.dbClient, /function buildModels\(executor: Queryable\)/);
    assert.match(files.dbClient, /user: createModelClient<User, UserCreateInput/);
    assert.match(files.dbClient, /const modelRegistry = new Map/);
    assert.match(files.dbClient, /export type TxClient = ReturnType<typeof buildModels>;/);
    assert.match(files.dbClient, /\$transaction<T>\(fn: \(tx: TxClient\) => Promise<T>\)/);
    assert.match(files.dbClient, /return runInTransaction\(pool, \(client\) => fn\(buildModels\(client\)\)\);/);
    assert.match(files.dbClient, /\.\.\.buildModels\(pool\),/);
    assert.match(files.dbClient, /import \{ createRawClient \} from 'schematic-pg\/db\/raw';/);
    assert.match(files.dbClient, /\.\.\.createRawClient\(executor\),/);
    assert.match(files.modelMeta, /export const userModelMeta =/);
    assert.match(files.modelMeta, /"relations"/);
    assert.match(files.modelMeta, /"quotedTableName": "\\"user\\""/);
  });
});
