// Run: npm test

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { syncGeneratedRouteFiles } from '../generate.js';

describe('syncGeneratedRouteFiles', () => {
  let tempDir = '';

  after(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes current routes and deletes stale files omitted by @rest', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-generate-'));
    const routesDir = path.join(tempDir, 'routes');
    await mkdir(routesDir, { recursive: true });
    await writeFile(path.join(routesDir, 'users.ts'), 'stale full crud\n', 'utf8');
    await writeFile(path.join(routesDir, 'hiddens.ts'), 'stale rest false\n', 'utf8');

    await syncGeneratedRouteFiles(
      routesDir,
      new Map([['users.ts', '// read-only users\n']]),
    );

    assert.equal(await readFile(path.join(routesDir, 'users.ts'), 'utf8'), '// read-only users\n');
    await assert.rejects(
      () => readFile(path.join(routesDir, 'hiddens.ts'), 'utf8'),
      /ENOENT/,
    );
  });
});
