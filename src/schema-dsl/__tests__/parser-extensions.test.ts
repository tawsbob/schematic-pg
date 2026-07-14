import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSnippet } from './helpers.js';

describe('Parser — extensions', () => {
  it('parses bare extensions without options', () => {
    const schema = parseSnippet('extensions { citext uuid-ossp }\nenums {}\nmodels {}');
    assert.equal(schema.extensions.length, 2);
    assert.equal(schema.extensions[0].name, 'citext');
    assert.equal(schema.extensions[0].options, undefined);
    assert.equal(schema.extensions[1].name, 'uuid-ossp');
    assert.equal(schema.extensions[1].options, undefined);
  });

  it('parses extension with options block', () => {
    const schema = parseSnippet(
      'extensions { pgcrypto { version: "1.3" } }\nenums {}\nmodels {}',
    );
    assert.equal(schema.extensions.length, 1);
    assert.equal(schema.extensions[0].name, 'pgcrypto');
    assert.ok(schema.extensions[0].options);
    const pair = schema.extensions[0].options!.pairs[0];
    assert.equal(pair.key, 'version');
    assert.equal(pair.value.kind, 'StringLiteral');
    assert.equal((pair.value as { value: string }).value, '1.3');
  });

  it('parses empty extensions section', () => {
    const schema = parseSnippet('extensions { }\nenums {}\nmodels {}');
    assert.deepEqual(schema.extensions, []);
  });

  it('parses trailing comma in extension options block', () => {
    const schema = parseSnippet(
      'extensions { pgcrypto { version: "1.3", } }\nenums {}\nmodels {}',
    );
    assert.equal(schema.extensions[0].options!.pairs.length, 1);
  });
});
