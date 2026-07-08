// Run: npm test

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { runHooksAdd } from '../hooks.js';
import { createHookFileTemplate } from '../templates.js';

const EMPTY_SCHEMA = `extensions {

}

enums {

}

models {

}
`;

describe('createHookFileTemplate', () => {
  it('emits all six lifecycle hooks with typed imports', () => {
    const output = createHookFileTemplate('User');

    assert.match(output, /import \{ defineHooks \} from 'schematic-pg\/api\/hooks';/);
    assert.match(output, /import type \{ User, UserCreateInput, UserUpdateInput \} from '\.\.\/\.\.\/generated\/db-types\.js';/);
    assert.match(output, /async beforeCreate\(ctx, next\)/);
    assert.match(output, /async afterCreate\(ctx\)/);
    assert.match(output, /async beforeUpdate\(ctx, next\)/);
    assert.match(output, /async afterUpdate\(ctx\)/);
    assert.match(output, /async beforeDelete\(ctx, next\)/);
    assert.match(output, /async afterDelete\(ctx\)/);
    assert.match(output, /await next\(\);/);
    assert.match(output, /ctx\.abort\(422, 'reason'\)/);
  });
});

describe('runHooksAdd', () => {
  let tempDir = '';

  after(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes src/hooks/User.ts when --model is provided', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-hooks-'));
    const schemaPath = path.join(tempDir, 'app.schema');
    const hooksDir = path.join(tempDir, 'src/hooks');

    await writeFile(schemaPath, EMPTY_SCHEMA.replace('models {\n\n}', 'models {\n  model User {\n    id: UUID @id\n  }\n}'), 'utf8');

    const hookFilePath = await runHooksAdd(['--model', 'User'], {
      schemaPath,
      modelName: 'User',
      hooksDir,
    });

    const content = await readFile(hookFilePath, 'utf8');
    assert.match(content, /defineHooks<User, UserCreateInput, UserUpdateInput>/);
  });

  it('aborts when the hook file already exists', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-hooks-'));
    const schemaPath = path.join(tempDir, 'app.schema');
    const hooksDir = path.join(tempDir, 'src/hooks');
    const hookFilePath = path.join(hooksDir, 'User.ts');

    await writeFile(schemaPath, EMPTY_SCHEMA.replace('models {\n\n}', 'models {\n  model User {\n    id: UUID @id\n  }\n}'), 'utf8');
    await mkdir(hooksDir, { recursive: true });
    await writeFile(hookFilePath, 'export default {};\n', 'utf8');

    await assert.rejects(
      () =>
        runHooksAdd(['--model', 'User'], {
          schemaPath,
          modelName: 'User',
          hooksDir,
        }),
      /Hook file already exists/,
    );
  });

  it('aborts when --model does not exist in schema', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-hooks-'));
    const schemaPath = path.join(tempDir, 'app.schema');
    const hooksDir = path.join(tempDir, 'src/hooks');

    await writeFile(schemaPath, EMPTY_SCHEMA.replace('models {\n\n}', 'models {\n  model User {\n    id: UUID @id\n  }\n}'), 'utf8');

    await assert.rejects(
      () =>
        runHooksAdd(['--model', 'Missing'], {
          schemaPath,
          modelName: 'Missing',
          hooksDir,
        }),
      /Model "Missing" was not found in schema/,
    );
  });

  it('aborts when schema has no models', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-hooks-'));
    const schemaPath = path.join(tempDir, 'app.schema');
    const hooksDir = path.join(tempDir, 'src/hooks');

    await writeFile(schemaPath, EMPTY_SCHEMA, 'utf8');

    await assert.rejects(
      () =>
        runHooksAdd(['--model', 'User'], {
          schemaPath,
          modelName: 'User',
          hooksDir,
        }),
      /Schema has no models/,
    );
  });
});
