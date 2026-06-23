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

  it('executes generated SQL through the database client', async () => {
    let executedSql = '';

    const mockClient = {
      async withClient<T>(fn: (client: { query: (sql: string) => Promise<void> }) => Promise<T>) {
        return fn({
          async query(sql: string) {
            executedSql = sql;
          },
        });
      },
    };

    await bootstrapDatabase(fixtureSchemaPath, mockClient);

    assert.match(executedSql, /CREATE TABLE "user"/);
    assert.match(executedSql, /CREATE EXTENSION IF NOT EXISTS "postgis"/);
  });
});
