import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../index.js';

describe('Parser — optional sections', () => {
  it('parses a models-only schema', () => {
    const schema = parse(`models {
  model User { id: UUID @id }
}`);
    assert.equal(schema.extensions.length, 0);
    assert.equal(schema.enums.length, 0);
    assert.equal(schema.predicates.length, 0);
    assert.equal(schema.models.length, 1);
    assert.equal(schema.views.length, 0);
    assert.equal(schema.functions.length, 0);
  });

  it('parses enums + models without extensions or functions', () => {
    const schema = parse(`enums {
  Role { ADMIN, USER }
}

models {
  model User { id: UUID @id role: Role }
}`);
    assert.equal(schema.enums[0]?.name, 'Role');
    assert.equal(schema.models[0]?.name, 'User');
  });

  it('parses an extensions-only schema', () => {
    const schema = parse(`extensions {
  pgcrypto
}`);
    assert.equal(schema.extensions.length, 1);
    assert.equal(schema.models.length, 0);
  });

  it('parses predicates between enums and models', () => {
    const schema = parse(`enums {
  Role { USER }
}

predicates {
  ownUser: "id = {{auth.user.id}}"
}

models {
  model User { id: UUID @id }
}`);
    assert.equal(schema.predicates.length, 1);
    assert.equal(schema.predicates[0]!.name, 'ownUser');
  });

  it('still accepts explicit empty sections', () => {
    const schema = parse(`extensions {}
enums {}
predicates {}
models {
  model User { id: UUID @id }
}
functions {}`);
    assert.equal(schema.models.length, 1);
    assert.equal(schema.predicates.length, 0);
  });
});
