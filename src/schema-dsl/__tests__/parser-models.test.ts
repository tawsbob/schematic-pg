import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertKeyValueArgs,
  assertTypeExpr,
  getAttr,
  getDirective,
  getField,
  getKvPair,
  getModelAttr,
  parseModelBody,
  parseSnippet,
  wrapModels,
} from './helpers.js';

describe('Parser — model types', () => {
  it('parses simple type UUID', () => {
    const model = parseModelBody('id: UUID');
    assertTypeExpr(getField(model, 'id').type, { name: 'UUID' });
  });

  it('parses parametric type VARCHAR(255)', () => {
    const model = parseModelBody('email: VARCHAR(255)');
    assertTypeExpr(getField(model, 'email').type, { name: 'VARCHAR', args: [255] });
  });

  it('parses multi-arg type DECIMAL(10, 2)', () => {
    const model = parseModelBody('total: DECIMAL(10, 2)');
    assertTypeExpr(getField(model, 'total').type, { name: 'DECIMAL', args: [10, 2] });
  });

  it('parses optional type SMALLINT?', () => {
    const model = parseModelBody('age: SMALLINT?');
    assertTypeExpr(getField(model, 'age').type, { name: 'SMALLINT', optional: true });
  });

  it('parses array relation type Order[]', () => {
    const model = parseModelBody('orders: Order[]');
    assertTypeExpr(getField(model, 'orders').type, { name: 'Order', array: true });
  });

  it('parses PG array type TEXT[]', () => {
    const model = parseModelBody('tags: TEXT[]');
    assertTypeExpr(getField(model, 'tags').type, { name: 'TEXT', array: true });
  });

  it('parses optional relation type Profile?', () => {
    const model = parseModelBody('profile: Profile?');
    assertTypeExpr(getField(model, 'profile').type, { name: 'Profile', optional: true });
  });
});

describe('Parser — field attributes', () => {
  it('parses bare field attributes on same line', () => {
    const model = parseModelBody('id: UUID @id @unique');
    const field = getField(model, 'id');
    assert.equal(field.attributes.length, 2);
    assert.equal(field.attributes[0].name, 'id');
    assert.equal(field.attributes[1].name, 'unique');
  });

  it('parses @default with call expression', () => {
    const model = parseModelBody('id: UUID @default(gen_random_uuid())');
    const attr = getAttr(getField(model, 'id'), 'default');
    assert.equal(attr.args!.kind, 'ExpressionArgs');
    const exprs = (attr.args as { expressions: unknown[] }).expressions;
    assert.equal(exprs.length, 1);
    assert.equal((exprs[0] as { kind: string; callee: string }).kind, 'CallExpression');
    assert.equal((exprs[0] as { callee: string }).callee, 'gen_random_uuid');
  });

  it('parses @default(true) boolean default', () => {
    const model = parseModelBody('active: BOOLEAN @default(true)');
    const attr = getAttr(getField(model, 'active'), 'default');
    assert.equal(attr.args!.kind, 'ExpressionArgs');
    const expr = (attr.args as { expressions: { kind: string; value: boolean }[] }).expressions[0];
    assert.equal(expr.kind, 'BooleanLiteral');
    assert.equal(expr.value, true);
  });

  it('parses @default(USER) enum default', () => {
    const model = parseModelBody('role: UserRole @default(USER)');
    const attr = getAttr(getField(model, 'role'), 'default');
    assert.equal(attr.args!.kind, 'ExpressionArgs');
    const expr = (attr.args as { expressions: { kind: string; name: string }[] }).expressions[0];
    assert.equal(expr.kind, 'Identifier');
    assert.equal(expr.name, 'USER');
  });

  it('parses @regex key-value validation', () => {
    const model = parseModelBody(
      'email: VARCHAR(255) @regex(pattern: "test@example.com", message: "Invalid")',
    );
    const kv = assertKeyValueArgs(getAttr(getField(model, 'email'), 'regex').args);
    assert.equal(getKvPair(kv, 'pattern').value.kind, 'StringLiteral');
    assert.equal(getKvPair(kv, 'message').value.kind, 'StringLiteral');
  });

  it('parses @range key-value validation', () => {
    const model = parseModelBody(
      'age: SMALLINT @range(min: 1, max: 120, message: "Age must be between 1 and 120")',
    );
    const kv = assertKeyValueArgs(getAttr(getField(model, 'age'), 'range').args);
    assert.equal((getKvPair(kv, 'min').value as { value: number }).value, 1);
    assert.equal((getKvPair(kv, 'max').value as { value: number }).value, 120);
  });

  it('parses multiline @relation starting on type line as field attribute', () => {
    const model = parseModelBody(`user: User @relation(
      name: "X",
      fields: [id]
    )`);
    const field = getField(model, 'user');
    assert.equal(field.attributes.length, 1);
    assert.equal(field.attributes[0].name, 'relation');
    assert.equal(field.attributes[0].args!.kind, 'KeyValueArgs');
  });

  it('parses @policy on next line as model attribute, not field attribute', () => {
    const model = parseModelBody(`orders: Order[]
@policy(role: USER, allow: all)`);
    const field = getField(model, 'orders');
    assert.equal(field.attributes.length, 0);
    assert.equal(model.attributes.length, 1);
    assert.equal(getModelAttr(model, 'policy').name, 'policy');
  });

  it('parses @id on next line as model attribute, not field attribute', () => {
    const model = parseModelBody(`id: UUID
@id`);
    const field = getField(model, 'id');
    assert.equal(field.attributes.length, 0);
    assert.equal(model.attributes.length, 1);
    assert.equal(getModelAttr(model, 'id').name, 'id');
  });
});

