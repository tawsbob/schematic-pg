import type {
  Attribute,
  AttributeArgs,
  BlockLiteral,
  Directive,
  Enum,
  Extension,
  Field,
  KeyValuePair,
  Model,
  Schema,
  SourceLocation,
  TypeExpr,
  Value,
} from './ast.js';
import { Token, TokenType } from './tokens.js';

export class ParseError extends Error {
  readonly line: number;
  readonly col: number;
  readonly expected: string;
  readonly found: Token;

  constructor(expected: string, found: Token) {
    super(
      `Parse error at line ${found.line}, col ${found.col}: expected ${expected}, found ${found.type} (${found.value || 'EOF'})`,
    );
    this.name = 'ParseError';
    this.line = found.line;
    this.col = found.col;
    this.expected = expected;
    this.found = found;
  }
}

export class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseSchema(): Schema {
    const start = this.current();
    const extensions = this.parseExtensionsSection();
    const enums = this.parseEnumsSection();
    const models = this.parseModelsSection();
    this.expect(TokenType.EOF, 'end of schema');

    return {
      kind: 'Schema',
      extensions,
      enums,
      models,
      loc: this.loc(start),
    };
  }

  parseModel(): Model {
    this.expect(TokenType.MODEL, "'model'");
    const nameToken = this.expect(TokenType.IDENT, 'model name');
    this.expect(TokenType.LBRACE, "'{'");
    const model = this.parseModelBody(nameToken.value, nameToken);
    this.expect(TokenType.RBRACE, "'}'");
    return model;
  }

  parseField(): Field {
    const start = this.expect(TokenType.IDENT, 'field name');
    this.expect(TokenType.COLON, "':'");
    const type = this.parseTypeExpr();
    const typeLine = type.loc.endLine ?? type.loc.line;
    const attributes = this.parseFieldAttributes(typeLine);
    return {
      kind: 'Field',
      name: start.value,
      type,
      attributes,
      loc: this.loc(start),
    };
  }

  parseAttribute(): Attribute {
    return this.parseAttributeInternal();
  }

  private parseExtensionsSection(): Extension[] {
    this.expect(TokenType.EXTENSIONS, "'extensions'");
    this.expect(TokenType.LBRACE, "'{'");
    const extensions: Extension[] = [];

    while (!this.check(TokenType.RBRACE)) {
      extensions.push(this.parseExtension());
    }

    this.expect(TokenType.RBRACE, "'}'");
    return extensions;
  }

  private parseExtension(): Extension {
    const start = this.expect(TokenType.IDENT, 'extension name');
    let options: BlockLiteral | undefined;

    if (this.check(TokenType.LBRACE)) {
      options = this.parseBlockLiteral();
    }

    return {
      kind: 'Extension',
      name: start.value,
      options,
      loc: this.loc(start),
    };
  }

  private parseEnumsSection(): Enum[] {
    this.expect(TokenType.ENUMS, "'enums'");
    this.expect(TokenType.LBRACE, "'{'");
    const enums: Enum[] = [];

    while (!this.check(TokenType.RBRACE)) {
      enums.push(this.parseEnum());
    }

    this.expect(TokenType.RBRACE, "'}'");
    return enums;
  }

  private parseEnum(): Enum {
    const start = this.expect(TokenType.IDENT, 'enum name');
    this.expect(TokenType.LBRACE, "'{'");
    const values = this.parseIdentList();
    this.expect(TokenType.RBRACE, "'}'");

    return {
      kind: 'Enum',
      name: start.value,
      values,
      loc: this.loc(start),
    };
  }

  private parseModelsSection(): Model[] {
    this.expect(TokenType.MODELS, "'models'");
    this.expect(TokenType.LBRACE, "'{'");
    const models: Model[] = [];

    while (!this.check(TokenType.RBRACE)) {
      models.push(this.parseModel());
    }

    this.expect(TokenType.RBRACE, "'}'");
    return models;
  }

  private parseModelBody(name: string, start: Token): Model {
    const fields: Field[] = [];
    const attributes: Attribute[] = [];
    const directives: Directive[] = [];

    while (!this.check(TokenType.RBRACE)) {
      if (this.check(TokenType.ATAT)) {
        directives.push(this.parseDirective());
        continue;
      }

      if (this.check(TokenType.AT)) {
        attributes.push(this.parseAttributeInternal());
        continue;
      }

      fields.push(this.parseField());
    }

    return {
      kind: 'Model',
      name,
      fields,
      attributes,
      directives,
      loc: this.loc(start),
    };
  }

  private parseTypeExpr(): TypeExpr {
    const start = this.expect(TokenType.IDENT, 'type name');
    let args: Value[] | undefined;

    if (this.check(TokenType.LPAREN)) {
      this.advance();
      args = this.parseValueList();
      this.expect(TokenType.RPAREN, "')'");
    }

    let optional = false;
    let array = false;

    if (this.check(TokenType.QUESTION)) {
      this.advance();
      optional = true;
    } else if (this.check(TokenType.LBRACKET) && this.peekType(1) === TokenType.RBRACKET) {
      this.advance();
      this.advance();
      array = true;
    }

    return {
      kind: 'TypeExpr',
      name: start.value,
      args,
      optional: optional || undefined,
      array: array || undefined,
      loc: this.loc(start),
    };
  }

  private parseFieldAttributes(typeLine: number): Attribute[] {
    const attributes: Attribute[] = [];
    while (
      this.check(TokenType.AT) &&
      this.peekType(1) !== TokenType.AT &&
      this.current().line === typeLine
    ) {
      attributes.push(this.parseAttributeInternal());
    }
    return attributes;
  }

  private parseAttributeInternal(): Attribute {
    const start = this.expect(TokenType.AT, "'@'");
    const nameToken = this.expect(TokenType.IDENT, 'attribute name');
    const args = this.check(TokenType.LPAREN) ? this.parseAttributeArgs() : undefined;

    return {
      kind: 'Attribute',
      name: nameToken.value,
      args,
      loc: this.loc(start),
    };
  }

  private parseDirective(): Directive {
    const start = this.expect(TokenType.ATAT, "'@@'");
    const nameToken = this.expect(TokenType.IDENT, 'directive name');
    let args: AttributeArgs | undefined;

    if (this.check(TokenType.LBRACE)) {
      args = {
        kind: 'KeyValueArgs',
        pairs: this.parseBlockLiteral().pairs,
      };
    } else if (this.check(TokenType.LPAREN)) {
      args = this.parseAttributeArgs();
    }

    return {
      kind: 'Directive',
      name: nameToken.value,
      args,
      loc: this.loc(start),
    };
  }

  private parseAttributeArgs(): AttributeArgs {
    this.expect(TokenType.LPAREN, "'('");

    if (this.check(TokenType.RPAREN)) {
      this.advance();
      return { kind: 'ExpressionArgs', expressions: [] };
    }

    const args = this.isKeyValueListStart()
      ? { kind: 'KeyValueArgs' as const, pairs: this.parseKeyValueList() }
      : { kind: 'ExpressionArgs' as const, expressions: this.parseValueList() };

    this.expect(TokenType.RPAREN, "')'");
    return args;
  }

  private parseValue(): Value {
    const token = this.current();

    switch (token.type) {
      case TokenType.STRING:
        this.advance();
        return { kind: 'StringLiteral', value: token.value };
      case TokenType.TRIPLE_STRING:
        this.advance();
        return { kind: 'TripleStringLiteral', value: token.value };
      case TokenType.NUMBER:
        this.advance();
        return { kind: 'NumberLiteral', value: Number(token.value) };
      case TokenType.BOOLEAN:
        this.advance();
        return { kind: 'BooleanLiteral', value: token.value === 'true' };
      case TokenType.LBRACKET:
        return this.parseArrayLiteral();
      case TokenType.LBRACE:
        return this.parseBlockLiteral();
      case TokenType.IDENT:
        return this.parseIdentOrCall();
      default:
        throw new ParseError('value', token);
    }
  }

  private parseIdentOrCall(): Value {
    const ident = this.expect(TokenType.IDENT, 'identifier');

    if (!this.check(TokenType.LPAREN)) {
      return { kind: 'Identifier', name: ident.value };
    }

    this.advance();
    const args = this.check(TokenType.RPAREN) ? [] : this.parseValueList();
    this.expect(TokenType.RPAREN, "')'");

    return {
      kind: 'CallExpression',
      callee: ident.value,
      args,
    };
  }

  private parseArrayLiteral(): ArrayLiteralValue {
    this.expect(TokenType.LBRACKET, "'['");
    const elements = this.check(TokenType.RBRACKET) ? [] : this.parseValueList();
    this.expect(TokenType.RBRACKET, "']'");
    return { kind: 'ArrayLiteral', elements };
  }

  private parseBlockLiteral(): BlockLiteral {
    this.expect(TokenType.LBRACE, "'{'");
    const pairs = this.check(TokenType.RBRACE) ? [] : this.parseKeyValueList();
    this.expect(TokenType.RBRACE, "'}'");
    return { kind: 'BlockLiteral', pairs };
  }

  private parseKeyValueList(): KeyValuePair[] {
    const pairs: KeyValuePair[] = [];

    do {
      const keyToken = this.expect(TokenType.IDENT, 'key');
      this.expect(TokenType.COLON, "':'");
      const value = this.parseValue();
      pairs.push({
        key: keyToken.value,
        value,
        loc: this.loc(keyToken),
      });
    } while (this.match(TokenType.COMMA) && !this.isListEnd());

    this.consumeTrailingComma();
    return pairs;
  }

  private parseValueList(): Value[] {
    const values: Value[] = [];

    do {
      values.push(this.parseValue());
    } while (this.match(TokenType.COMMA) && !this.isListEnd());

    this.consumeTrailingComma();
    return values;
  }

  private parseIdentList(): string[] {
    const values: string[] = [];

    do {
      values.push(this.expect(TokenType.IDENT, 'identifier').value);
    } while (this.match(TokenType.COMMA) && !this.check(TokenType.RBRACE));

    this.consumeTrailingComma();
    return values;
  }

  private isKeyValueListStart(): boolean {
    if (!this.check(TokenType.IDENT)) {
      return false;
    }
    return this.peekType(1) === TokenType.COLON;
  }

  private isListEnd(): boolean {
    return (
      this.check(TokenType.RPAREN) ||
      this.check(TokenType.RBRACE) ||
      this.check(TokenType.RBRACKET)
    );
  }

  private consumeTrailingComma(): void {
    if (this.isListEnd() && this.previous().type === TokenType.COMMA) {
      // Trailing comma already consumed by match(); nothing else to do.
    }
  }

  private loc(start: Token): SourceLocation {
    const prev = this.previous();
    return {
      line: start.line,
      col: start.col,
      endLine: prev.line,
      endCol: prev.col + prev.value.length,
    };
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.eofToken();
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? this.eofToken();
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.index += 1;
    }
    return this.previous();
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.advance();
    return true;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private peekType(offset: number): TokenType {
    return this.tokens[this.index + offset]?.type ?? TokenType.EOF;
  }

  private expect(type: TokenType, description: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(description, token);
    }
    this.advance();
    return token;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private eofToken(): Token {
    const last = this.tokens[this.tokens.length - 1];
    return {
      type: TokenType.EOF,
      value: '',
      line: last?.line ?? 1,
      col: last?.col ?? 1,
    };
  }
}

type ArrayLiteralValue = Extract<Value, { kind: 'ArrayLiteral' }>;
