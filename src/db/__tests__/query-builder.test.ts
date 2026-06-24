// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { buildModelMeta } from '../model-meta.js';
import { QueryBuilder } from '../query-builder.js';
import { WhereTranslator } from '../where-translator.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);
const userModel = schema.models.find((model) => model.name === 'User');
assert.ok(userModel, 'User model should exist');

const userMeta = buildModelMeta(userModel, schema);
const builder = new QueryBuilder(userMeta);

describe('QueryBuilder', () => {
  it('generates parameterized INSERT', () => {
    const query = builder.insert({
      email: 'a@b.com',
      name: 'Alice',
      balance: 0,
    });

    assert.equal(
      query.sql,
      'INSERT INTO "user" (email, name, balance) VALUES ($1, $2, $3) RETURNING *',
    );
    assert.deepEqual(query.params, ['a@b.com', 'Alice', 0]);
  });

  it('generates SELECT with where, orderBy, take', () => {
    const query = builder.select({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    assert.equal(
      query.sql,
      'SELECT * FROM "user" WHERE role = $1 ORDER BY created_at DESC LIMIT $2',
    );
    assert.deepEqual(query.params, ['ADMIN', 10]);
  });

  it('generates UPDATE with RETURNING', () => {
    const query = builder.update({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      data: { name: 'Bob' },
    });

    assert.equal(
      query.sql,
      'UPDATE "user" SET name = $1 WHERE id = $2 RETURNING *',
    );
    assert.deepEqual(query.params, ['Bob', '11111111-1111-1111-1111-111111111111']);
  });

  it('generates DELETE with RETURNING', () => {
    const query = builder.delete({
      where: { id: '11111111-1111-1111-1111-111111111111' },
    });

    assert.equal(
      query.sql,
      'DELETE FROM "user" WHERE id = $1 RETURNING *',
    );
    assert.deepEqual(query.params, ['11111111-1111-1111-1111-111111111111']);
  });

  it('generates COUNT query', () => {
    const query = builder.count({ where: { isActive: true } });

    assert.equal(query.sql, 'SELECT COUNT(*)::int AS count FROM "user" WHERE is_active = $1');
    assert.deepEqual(query.params, [true]);
  });
});

describe('WhereTranslator', () => {
  it('translates string filter operators', () => {
    const translator = new WhereTranslator(userMeta);
    const contains = translator.translate({ email: { contains: '@' } });
    const startsWith = translator.translate({ email: { startsWith: 'a' } });
    const endsWith = translator.translate({ email: { endsWith: 'com' } });

    assert.equal(contains.sql, 'email LIKE $1');
    assert.deepEqual(contains.params, ['%@%']);

    assert.equal(startsWith.sql, 'email LIKE $1');
    assert.deepEqual(startsWith.params, ['a%']);

    assert.equal(endsWith.sql, 'email LIKE $1');
    assert.deepEqual(endsWith.params, ['%com']);
  });

  it('translates numeric comparisons and IN filters', () => {
    const translator = new WhereTranslator(userMeta);
    const gt = translator.translate({ balance: { gt: 100 } });
    const roleIn = translator.translate({ role: { in: ['ADMIN', 'USER'] } });

    assert.equal(gt.sql, 'balance > $1');
    assert.deepEqual(gt.params, [100]);

    assert.equal(roleIn.sql, 'role IN ($1, $2)');
    assert.deepEqual(roleIn.params, ['ADMIN', 'USER']);
  });

  it('translates AND/OR/NOT groups', () => {
    const translator = new WhereTranslator(userMeta);
    const query = translator.translate({
      AND: [{ role: 'ADMIN' }, { balance: { gte: 50 } }],
      OR: [{ email: { contains: '@' } }, { name: { equals: 'Alice' } }],
      NOT: { isActive: false },
    });

    assert.equal(
      query.sql,
      '(role = $1 AND balance >= $2) AND (email LIKE $3 OR name = $4) AND NOT (is_active = $5)',
    );
    assert.deepEqual(query.params, ['ADMIN', 50, '%@%', 'Alice', false]);
  });
});

describe('db.user operations SQL snapshot', () => {
  it('prints SQL for create/findMany/update/delete', () => {
    const create = builder.insert({ email: 'a@b.com', name: 'Alice', balance: 0 });
    const findMany = builder.select({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const update = builder.update({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      data: { name: 'Bob' },
    });
    const del = builder.delete({ where: { id: '11111111-1111-1111-1111-111111111111' } });

    const snapshot = [
      ['create', create.sql, create.params],
      ['findMany', findMany.sql, findMany.params],
      ['update', update.sql, update.params],
      ['delete', del.sql, del.params],
    ] as const;

    for (const [operation, sql, params] of snapshot) {
      console.log(`\n[${operation}]`);
      console.log(sql);
      console.log(JSON.stringify(params));
    }

    assert.ok(create.sql.includes('INSERT INTO "user"'));
    assert.ok(findMany.sql.includes('ORDER BY created_at DESC'));
    assert.ok(update.sql.includes('UPDATE "user" SET name = $1'));
    assert.ok(del.sql.includes('DELETE FROM "user"'));
  });
});
