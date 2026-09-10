import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TokenType } from '../tokens.js';
import { expectLexError, tokenizeSnippet, tokenTypes } from './helpers.js';

function expectTokens(source: string, expected: Array<{ type: TokenType; value: string }>): void {
  const tokens = tokenTypes(source);
  assert.deepEqual(tokens, expected);
}

describe('Lexer', () => {
  describe('keywords', () => {
    it('tokenizes extensions enums models model functions function', () => {
      expectTokens('extensions enums models model functions function', [
        { type: TokenType.EXTENSIONS, value: 'extensions' },
        { type: TokenType.ENUMS, value: 'enums' },
        { type: TokenType.MODELS, value: 'models' },
        { type: TokenType.MODEL, value: 'model' },
        { type: TokenType.FUNCTIONS, value: 'functions' },
        { type: TokenType.FUNCTION, value: 'function' },
      ]);
    });
  });

  describe('boolean literals', () => {
    it('tokenizes true and false', () => {
      expectTokens('true false', [
        { type: TokenType.BOOLEAN, value: 'true' },
        { type: TokenType.BOOLEAN, value: 'false' },
      ]);
    });
  });

  describe('identifiers', () => {
    it('tokenizes uuid-ossp SET_NULL gen_random_uuid', () => {
      expectTokens('uuid-ossp SET_NULL gen_random_uuid', [
        { type: TokenType.IDENT, value: 'uuid-ossp' },
        { type: TokenType.IDENT, value: 'SET_NULL' },
        { type: TokenType.IDENT, value: 'gen_random_uuid' },
      ]);
    });

    it('tokenizes hyphenated ident as single IDENT', () => {
      expectTokens('uuid-ossp', [{ type: TokenType.IDENT, value: 'uuid-ossp' }]);
    });
  });

  describe('punctuation', () => {
    it('tokenizes { } [ ] ( ) : , ?', () => {
      expectTokens('{ } [ ] ( ) : , ?', [
        { type: TokenType.LBRACE, value: '{' },
        { type: TokenType.RBRACE, value: '}' },
        { type: TokenType.LBRACKET, value: '[' },
        { type: TokenType.RBRACKET, value: ']' },
        { type: TokenType.LPAREN, value: '(' },
        { type: TokenType.RPAREN, value: ')' },
        { type: TokenType.COLON, value: ':' },
        { type: TokenType.COMMA, value: ',' },
        { type: TokenType.QUESTION, value: '?' },
      ]);
    });
  });

  describe('@ vs @@', () => {
    it('tokenizes @id @@index as AT, IDENT, ATAT, IDENT', () => {
      expectTokens('@id @@index', [
        { type: TokenType.AT, value: '@' },
        { type: TokenType.IDENT, value: 'id' },
        { type: TokenType.ATAT, value: '@@' },
        { type: TokenType.IDENT, value: 'index' },
      ]);
    });
  });

  describe('strings', () => {
    it('tokenizes double-quoted string', () => {
      expectTokens('"hello"', [{ type: TokenType.STRING, value: 'hello' }]);
    });

    it('tokenizes escaped string with decoded escapes', () => {
      expectTokens('"a\\n\\t\\""', [{ type: TokenType.STRING, value: 'a\n\t"' }]);
    });

    it('tokenizes regex pattern string with escape sequences decoded', () => {
      // Source uses \w and \. — lexer decodes unknown escapes to the char after backslash
      expectTokens('"^[\\w.-]+@[\\w.-]+\\.\\w+$"', [
        { type: TokenType.STRING, value: '^[w.-]+@[w.-]+.w+$' },
      ]);
    });
  });

  describe('triple-quoted strings', () => {
    it('tokenizes triple-quoted string preserving newlines', () => {
      expectTokens('"""line1\nline2"""', [
        { type: TokenType.TRIPLE_STRING, value: 'line1\nline2' },
      ]);
    });

    it('tokenizes triple-quoted string preserving embedded double quotes', () => {
      expectTokens('"""FROM "user" x"""', [
        { type: TokenType.TRIPLE_STRING, value: 'FROM "user" x' },
      ]);
    });

    it('tokenizes multiline triple string with leading/trailing newlines', () => {
      expectTokens('"""\n SQL\n"""', [{ type: TokenType.TRIPLE_STRING, value: '\n SQL\n' }]);
    });
  });

  describe('numbers', () => {
    it('tokenizes integer and decimal', () => {
      expectTokens('10 10.2', [
        { type: TokenType.NUMBER, value: '10' },
        { type: TokenType.NUMBER, value: '10.2' },
      ]);
    });
  });

  describe('line comments', () => {
    it('skips line comments', () => {
      expectTokens('id // comment\n: UUID', [
        { type: TokenType.IDENT, value: 'id' },
        { type: TokenType.COLON, value: ':' },
        { type: TokenType.IDENT, value: 'UUID' },
      ]);
    });
  });

  describe('EOF', () => {
    it('appends EOF after last token', () => {
      const tokens = tokenizeSnippet('model');
      assert.equal(tokens[tokens.length - 1].type, TokenType.EOF);
      assert.equal(tokens.length, 2);
      assert.equal(tokens[0].type, TokenType.MODEL);
    });
  });

  describe('whitespace', () => {
    it('skips whitespace between tokens', () => {
      expectTokens('model User', [
        { type: TokenType.MODEL, value: 'model' },
        { type: TokenType.IDENT, value: 'User' },
      ]);
    });
  });

  describe('errors', () => {
    it('throws LexError for unterminated double-quoted string', () => {
      expectLexError('"string', 'Unterminated string', { line: 1, col: 1 });
    });

    it('throws LexError for unterminated triple-quoted string', () => {
      expectLexError('"""triple', 'Unterminated triple-quoted string', { line: 1, col: 1 });
    });

    it('throws LexError for unexpected character $', () => {
      expectLexError('$', "Unexpected character '$'", { line: 1, col: 1 });
    });

    it('throws LexError for unexpected character #', () => {
      expectLexError('#', "Unexpected character '#'", { line: 1, col: 1 });
    });
  });
});
