import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse, ParseError, SchemaError } from '../index.js';

function wrapViews(body: string): string {
  return `models {
  model User { id: UUID @id email: VARCHAR(255) isActive: BOOLEAN }
}

views {
${body}
}`;
}

describe('Parser — views', () => {
  it('parses a plain view with columns, as query, @rest, and @policy', () => {
    const schema = parse(
      wrapViews(`
  view ActiveUser {
    id: UUID @id
    email: VARCHAR(255)

    as: """
      SELECT id, email FROM "user" WHERE is_active = true
    """

    @rest(only: [list, get])
    @policy(role: USER, allow: [select])
  }
`),
    );

    assert.equal(schema.views.length, 1);
    const view = schema.views[0]!;
    assert.equal(view.name, 'ActiveUser');
    assert.equal(view.materialized, false);
    assert.equal(view.columns.length, 2);
    assert.match(view.query, /SELECT id, email/);
    assert.equal(view.attributes.length, 2);
  });

  it('parses a materialized view with @@index', () => {
    const schema = parse(
      wrapViews(`
  materialized view UserStats {
    role: VARCHAR(50)
    count: INTEGER

    as: """
      SELECT role, count(*)::int AS count FROM "user" GROUP BY role
    """

    @rest(only: [list])
    @@index(fields: [role], unique: true)
  }
`),
    );

    const view = schema.views[0]!;
    assert.equal(view.materialized, true);
    assert.equal(view.directives.length, 1);
    assert.equal(view.directives[0]!.name, 'index');
  });

  it('rejects missing as query', () => {
    assert.throws(
      () =>
        parse(
          wrapViews(`
  view Broken {
    id: UUID @id
  }
`),
        ),
      (error: unknown) => error instanceof ParseError && /as/.test(error.message),
    );
  });

  it('rejects @@index on plain views', () => {
    assert.throws(
      () =>
        parse(
          wrapViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
    @@index(fields: [id])
  }
`),
        ),
      (error: unknown) =>
        error instanceof SchemaError && /@@index is only allowed on materialized views/.test(error.message),
    );
  });

  it('rejects write @rest operations', () => {
    assert.throws(
      () =>
        parse(
          wrapViews(`
  view ActiveUser {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
    @rest(only: [list, create])
  }
`),
        ),
      (error: unknown) =>
        error instanceof SchemaError && /write operation|expected one of list/.test(error.message),
    );
  });

  it('rejects get without @id', () => {
    assert.throws(
      () =>
        parse(
          wrapViews(`
  view ActiveUser {
    email: VARCHAR(255)
    as: "SELECT email FROM \\"user\\""
  }
`),
        ),
      (error: unknown) =>
        error instanceof SchemaError && /requires @id or @@id/.test(error.message),
    );
  });

  it('allows list-only views without @id', () => {
    const schema = parse(
      wrapViews(`
  view ActiveUser {
    email: VARCHAR(255)
    as: "SELECT email FROM \\"user\\""
    @rest(only: [list])
  }
`),
    );
    assert.equal(schema.views[0]!.name, 'ActiveUser');
  });

  it('rejects name clash with model', () => {
    assert.throws(
      () =>
        parse(
          wrapViews(`
  view User {
    id: UUID @id
    as: "SELECT id FROM \\"user\\""
  }
`),
        ),
      (error: unknown) =>
        error instanceof SchemaError && /conflicts with model/.test(error.message),
    );
  });
});
