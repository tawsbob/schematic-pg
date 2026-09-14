import type { Schema } from './ast.js';
export { Lexer, LexError } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { SchemaError, validateSchema } from './validate.js';
export { inspect } from './inspect.js';
export * from './ast.js';
export * from './tokens.js';
export declare function parse(source: string): Schema;
export declare function tokenize(source: string): import("./tokens.js").Token[];
