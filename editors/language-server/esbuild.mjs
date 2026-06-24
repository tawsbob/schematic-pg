import esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(fileURLToPath(import.meta.url));
const outFile = join(packageDir, 'out/server.js');

mkdirSync(dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [join(packageDir, 'src/server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  external: ['vscode-languageserver', 'vscode-languageserver-textdocument'],
  sourcemap: true,
  packages: 'bundle',
});

console.log(`Built ${outFile}`);
