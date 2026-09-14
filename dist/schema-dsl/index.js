import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { validateSchema } from './validate.js';
export { Lexer, LexError } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { SchemaError, validateSchema } from './validate.js';
export { inspect } from './inspect.js';
export * from './ast.js';
export * from './tokens.js';
export function parse(source) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenizeAll();
    const parser = new Parser(tokens);
    const schema = parser.parseSchema();
    validateSchema(schema);
    return schema;
}
export function tokenize(source) {
    return new Lexer(source).tokenizeAll();
}
