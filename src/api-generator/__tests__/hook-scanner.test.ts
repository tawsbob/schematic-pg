// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { discoverHooks } from '../hook-scanner.js';
import { generateHooksFile } from '../hooks-generator.js';

const schemaSource = readFileSync(path.resolve('app.schema'), 'utf8');
const schema = parse(schemaSource);
const fixtureHooksDir = path.resolve('src/api-generator/__tests__/fixtures/hooks');
const missingHooksDir = path.resolve('src/api-generator/__tests__/fixtures/missing-hooks');

describe('discoverHooks', () => {
  it('returns an empty result when the directory is missing', () => {
    const result = discoverHooks(missingHooksDir, schema);

    assert.deepEqual(result.entries, []);
    assert.equal(result.modelsWithHooks.size, 0);
  });

  it('discovers hook files that match schema models', () => {
    const result = discoverHooks(fixtureHooksDir, schema);
    const user = result.entries.find((entry) => entry.modelName === 'User');
    const log = result.entries.find((entry) => entry.modelName === 'Log');

    assert.ok(user);
    assert.equal(user.importName, 'userHooks');
    assert.equal(user.importPath, '../src/hooks/User.js');

    assert.ok(log);
    assert.equal(log.importName, 'logHooks');
    assert.equal(log.importPath, '../src/hooks/Log.js');
    assert.equal(result.modelsWithHooks.has('User'), true);
    assert.equal(result.modelsWithHooks.has('Log'), true);
  });

  it('skips unknown models and underscore-prefixed files', () => {
    const result = discoverHooks(fixtureHooksDir, schema);

    assert.equal(result.entries.some((entry) => entry.modelName === 'UnknownModel'), false);
    assert.equal(result.entries.some((entry) => entry.modelName === '_skip'), false);
  });

  it('returns entries sorted by model name', () => {
    const result = discoverHooks(fixtureHooksDir, schema);

    assert.deepEqual(
      result.entries.map((entry) => entry.modelName),
      ['Log', 'User'],
    );
  });
});

describe('generateHooksFile', () => {
  it('emits an empty registry when no hooks are discovered', () => {
    const output = generateHooksFile([]);

    assert.match(output, /export const HOOKS = \{\};/);
  });

  it('emits imports and registry entries for discovered hooks', () => {
    const { entries } = discoverHooks(fixtureHooksDir, schema);
    const output = generateHooksFile(entries);

    assert.match(output, /import userHooks from '\.\.\/src\/hooks\/User\.js';/);
    assert.match(output, /import logHooks from '\.\.\/src\/hooks\/Log\.js';/);
    assert.match(output, /User: userHooks,/);
    assert.match(output, /Log: logHooks,/);
  });
});
