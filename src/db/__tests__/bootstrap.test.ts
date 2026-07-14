import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { bootstrapDatabase, generateBootstrapSql } from '../bootstrap.js';

const fixtureSchemaPath = join(process.cwd(), 'app.schema');
const goldenSqlPath = join(
  process.cwd(),
  'src/sql-generator/__tests__/fixtures/app.schema.sql',
);

describe('bootstrapDatabase', () => {
  it('generates SQL matching the golden fixture for app.schema', () => {
    const generatedSql = generateBootstrapSql(fixtureSchemaPath);
    const goldenSql = readFileSync(goldenSqlPath, 'utf8');

    assert.equal(generatedSql, goldenSql);
  });

  it('resets the public schema then executes generated SQL', async () => {
    const executedSql: string[] = [];

    const mockClient = {
      async withClient<T>(fn: (client: { query: (sql: string) => Promise<void> }) => Promise<T>) {
        return fn({
          async query(sql: string) {
            executedSql.push(sql);
          },
        });
      },
    };

    await bootstrapDatabase(fixtureSchemaPath, mockClient);

    assert.equal(executedSql.length, 2);
    assert.match(executedSql[0]!, /DROP SCHEMA IF EXISTS public CASCADE/);
    assert.match(executedSql[1]!, /CREATE TABLE "user"/);
    assert.match(executedSql[1]!, /CREATE EXTENSION IF NOT EXISTS "pgcrypto"/);
  });
});
