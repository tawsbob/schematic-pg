import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  mergeFragments,
  parseFragment,
  validateMergedSchema,
} from '../../schema-dsl/index.js';
import { SqlGenerator } from '../../sql-generator/sql-generator.js';
import {
  loadSchema,
  resolveSchemaSource,
} from '../index.js';

const repoRoot = process.cwd();
const fragmentsDir = join(repoRoot, 'schema');

describe('repo schema/ fragments', () => {
  it('discovers schema/*.schema over app.schema', () => {
    const source = resolveSchemaSource(undefined, repoRoot);
    assert.equal(source.kind, 'fragments');
    if (source.kind === 'fragments') {
      assert.equal(source.dir, fragmentsDir);
      assert.ok(source.files.length >= 4);
      assert.ok(source.files.every((file) => file.endsWith('.schema')));
    }
  });

  it('loads, merges, and validates the domain fragments', () => {
    const source = resolveSchemaSource(undefined, repoRoot);
    const loaded = loadSchema(source);

    assert.deepEqual(
      loaded.schema.extensions.map((item) => item.name),
      ['pgcrypto', 'uuid-ossp'],
    );
    assert.deepEqual(
      loaded.schema.enums.map((item) => item.name),
      ['OrderStatus', 'UserRole'],
    );
    assert.deepEqual(
      loaded.schema.predicates.map((item) => item.name),
      ['activeTeamMember', 'ownUser'],
    );
    assert.deepEqual(
      loaded.schema.models.map((item) => item.name),
      ['Announcement', 'Log', 'Note', 'Order', 'Product', 'ProductOrder', 'Profile', 'Team', 'TeamMember', 'User'],
    );
    assert.deepEqual(
      loaded.schema.functions.map((item) => item.name),
      ['getUserBalance', 'searchProducts'],
    );
    assert.doesNotThrow(() => validateMergedSchema(loaded.schema));
  });

  it('omits empty sections from the canonical snapshot text', () => {
    const loaded = loadSchema(resolveSchemaSource(undefined, repoRoot));
    assert.match(loaded.canonicalSource, /^extensions \{/m);
    assert.match(loaded.canonicalSource, /^enums \{/m);
    assert.match(loaded.canonicalSource, /^predicates \{/m);
    assert.match(loaded.canonicalSource, /^models \{/m);
    assert.match(loaded.canonicalSource, /^functions \{/m);
    assert.doesNotMatch(loaded.canonicalSource, /extensions \{\s*\}/);
    assert.doesNotMatch(loaded.canonicalSource, /enums \{\s*\}/);
    assert.doesNotMatch(loaded.canonicalSource, /predicates \{\s*\}/);
    assert.doesNotMatch(loaded.canonicalSource, /models \{\s*\}/);
    assert.doesNotMatch(loaded.canonicalSource, /functions \{\s*\}/);
  });

  it('is independent of fragment file read order', () => {
    const files = readdirSync(fragmentsDir)
      .filter((name) => name.endsWith('.schema'))
      .map((name) => join(fragmentsDir, name));

    const forward = mergeFragments(
      files.map((file) => {
        const source = readFileSync(file, 'utf8');
        return { file, source, schema: parseFragment(source, file) };
      }),
    );
    const reverse = mergeFragments(
      [...files].reverse().map((file) => {
        const source = readFileSync(file, 'utf8');
        return { file, source, schema: parseFragment(source, file) };
      }),
    );

    assert.equal(forward.canonicalSource, reverse.canonicalSource);
    assert.equal(
      new SqlGenerator().generate(forward.schema),
      new SqlGenerator().generate(reverse.schema),
    );
  });

  it('keeps declaration locs pointing at originating fragment files', () => {
    const loaded = loadSchema(resolveSchemaSource(undefined, repoRoot));
    const user = loaded.schema.models.find((model) => model.name === 'User');
    const product = loaded.schema.models.find((model) => model.name === 'Product');
    const order = loaded.schema.models.find((model) => model.name === 'Order');

    assert.ok(user?.loc.file?.endsWith('user.schema'));
    assert.ok(product?.loc.file?.endsWith('product.schema'));
    assert.ok(order?.loc.file?.endsWith('order.schema'));
  });
});
