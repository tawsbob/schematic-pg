import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = join(extensionDir, '../..');

const copies = [
  {
    from: join(rootDir, 'syntaxes'),
    to: join(extensionDir, 'syntaxes'),
  },
  {
    from: join(rootDir, 'language-configuration/schema-dsl.language-configuration.json'),
    to: join(extensionDir, 'language-configuration.json'),
  },
];

for (const { from, to } of copies) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

console.log('Copied schema DSL assets into editors/vscode');
