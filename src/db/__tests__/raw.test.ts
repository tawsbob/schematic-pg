// Run: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QueryResult, QueryResultRow } from 'pg';
import { UniqueConstraintError } from '../errors.js';
import type { Queryable } from '../queryable.js';
import { createRawClient } from '../raw.js';

interface Call {
  sql: string;
  params?: unknown[];
}

function fakeQueryable(
  result: Partial<QueryResult<QueryResultRow>>,
  calls: Call[] = [],
): Queryable {
  return {
    async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      return {
        rows: (result.rows ?? []) as T[],
        rowCount: result.rowCount ?? 0,
        command: '',
        oid: 0,
        fields: [],
      };
    },
  };
}

function throwingQueryable(error: unknown): Queryable {
  return {
    async query() {
      throw error;
    },
  };
}

describe('createRawClient', () => {
  it('$queryRaw returns rows unmapped and forwards params untouched', async () => {
    const calls: Call[] = [];
    const rows = [{ user_id: 1, created_at: 'x' }];
    const raw = createRawClient(fakeQueryable({ rows }, calls));

    const result = await raw.$queryRaw('SELECT * FROM "user" WHERE id = $1', [42]);

    assert.deepEqual(result, rows);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.sql, 'SELECT * FROM "user" WHERE id = $1');
    assert.deepEqual(calls[0]!.params, [42]);
  });

  it('$queryRaw defaults params to an empty array', async () => {
    const calls: Call[] = [];
    const raw = createRawClient(fakeQueryable({ rows: [] }, calls));

    await raw.$queryRaw('SELECT 1');

    assert.deepEqual(calls[0]!.params, []);
  });

  it('$executeRaw returns the affected row count', async () => {
    const raw = createRawClient(fakeQueryable({ rows: [], rowCount: 3 }));

    const count = await raw.$executeRaw('UPDATE "user" SET name = $1', ['x']);

    assert.equal(count, 3);
  });

  it('$executeRaw returns 0 when rowCount is null', async () => {
    const raw = createRawClient(fakeQueryable({ rows: [], rowCount: null }));

    const count = await raw.$executeRaw('SELECT 1');

    assert.equal(count, 0);
  });

  it('maps a pg unique-violation error to UniqueConstraintError', async () => {
    const pgError = {
      code: '23505',
      message: 'duplicate key',
      detail: 'Key (email)=(a@b.com) already exists.',
      constraint: 'user_email_key',
    };
    const raw = createRawClient(throwingQueryable(pgError));

    await assert.rejects(
      () => raw.$queryRaw('INSERT INTO "user" (email) VALUES ($1)', ['a@b.com']),
      (error: unknown) => {
        assert.ok(error instanceof UniqueConstraintError);
        assert.ok(error.fields.includes('email'));
        return true;
      },
    );
  });
});
