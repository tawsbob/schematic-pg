import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDocument } from '../src/diagnostics.js';
import { getCompletions } from '../src/completions.js';
import { buildSchemaIndex, findDefinition, findReferences } from '../src/schema-index.js';
import { getDocumentSymbols } from '../src/symbols.js';
import { KNOWN_DECORATORS } from '../src/catalog.js';
import { Position } from 'vscode-languageserver';
import { loadSchemaFromArg } from '../../../src/schema-source/index.js';

const { canonicalSource: appSchema } = loadSchemaFromArg();

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
    assert.ok(index.functions.has('getUserBalance'));
    assert.ok(index.functions.has('searchProducts'));
    assert.match(index.functions.get('searchProducts')?.detail ?? '', /TABLE\(id: UUID, name: TEXT, price: DECIMAL\)/);
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
    assert.ok(symbols.some((symbol) => symbol.name === 'getUserBalance'));
    assert.ok(symbols.some((symbol) => symbol.name === 'searchProducts'));
  });

  it('offers decorator completions after @', () => {
    const completions = getCompletions('model User {\n  id: UUID @', Position.create(1, 12));
    const labels = completions.map((item) => item.label);
    assert.ok(labels.includes('@id'));
    assert.ok(labels.includes('@default'));
    assert.ok(labels.includes('@rest'));
    assert.ok(labels.includes('@policy'));
    const rest = completions.find((item) => item.label === '@rest');
    assert.equal(rest?.detail, 'model attribute');
  });

  it('indexes cron jobs and offers call completions for zero-arg functions', () => {
    const validSource = `extensions { pg_cron }
functions {
  function expireSessions(): VOID {
    execute: """SELECT 1"""
  }
  function getBalance(userId: UUID): INTEGER {
    execute: """SELECT 1"""
  }
}
cron {
  job expireSessions {
    schedule: "0 * * * *"
    call: expireSessions
  }
}`;
    const { schema } = parseDocument(validSource);
    assert.ok(schema);
    const index = buildSchemaIndex(schema);
    assert.ok(index.jobs.has('expireSessions'));

    const completionSource = `cron {
  job expireSessions {
    schedule: "0 * * * *"
    call: 
  }
}`;
    const callLine = completionSource.split('\n').findIndex((line) => line.includes('call:'));
    const callCompletions = getCompletions(
      completionSource,
      Position.create(callLine, '    call: '.length),
      schema,
    );
    const labels = callCompletions.map((item) => item.label);
    assert.ok(labels.includes('expireSessions'));
    assert.ok(!labels.includes('getBalance'));
  });

  it('catalog includes known decorators used in integration tests', () => {
    for (const decorator of ['id', 'default', 'unique', 'regex', 'range', 'relation', 'policy', 'rest', 'index', 'trigger']) {
      assert.ok(KNOWN_DECORATORS.includes(decorator as (typeof KNOWN_DECORATORS)[number]));
    }
  });
});
