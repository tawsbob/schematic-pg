import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from '../src/diagnostics.js';
import { getCompletions } from '../src/completions.js';
import { buildSchemaIndex, findDefinition, findReferences } from '../src/schema-index.js';
import { getDocumentSymbols } from '../src/symbols.js';
import { KNOWN_DECORATORS } from '../src/catalog.js';
import { Position } from 'vscode-languageserver';

const appSchemaPath = join(process.cwd(), 'app.schema');
const appSchema = readFileSync(appSchemaPath, 'utf8');

describe('Schema DSL language server', () => {
  it('parses app.schema without diagnostics', () => {
    const result = parseDocument(appSchema);
    assert.equal(result.diagnostics.length, 0);
    assert.ok(result.schema);
  });

  it('maps parse errors to diagnostics', () => {
    const result = parseDocument('extensions {}\nenums { Bad { 123 } }\nmodels {}');
    assert.equal(result.diagnostics.length, 1);
    assert.match(result.diagnostics[0]?.message ?? '', /Parse error|expected/);
  });

  it('builds model and enum indexes from app.schema', () => {
    const { schema } = parseDocument(appSchema);
    assert.ok(schema);
    const index = buildSchemaIndex(schema);
    assert.ok(index.models.has('User'));
    assert.ok(index.enums.has('UserRole'));
    assert.ok(index.fields.has('User.email'));
  });

  it('finds definitions and references for models', () => {
    const { schema } = parseDocument(appSchema);
    assert.ok(schema);
    const index = buildSchemaIndex(schema);
    assert.ok(findDefinition(index, 'User'));
    assert.ok(findReferences(index, 'User').length >= 2);
  });

  it('returns document symbols for models and enums', () => {
    const { schema } = parseDocument(appSchema);
    assert.ok(schema);
    const symbols = getDocumentSymbols(schema);
    assert.ok(symbols.some((symbol) => symbol.name === 'User'));
    assert.ok(symbols.some((symbol) => symbol.name === 'UserRole'));
  });

  it('offers decorator completions after @', () => {
    const completions = getCompletions('model User {\n  id: UUID @', Position.create(1, 12));
    const labels = completions.map((item) => item.label);
    assert.ok(labels.includes('@id'));
    assert.ok(labels.includes('@default'));
  });

  it('catalog includes known decorators used in integration tests', () => {
    for (const decorator of ['id', 'default', 'unique', 'regex', 'range', 'relation', 'policy', 'index', 'trigger']) {
      assert.ok(KNOWN_DECORATORS.includes(decorator as (typeof KNOWN_DECORATORS)[number]));
    }
  });
});
