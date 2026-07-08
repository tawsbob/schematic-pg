// Run: npm test

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { runInit } from '../init.js';

describe('runInit', () => {
  let tempDir = '';

  after(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates AGENTS.md with framework usage instructions', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'schematic-pg-init-'));
    await mkdir(path.join(tempDir, '.git'));

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await runInit(['--skip-install']);
    } finally {
      process.chdir(previousCwd);
    }

    const agentsPath = path.join(tempDir, 'AGENTS.md');
    assert.equal(existsSync(agentsPath), true);

    const content = await readFile(agentsPath, 'utf8');
    assert.match(content, /app\.schema/);
    assert.match(content, /generated\//);
    assert.match(content, /src\/routes/);
    assert.match(content, /hooks:add/);
    assert.match(content, /createDbClient/);
    assert.match(content, /findMany/);
    assert.match(content, /ctx\.db/);
    assert.match(content, /c\.get\('db'\)/);
  });
});
