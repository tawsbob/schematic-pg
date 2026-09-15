import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse, tokenize } from '../index.js';
import { wrapFunctions, wrapModels } from './helpers.js';

describe('Lexer — line/col after multi-line triple strings', () => {
  it('tracks line numbers through multi-line triple-quoted bodies', () => {
    const source = wrapModels(`
model User {
  id: UUID @id

  @@trigger {
    timing: BEFORE,
    event: UPDATE,
    level: ROW,
    execute: """
      IF true THEN
        RETURN NEW;
      END IF;
    """
  }
}

model Profile {
  id: UUID @id
}
`);
    const schema = parse(source);
    const lines = source.split('\n');

    const user = schema.models.find((model) => model.name === 'User');
    const profile = schema.models.find((model) => model.name === 'Profile');
    assert.ok(user);
    assert.ok(profile);

    assert.equal(lines[user.loc.line - 1]?.trimStart().startsWith('model User'), true);
    assert.equal(lines[profile.loc.line - 1]?.trimStart().startsWith('model Profile'), true);
    assert.ok(profile.loc.line > user.loc.line);
  });

  it('assigns start/end byte offsets on tokens', () => {
    const tokens = tokenize('extensions {}');
    const first = tokens[0];
    assert.equal(first.type, 'EXTENSIONS');
    assert.equal(typeof first.start, 'number');
    assert.equal(typeof first.end, 'number');
    assert.ok(first.end > first.start);
  });
});
