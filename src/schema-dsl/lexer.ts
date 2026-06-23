import { keywordTokenType, Token, TokenType } from './tokens.js';

export class LexError extends Error {
  readonly line: number;
  readonly col: number;

  constructor(message: string, line: number, col: number) {
    super(`${message} at line ${line}, col ${col}`);
    this.name = 'LexError';
    this.line = line;
    this.col = col;
  }
}

export class Lexer {
  private readonly source: string;
  private pos = 0;
  private line = 1;
  private col = 1;
  private cached: Token | null = null;

  constructor(source: string) {
    this.source = source;
  }

  peek(): Token {
    if (!this.cached) {
      this.cached = this.scanToken();
    }
    return this.cached;
  }

  nextToken(): Token {
    const token = this.peek();
    this.cached = null;
    return token;
  }

  tokenizeAll(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    tokens.push(token);
    return tokens;
  }

  private scanToken(): Token {
    this.skipWhitespaceAndComments();

    const startLine = this.line;
    const startCol = this.col;

    if (this.isAtEnd()) {
      return this.makeToken(TokenType.EOF, '', startLine, startCol);
    }

    const char = this.advance();

    switch (char) {
      case '{':
        return this.makeToken(TokenType.LBRACE, char, startLine, startCol);
      case '}':
        return this.makeToken(TokenType.RBRACE, char, startLine, startCol);
      case '[':
        return this.makeToken(TokenType.LBRACKET, char, startLine, startCol);
      case ']':
        return this.makeToken(TokenType.RBRACKET, char, startLine, startCol);
      case '(':
        return this.makeToken(TokenType.LPAREN, char, startLine, startCol);
      case ')':
        return this.makeToken(TokenType.RPAREN, char, startLine, startCol);
      case ':':
        return this.makeToken(TokenType.COLON, char, startLine, startCol);
      case ',':
        return this.makeToken(TokenType.COMMA, char, startLine, startCol);
      case '?':
        return this.makeToken(TokenType.QUESTION, char, startLine, startCol);
      case '@':
        if (this.match('@')) {
          return this.makeToken(TokenType.ATAT, '@@', startLine, startCol);
        }
        return this.makeToken(TokenType.AT, char, startLine, startCol);
      case '"':
        if (this.match('"') && this.match('"')) {
          return this.scanTripleString(startLine, startCol);
        }
        return this.scanString(startLine, startCol);
      default:
        if (this.isDigit(char)) {
          return this.scanNumber(startLine, startCol);
        }
        if (this.isIdentStart(char)) {
          return this.scanIdentifier(startLine, startCol);
        }
        throw new LexError(`Unexpected character '${char}'`, startLine, startCol);
    }
  }

  private scanString(startLine: number, startCol: number): Token {
    let value = '';

    while (!this.isAtEnd()) {
      const char = this.advance();
      if (char === '"') {
        return this.makeToken(TokenType.STRING, value, startLine, startCol);
      }
      if (char === '\\') {
        if (this.isAtEnd()) {
          throw new LexError('Unterminated string escape', startLine, startCol);
        }
        const escaped = this.advance();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '"':
            value += '"';
            break;
          case '\\':
            value += '\\';
            break;
          default:
            value += escaped;
            break;
        }
        continue;
      }
      if (char === '\n') {
        throw new LexError('Unterminated string', startLine, startCol);
      }
      value += char;
    }

    throw new LexError('Unterminated string', startLine, startCol);
  }

  private scanTripleString(startLine: number, startCol: number): Token {
    let value = '';

    while (!this.isAtEnd()) {
      if (this.match('"') && this.match('"') && this.match('"')) {
        return this.makeToken(TokenType.TRIPLE_STRING, value, startLine, startCol);
      }

      value += this.advance();
    }

    throw new LexError('Unterminated triple-quoted string', startLine, startCol);
  }

  private scanNumber(startLine: number, startCol: number): Token {
    let value = this.source[this.pos - 1];

    while (!this.isAtEnd() && this.isDigit(this.peekChar())) {
      value += this.advance();
    }

    if (this.peekChar() === '.' && this.isDigit(this.peekChar(1))) {
      value += this.advance();
      while (!this.isAtEnd() && this.isDigit(this.peekChar())) {
        value += this.advance();
      }
    }

    return this.makeToken(TokenType.NUMBER, value, startLine, startCol);
  }

  private scanIdentifier(startLine: number, startCol: number): Token {
    let value = this.source[this.pos - 1];

    while (!this.isAtEnd() && this.isIdentPart(this.peekChar())) {
      value += this.advance();
    }

    const type = keywordTokenType(value);
    return this.makeToken(type, value, startLine, startCol);
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const char = this.peekChar();

      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        continue;
      }

      if (char === '\n') {
        this.advance();
        this.line += 1;
        this.col = 1;
        continue;
      }

      if (char === '/' && this.peekChar(1) === '/') {
        while (!this.isAtEnd() && this.peekChar() !== '\n') {
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private makeToken(type: TokenType, value: string, line: number, col: number): Token {
    return { type, value, line, col };
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peekChar(offset = 0): string {
    return this.source[this.pos + offset] ?? '\0';
  }

  private advance(): string {
    const char = this.source[this.pos];
    this.pos += 1;
    if (char !== '\n') {
      this.col += 1;
    }
    return char;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.pos] !== expected) {
      return false;
    }
    this.advance();
    return true;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentStart(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isIdentPart(char: string): boolean {
    return this.isIdentStart(char) || this.isDigit(char) || char === '-';
  }
}
