import { readFileSync } from 'node:fs';
import { inspect, parse, tokenize } from './index.js';

const args = process.argv.slice(2);
const showTokens = args.includes('--tokens');
const filePath = args.find((arg: string) => !arg.startsWith('--'));

if (!filePath) {
  console.error('Usage: tsx src/schema-dsl/cli.ts [--tokens] <file.schema>');
  process.exit(1);
}

const source = readFileSync(filePath, 'utf8');

try {
  if (showTokens) {
    const tokens = tokenize(source);
    for (const token of tokens) {
      console.log(`${token.line}:${token.col}\t${token.type}\t${JSON.stringify(token.value)}`);
    }
    process.exit(0);
  }

  const schema = parse(source);
  console.log(inspect(schema));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
