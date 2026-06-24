import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const grammarPath = join(process.cwd(), 'syntaxes/schema-dsl.tmLanguage.json');
const appSchemaPath = join(process.cwd(), 'app.schema');

describe('Schema DSL TextMate grammar', () => {
  it('loads grammar with expected scope name and file type', () => {
    const grammar = JSON.parse(readFileSync(grammarPath, 'utf8'));
    assert.equal(grammar.scopeName, 'source.schema-dsl');
    assert.deepEqual(grammar.fileTypes, ['schema']);
  });

  it('includes keyword, decorator, and type repository rules', () => {
    const grammar = JSON.parse(readFileSync(grammarPath, 'utf8'));
    assert.ok(grammar.repository.keywords);
    assert.ok(grammar.repository.directives);
    assert.ok(grammar.repository.attributes);
    assert.ok(grammar.repository.types);
    assert.ok(grammar.repository['language-constants']);
  });

  it('app.schema contains constructs covered by grammar', () => {
    const source = readFileSync(appSchemaPath, 'utf8');
    assert.match(source, /@policy/);
    assert.match(source, /@@index/);
    assert.match(source, /@@trigger/);
    assert.match(source, /gen_random_uuid/);
    assert.match(source, /"""[\s\S]*?"""/);
  });
});
