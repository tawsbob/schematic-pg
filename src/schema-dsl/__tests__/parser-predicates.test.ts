import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../index.js';
import { expectParseError } from './helpers.js';

describe('Parser — predicates', () => {
  it('parses a predicates section with string and triple-quoted bodies', () => {
    const schema = parse(`predicates {
  ownUser: "id = {{auth.user.id}}"
  teamMember: """
    team_id IN (
      SELECT team_id FROM team_member
      WHERE user_id = {{auth.user.id}}
    )
  """
}

models {
  model User { id: UUID @id }
}`);

    assert.equal(schema.predicates.length, 2);
    assert.equal(schema.predicates[0]!.name, 'ownUser');
    assert.equal(schema.predicates[0]!.sql, 'id = {{auth.user.id}}');
    assert.equal(schema.predicates[1]!.name, 'teamMember');
    assert.match(schema.predicates[1]!.sql, /team_id IN \(/);
    assert.match(schema.predicates[1]!.sql, /\{\{auth\.user\.id\}\}/);
  });

  it('parses optional trailing commas between predicates', () => {
    const schema = parse(`predicates {
  ownUser: "id = {{auth.user.id}}",
}

models {
  model User { id: UUID @id }
}`);

    assert.equal(schema.predicates.length, 1);
    assert.equal(schema.predicates[0]!.name, 'ownUser');
  });

  it('rejects an empty predicate body', () => {
    expectParseError(
      `predicates {
  ownUser: "   "
}
models { model User { id: UUID @id } }`,
      /non-empty predicate body/,
    );
  });

  it('rejects a duplicate predicate name in one file', () => {
    expectParseError(
      `predicates {
  ownUser: "id = 1"
  ownUser: "id = 2"
}
models { model User { id: UUID @id } }`,
      /unique predicate name/,
    );
  });

  it('rejects predicates after models', () => {
    expectParseError(
      `models { model User { id: UUID @id } }
predicates { ownUser: "id = 1" }`,
      /sections in order|expected end of schema/,
    );
  });

  it('rejects a non-string predicate body', () => {
    expectParseError(
      `predicates {
  ownUser: 123
}
models { model User { id: UUID @id } }`,
      /string or triple-quoted string predicate body/,
    );
  });
});
