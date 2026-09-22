import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expectSchemaError,
  getDirective,
  parseSnippet,
  wrapModels,
} from './helpers.js';

describe('Schema — @@unique', () => {
  it('accepts a composite unique constraint', () => {
    const schema = parseSnippet(
      wrapModels(`model RecipeIngredient {
        id: UUID @id
        recipeId: UUID
        stockItemId: UUID
        @@unique(fields: [recipeId, stockItemId])
      }`),
    );
    assert.equal(getDirective(schema.models[0], 'unique').name, 'unique');
  });

  it('rejects @@unique with a single field', () => {
    expectSchemaError(
      wrapModels(`model Item {
        id: UUID @id
        email: VARCHAR(255)
        @@unique(fields: [email])
      }`),
      'at least two fields',
    );
  });

  it('rejects @@unique without fields', () => {
    expectSchemaError(
      wrapModels(`model Item {
        id: UUID @id
        @@unique(name: "x")
      }`),
      'requires fields',
    );
  });

  it('rejects @@unique on an unknown column', () => {
    expectSchemaError(
      wrapModels(`model Item {
        id: UUID @id
        recipeId: UUID
        @@unique(fields: [recipeId, missing])
      }`),
      'is not a stored column',
    );
  });

  it('rejects duplicate @@unique field lists', () => {
    expectSchemaError(
      wrapModels(`model Item {
        id: UUID @id
        recipeId: UUID
        stockItemId: UUID
        @@unique(fields: [recipeId, stockItemId])
        @@unique(fields: [stockItemId, recipeId])
      }`),
      'duplicate @@unique field list',
    );
  });

  it('rejects where on @@unique', () => {
    expectSchemaError(
      wrapModels(`model Item {
        id: UUID @id
        recipeId: UUID
        stockItemId: UUID
        @@unique(fields: [recipeId, stockItemId], where: "true")
      }`),
      'does not support "where"',
    );
  });

  it('rejects @@unique that omits partition key fields', () => {
    expectSchemaError(
      wrapModels(`model Log {
        id: UUID
        region: TEXT
        kind: TEXT
        @@id(fields: [id, region])
        @@unique(fields: [id, kind])
        @@partition {
          by: LIST
          fields: [region]
          partition Us { in: ["us"] }
        }
      }`),
      'unique constraint must include partition key fields',
    );
  });

  it('accepts @@unique that includes partition key fields', () => {
    const model = parseSnippet(
      wrapModels(`model Log {
        id: UUID
        region: TEXT
        kind: TEXT
        @@id(fields: [id, region])
        @@unique(fields: [region, kind])
        @@partition {
          by: LIST
          fields: [region]
          partition Us { in: ["us"] }
        }
      }`),
    ).models[0];
    assert.equal(getDirective(model, 'unique').name, 'unique');
  });
});
