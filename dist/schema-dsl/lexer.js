import { keywordTokenType, TokenType } from './tokens.js';
export class LexError extends Error {
    line;
    col;
    constructor(message, line, col) {
        super(`${message} at line ${line}, col ${col}`);
        this.name = 'LexError';
        this.line = line;
        this.col = col;
    }
}
export class Lexer {
    source;
    pos = 0;
    line = 1;
    col = 1;
    cached = null;
    constructor(source) {
        this.source = source;
    }
    peek() {
        if (!this.cached) {
            this.cached = this.scanToken();
        }
        return this.cached;
    }
    nextToken() {
        const token = this.peek();
        this.cached = null;
        return token;
    }
    tokenizeAll() {
        const tokens = [];
        let token = this.nextToken();
        while (token.type !== TokenType.EOF) {
            tokens.push(token);
            token = this.nextToken();
        }
        tokens.push(token);
        return tokens;
    }
    scanToken() {
        this.skipWhitespaceAndComments();
        const startPos = this.pos;
        const startLine = this.line;
        const startCol = this.col;
        if (this.isAtEnd()) {
            return this.makeToken(TokenType.EOF, '', startLine, startCol, startPos);
        }
        const char = this.advance();
        switch (char) {
            case '{':
                return this.makeToken(TokenType.LBRACE, char, startLine, startCol, startPos);
            case '}':
                return this.makeToken(TokenType.RBRACE, char, startLine, startCol, startPos);
            case '[':
                return this.makeToken(TokenType.LBRACKET, char, startLine, startCol, startPos);
            case ']':
                return this.makeToken(TokenType.RBRACKET, char, startLine, startCol, startPos);
            case '(':
                return this.makeToken(TokenType.LPAREN, char, startLine, startCol, startPos);
            case ')':
                return this.makeToken(TokenType.RPAREN, char, startLine, startCol, startPos);
            case ':':
                return this.makeToken(TokenType.COLON, char, startLine, startCol, startPos);
            case ',':
                return this.makeToken(TokenType.COMMA, char, startLine, startCol, startPos);
            case '?':
                return this.makeToken(TokenType.QUESTION, char, startLine, startCol, startPos);
            case '@':
                if (this.match('@')) {
                    return this.makeToken(TokenType.ATAT, '@@', startLine, startCol, startPos);
                }
                return this.makeToken(TokenType.AT, char, startLine, startCol, startPos);
            case '"':
                if (this.match('"') && this.match('"')) {
                    return this.scanTripleString(startLine, startCol, startPos);
                }
                return this.scanString(startLine, startCol, startPos);
            default:
                if (this.isDigit(char)) {
                    return this.scanNumber(startLine, startCol, startPos);
                }
                if (this.isIdentStart(char)) {
                    return this.scanIdentifier(startLine, startCol, startPos);
                }
                throw new LexError(`Unexpected character '${char}'`, startLine, startCol);
        }
    }
    scanString(startLine, startCol, startPos) {
        let value = '';
        while (!this.isAtEnd()) {
            const char = this.advance();
            if (char === '"') {
                return this.makeToken(TokenType.STRING, value, startLine, startCol, startPos);
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
    scanTripleString(startLine, startCol, startPos) {
        let value = '';
        while (!this.isAtEnd()) {
            if (this.peekChar() === '"' && this.peekChar(1) === '"' && this.peekChar(2) === '"') {
                this.advance();
                this.advance();
                this.advance();
                return this.makeToken(TokenType.TRIPLE_STRING, value, startLine, startCol, startPos);
            }
            value += this.advance();
        }
        throw new LexError('Unterminated triple-quoted string', startLine, startCol);
    }
    scanNumber(startLine, startCol, startPos) {
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
        return this.makeToken(TokenType.NUMBER, value, startLine, startCol, startPos);
    }
    scanIdentifier(startLine, startCol, startPos) {
        let value = this.source[this.pos - 1];
        while (!this.isAtEnd() && this.isIdentPart(this.peekChar())) {
            value += this.advance();
        }
        const type = keywordTokenType(value);
        return this.makeToken(type, value, startLine, startCol, startPos);
    }
    skipWhitespaceAndComments() {
        while (!this.isAtEnd()) {
            const char = this.peekChar();
            if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
                this.advance();
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
    makeToken(type, value, line, col, start) {
        return { type, value, line, col, start, end: this.pos };
    }
    isAtEnd() {
        return this.pos >= this.source.length;
    }
    peekChar(offset = 0) {
        return this.source[this.pos + offset] ?? '\0';
    }
    advance() {
        const char = this.source[this.pos];
        this.pos += 1;
        if (char === '\n') {
            this.line += 1;
            this.col = 1;
        }
        else {
            this.col += 1;
        }
        return char;
    }
    match(expected) {
        if (this.isAtEnd() || this.source[this.pos] !== expected) {
            return false;
        }
        this.advance();
        return true;
    }
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    isIdentStart(char) {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
    }
    isIdentPart(char) {
        return this.isIdentStart(char) || this.isDigit(char) || char === '-';
    }
}
