import esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(packageDir, 'out');
const serverOutDir = join(packageDir, 'server', 'out');

mkdirSync(outDir, { recursive: true });
mkdirSync(serverOutDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(packageDir, 'src/extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: join(outDir, 'extension.js'),
  external: ['vscode'],
  sourcemap: true,
});

const languageServerOut = join(packageDir, '..', 'language-server', 'out', 'server.js');
cpSync(languageServerOut, join(serverOutDir, 'server.js'));
if (existsSync(`${languageServerOut}.map`)) {
  cpSync(`${languageServerOut}.map`, join(serverOutDir, 'server.js.map'));
}

console.log('Built VS Code extension');
