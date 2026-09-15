import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { SqlGenerator } from '../../sql-generator/sql-generator.js';
import { parse } from '../../schema-dsl/index.js';
import {
  loadSchema,
  loadSchemaFromArg,
  resolveSchemaSource,
} from '../index.js';

describe('schema-source loader', () => {
  const root = mkdtempSync(join(tmpdir(), 'schema-source-'));
  const fragmentsDir = join(root, 'schema');
  const singleFile = join(root, 'app.schema');

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('falls back to app.schema when schema/ is empty', () => {
    mkdirSync(fragmentsDir, { recursive: true });
    writeFileSync(singleFile, `models { model Solo { id: UUID @id } }\n`, 'utf8');

    const source = resolveSchemaSource(undefined, root);
    assert.equal(source.kind, 'file');
    if (source.kind === 'file') {
      assert.equal(source.path, singleFile);
    }
  });

  it('uses schema/*.schema fragments when present', () => {
    writeFileSync(
      join(fragmentsDir, 'zebra.schema'),
      `models { model Zebra { id: UUID @id } }\n`,
      'utf8',
    );
    writeFileSync(
      join(fragmentsDir, 'alpha.schema'),
      `models { model Alpha { id: UUID @id } }\n`,
      'utf8',
    );

    const source = resolveSchemaSource(undefined, root);
    assert.equal(source.kind, 'fragments');
    if (source.kind !== 'fragments') {
      return;
    }

    const loaded = loadSchema(source);
    assert.deepEqual(
      loaded.schema.models.map((model) => model.name),
      ['Alpha', 'Zebra'],
    );
  });

  it('accepts an explicit directory argument', () => {
    const loaded = loadSchemaFromArg(fragmentsDir, root);
    assert.equal(loaded.source.kind, 'fragments');
    assert.ok(loaded.canonicalSource.includes('model Alpha'));
    assert.ok(loaded.canonicalSource.includes('model Zebra'));
    assert.doesNotMatch(loaded.canonicalSource, /^extensions \{/m);
    assert.doesNotMatch(loaded.canonicalSource, /^functions \{/m);
  });

  it('produces SQL matching an equivalent single-file schema', () => {
    const singleSource = `models {
  model Alpha { id: UUID @id }
  model Zebra { id: UUID @id }
}
`;
    const singleSchema = parse(singleSource);
    const fragmentSql = new SqlGenerator().generate(loadSchemaFromArg(fragmentsDir, root).schema);
    const singleSql = new SqlGenerator().generate(singleSchema);
    assert.equal(fragmentSql, singleSql);
  });
});
