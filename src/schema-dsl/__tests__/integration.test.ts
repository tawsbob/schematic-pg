import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  assertKeyValueArgs,
  getAttr,
  getDirective,
  getField,
  getKvPair,
  parseSnippet,
} from './helpers.js';

const appSchemaPath = join(process.cwd(), 'app.schema');

describe('Integration — app.schema', () => {
  const source = readFileSync(appSchemaPath, 'utf8');
  const schema = parseSnippet(source);

  it('parses app.schema without error', () => {
    assert.equal(schema.kind, 'Schema');
  });

  it('has 2 extensions, 2 enums, and 6 models', () => {
    assert.equal(schema.extensions.length, 2);
    assert.equal(schema.enums.length, 2);
    assert.equal(schema.models.length, 6);
  });

  it('includes uuid-ossp and pgcrypto with version block', () => {
    const names = schema.extensions.map((e) => e.name);
    assert.ok(names.includes('uuid-ossp'));
    const pgcrypto = schema.extensions.find((e) => e.name === 'pgcrypto');
    assert.ok(pgcrypto);
    assert.ok(pgcrypto!.options);
    assert.equal(pgcrypto!.options!.pairs[0].key, 'version');
    assert.equal((pgcrypto!.options!.pairs[0].value as { value: string }).value, '1.3');
  });

  it('OrderStatus enum has 5 values', () => {
    const orderStatus = schema.enums.find((e) => e.name === 'OrderStatus');
    assert.ok(orderStatus);
    assert.deepEqual(orderStatus!.values, [
      'PENDING',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ]);
  });

  it('User model has 12 fields', () => {
    const user = schema.models.find((m) => m.name === 'User');
    assert.ok(user);
    assert.equal(user!.fields.length, 12);
  });

  it('User model has 2 @policy model attributes', () => {
    const user = schema.models.find((m) => m.name === 'User')!;
    const policies = user.attributes.filter((a) => a.name === 'policy');
    assert.equal(policies.length, 2);
  });

  it('User model has 3 @@index and 1 @@trigger directives', () => {
    const user = schema.models.find((m) => m.name === 'User')!;
    assert.equal(user.directives.filter((d) => d.name === 'index').length, 3);
    assert.equal(user.directives.filter((d) => d.name === 'trigger').length, 1);
  });

  it('Profile user field has @relation with fields, references, onDelete, onUpdate', () => {
    const profile = schema.models.find((m) => m.name === 'Profile')!;
    const userField = getField(profile, 'user');
    const relation = getAttr(userField, 'relation');
    const kv = assertKeyValueArgs(relation.args);
    const keys = kv.pairs.map((p) => p.key).sort();
    assert.deepEqual(keys, ['fields', 'onDelete', 'onUpdate', 'references']);
    assert.equal((getKvPair(kv, 'onDelete').value as { name: string }).name, 'CASCADE');
    assert.equal((getKvPair(kv, 'onUpdate').value as { name: string }).name, 'SET_NULL');
  });

  it('Product model has 2 @@trigger directives with TripleStringLiteral execute', () => {
    const product = schema.models.find((m) => m.name === 'Product')!;
    const triggers = product.directives.filter((d) => d.name === 'trigger');
    assert.equal(triggers.length, 2);
    for (const trigger of triggers) {
      const kv = assertKeyValueArgs(trigger.args);
      const execute = getKvPair(kv, 'execute').value;
      assert.equal(execute.kind, 'TripleStringLiteral');
      assert.ok((execute as { value: string }).value.includes('RETURN NEW'));
    }
  });

  it('ProductOrder has @@id(fields: [orderId, productId])', () => {
    const productOrder = schema.models.find((m) => m.name === 'ProductOrder')!;
    const idDirective = getDirective(productOrder, 'id');
    const kv = assertKeyValueArgs(idDirective.args);
    const fields = getKvPair(kv, 'fields').value as {
      kind: string;
      elements: { name: string }[];
    };
    assert.equal(fields.kind, 'ArrayLiteral');
    assert.deepEqual(
      fields.elements.map((e) => e.name),
      ['orderId', 'productId'],
    );
  });

  it('User @policy attributes have expected roles', () => {
    const user = schema.models.find((m) => m.name === 'User')!;
    const policies = user.attributes.filter((a) => a.name === 'policy');
    const roles = policies.map((p) => {
      const kv = assertKeyValueArgs(p.args);
      return (getKvPair(kv, 'role').value as { name: string }).name;
    });
    assert.deepEqual(roles.sort(), ['ADMIN', 'USER']);
  });
});
