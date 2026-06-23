import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import type { Schema } from './ast.js';

export { Lexer, LexError } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { inspect } from './inspect.js';
export * from './ast.js';
export * from './tokens.js';

export function parse(source: string): Schema {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenizeAll();
  const parser = new Parser(tokens);
  return parser.parseSchema();
}

export function tokenize(source: string) {
  return new Lexer(source).tokenizeAll();
}