describe('Parser — model directives', () => {
  it('parses @@index with KeyValueArgs', () => {
    const model = parseModelBody('@@index(fields: [a, b])');
    const directive = getDirective(model, 'index');
    assert.equal(directive.name, 'index');
    assert.equal(directive.args!.kind, 'KeyValueArgs');
  });

  it('parses @@index with trailing comma in array', () => {
    const model = parseModelBody('@@index(fields: [a,])');
    const kv = assertKeyValueArgs(getDirective(model, 'index').args);
    const fields = getKvPair(kv, 'fields').value;
    assert.equal(fields.kind, 'ArrayLiteral');
    assert.equal((fields as { elements: unknown[] }).elements.length, 1);
  });

  it('parses @@index with where, unique, name, type kv pairs', () => {
    const model = parseModelBody(
      '@@index(fields: [email], where: "active = true", unique: true, name: "idx", type: BTREE)',
    );
    const kv = assertKeyValueArgs(getDirective(model, 'index').args);
    assert.ok(getKvPair(kv, 'where'));
    assert.ok(getKvPair(kv, 'unique'));
    assert.ok(getKvPair(kv, 'name'));
    assert.ok(getKvPair(kv, 'type'));
  });

  it('parses @@trigger block form with TripleStringLiteral execute', () => {
    const model = parseModelBody(`@@trigger {
      timing: BEFORE,
      event: UPDATE,
      execute: """
        RETURN NEW;
      """
    }`);
    const directive = getDirective(model, 'trigger');
    assert.equal(directive.args!.kind, 'KeyValueArgs');
    const kv = assertKeyValueArgs(directive.args);
    const execute = getKvPair(kv, 'execute').value;
    assert.equal(execute.kind, 'TripleStringLiteral');
    assert.ok((execute as { value: string }).value.includes('RETURN NEW'));
  });

  it('parses @@id directive', () => {
    const model = parseModelBody('@@id(fields: [a, b])');
    const directive = getDirective(model, 'id');
    assert.equal(directive.name, 'id');
    assert.equal(directive.args!.kind, 'KeyValueArgs');
  });

  it('parses @@unique with fields and name', () => {
    const model = parseModelBody(`
      recipeId: UUID
      stockItemId: UUID
      @@unique(fields: [recipeId, stockItemId], name: "recipe_stock_item_key")
    `);
    const directive = getDirective(model, 'unique');
    assert.equal(directive.name, 'unique');
    const kv = assertKeyValueArgs(directive.args);
    const fields = getKvPair(kv, 'fields').value;
    assert.equal(fields.kind, 'ArrayLiteral');
    assert.equal((fields as { elements: unknown[] }).elements.length, 2);
    assert.ok(getKvPair(kv, 'name'));
  });

  it('parses multiple @@trigger directives on same model', () => {
    const model = parseModelBody(`@@trigger { timing: BEFORE, event: UPDATE, execute: """A""" }
@@trigger { timing: AFTER, event: INSERT, execute: """B""" }`);
    const triggers = model.directives.filter((d) => d.name === 'trigger');
    assert.equal(triggers.length, 2);
  });
});

describe('Parser — model body ordering', () => {
  it('parses mixed field, model attribute, and directive', () => {
    const schema = parseSnippet(wrapModels(`model User {
      id: UUID @id
      @policy(role: ADMIN, allow: all)
      @@index(fields: [id])
    }`));
    const model = schema.models[0];
    assert.equal(model.fields.length, 1);
    assert.equal(model.attributes.length, 1);
    assert.equal(model.directives.length, 1);
    assert.equal(getField(model, 'id').attributes.length, 1);
    assert.equal(getModelAttr(model, 'policy').name, 'policy');
    assert.equal(getDirective(model, 'index').name, 'index');
  });
});
