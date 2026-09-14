import type {
  Attribute,
  AttributeArgs,
  BlockLiteral,
  Directive,
  Enum,
  Extension,
  Field,
  FunctionParam,
  FunctionReturn,
  KeyValuePair,
  Model,
  Partition,
  PartitionBound,
  PartitionSpec,
  PartitionStrategy,
  Schema,
  SourceLocation,
  SqlFunction,
  TableReturn,
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
    const functions = this.check(TokenType.FUNCTIONS) ? this.parseFunctionsSection() : [];
    this.expect(TokenType.EOF, 'end of schema');

    return {
      kind: 'Schema',
      extensions,
      enums,
      models,
      functions,
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

  private parseFunctionsSection(): SqlFunction[] {
    this.expect(TokenType.FUNCTIONS, "'functions'");
    this.expect(TokenType.LBRACE, "'{'");
    const functions: SqlFunction[] = [];
    const names = new Set<string>();

    while (!this.check(TokenType.RBRACE)) {
      functions.push(this.parseFunction(names));
    }

    this.expect(TokenType.RBRACE, "'}'");
    return functions;
  }

  parseFunction(existingNames?: Set<string>): SqlFunction {
    const start = this.expect(TokenType.FUNCTION, "'function'");
    const nameToken = this.expect(TokenType.IDENT, 'function name');
    if (existingNames?.has(nameToken.value)) {
      throw new ParseError(`unique function name, "${nameToken.value}" already defined`, nameToken);
    }
    existingNames?.add(nameToken.value);
    this.expect(TokenType.LPAREN, "'('");
    const params = this.parseFunctionParams();
    this.expect(TokenType.RPAREN, "')'");
    this.expect(TokenType.COLON, "':'");
    const returns = this.parseFunctionReturn(params);
    this.expect(TokenType.LBRACE, "'{'");
    const body = this.parseFunctionBody();
    this.expect(TokenType.RBRACE, "'}'");

    return {
      kind: 'SqlFunction',
      name: nameToken.value,
      params,
      returns,
      language: body.language,
      volatility: body.volatility,
      security: body.security,
      execute: body.execute,
      loc: this.loc(start),
    };
  }

  private parseFunctionReturn(params: FunctionParam[]): FunctionReturn {
    const current = this.current();
    if (
      current.type === TokenType.IDENT &&
      current.value === 'TABLE' &&
      this.peekType(1) === TokenType.LPAREN
    ) {
      return this.parseTableReturn(params);
    }

    if (current.type === TokenType.IDENT && current.value === 'TABLE') {
      throw new ParseError("TABLE column list '(...)'", current);
    }

    return this.parseTypeExpr();
  }

  private parseTableReturn(params: FunctionParam[]): TableReturn {
    const start = this.expect(TokenType.IDENT, "'TABLE'");
    this.expect(TokenType.LPAREN, "'('");

    if (this.check(TokenType.RPAREN)) {
      throw new ParseError('at least one TABLE column', this.current());
    }

    const columns: FunctionParam[] = [];
    const columnNames = new Set<string>();
    const paramNames = new Set(params.map((param) => param.name));

    do {
      const nameToken = this.expect(TokenType.IDENT, 'TABLE column name');
      if (columnNames.has(nameToken.value)) {
        throw new ParseError(
          `unique TABLE column name, "${nameToken.value}" already defined`,
          nameToken,
        );
      }
      if (paramNames.has(nameToken.value)) {
        throw new ParseError(
          `TABLE column name distinct from parameter "${nameToken.value}"`,
          nameToken,
        );
      }
      columnNames.add(nameToken.value);

      this.expect(TokenType.COLON, "':'");
      const type = this.parseTypeExpr();
      columns.push({
        kind: 'FunctionParam',
        name: nameToken.value,
        type,
        loc: this.loc(nameToken),
      });
    } while (this.match(TokenType.COMMA) && !this.check(TokenType.RPAREN));

    this.consumeTrailingComma();
    this.expect(TokenType.RPAREN, "')'");

    return {
      kind: 'TableReturn',
      columns,
      loc: this.loc(start),
    };
  }

  private parseFunctionParams(): FunctionParam[] {
    if (this.check(TokenType.RPAREN)) {
      return [];
    }

    const params: FunctionParam[] = [];

    do {
      params.push(this.parseFunctionParam());
    } while (this.match(TokenType.COMMA) && !this.check(TokenType.RPAREN));

    this.consumeTrailingComma();
    return params;
  }

  private parseFunctionParam(): FunctionParam {
    const start = this.expect(TokenType.IDENT, 'parameter name');
    this.expect(TokenType.COLON, "':'");
    const type = this.parseTypeExpr();
    return {
      kind: 'FunctionParam',
      name: start.value,
      type,
      loc: this.loc(start),
    };
  }

  private parseFunctionBody(): {
    language?: string;
    volatility?: string;
    security?: string;
    execute: string;
  } {
    if (this.check(TokenType.RBRACE)) {
      throw new ParseError("function body key 'execute'", this.current());
    }

    let language: string | undefined;
    let volatility: string | undefined;
    let security: string | undefined;
    let execute: string | undefined;

    do {
      const keyToken = this.expect(TokenType.IDENT, 'function body key');
      this.expect(TokenType.COLON, "':'");
      const valueToken = this.current();
      const value = this.parseValue();

      switch (keyToken.value) {
        case 'language': {
          if (value.kind !== 'Identifier') {
            throw new ParseError("'sql' or 'plpgsql'", valueToken);
          }
          const languageName = value.name.toLowerCase();
          if (languageName !== 'sql' && languageName !== 'plpgsql') {
            throw new ParseError("'sql' or 'plpgsql'", valueToken);
          }
          language = languageName;
          break;
        }
        case 'volatility': {
          if (value.kind !== 'Identifier') {
            throw new ParseError("'VOLATILE', 'STABLE', or 'IMMUTABLE'", valueToken);
          }
          const volatilityName = value.name.toUpperCase();
          if (
            volatilityName !== 'VOLATILE' &&
            volatilityName !== 'STABLE' &&
            volatilityName !== 'IMMUTABLE'
          ) {
            throw new ParseError("'VOLATILE', 'STABLE', or 'IMMUTABLE'", valueToken);
          }
          volatility = volatilityName;
          break;
        }
        case 'security': {
          if (value.kind !== 'Identifier') {
            throw new ParseError("'INVOKER' or 'DEFINER'", valueToken);
          }
          const securityName = value.name.toUpperCase();
          if (securityName !== 'INVOKER' && securityName !== 'DEFINER') {
            throw new ParseError("'INVOKER' or 'DEFINER'", valueToken);
          }
          security = securityName;
          break;
        }
        case 'execute': {
          if (value.kind !== 'TripleStringLiteral') {
            throw new ParseError('triple-quoted execute body', valueToken);
          }
          execute = value.value.trim();
          if (execute.length === 0) {
            throw new ParseError('non-empty execute body', valueToken);
          }
          break;
        }
        default:
          throw new ParseError(
            "function body key 'language', 'volatility', 'security', or 'execute'",
            keyToken,
          );
      }

      this.match(TokenType.COMMA);
    } while (!this.check(TokenType.RBRACE));

    if (!execute) {
      throw new ParseError("function body key 'execute'", this.current());
    }

    return { language, volatility, security, execute };
  }

  private parseModelBody(name: string, start: Token): Model {
    const fields: Field[] = [];
    const attributes: Attribute[] = [];
    const directives: Directive[] = [];
    let partition: PartitionSpec | undefined;

    while (!this.check(TokenType.RBRACE)) {
      if (this.check(TokenType.ATAT)) {
        if (this.peekType(1) === TokenType.IDENT && this.tokens[this.index + 1]?.value === 'partition') {
          if (partition) {
            throw new ParseError('at most one @@partition per model', this.current());
          }
          partition = this.parsePartitionDirective();
          continue;
        }
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
      partition,
      loc: this.loc(start),
    };
  }

  private parsePartitionDirective(): PartitionSpec {
    const start = this.expect(TokenType.ATAT, "'@@'");
    this.expect(TokenType.IDENT, "'partition'");
    this.expect(TokenType.LBRACE, "'{'");
    const spec = this.parsePartitionSpecBody(start);
    this.expect(TokenType.RBRACE, "'}'");
    return spec;
  }

  private parsePartitionSpecBody(start: Token, depth = 0): PartitionSpec {
    if (depth > 1) {
      throw new ParseError('at most one level of nested @@partition', this.current());
    }

    let by: PartitionStrategy | undefined;
    let fields: string[] | undefined;
    let expression: string | undefined;
    let count: number | undefined;
    const partitions: Partition[] = [];

    while (!this.check(TokenType.RBRACE)) {
      if (
        this.check(TokenType.IDENT) &&
        this.current().value === 'partition' &&
        this.peekType(1) === TokenType.IDENT
      ) {
        partitions.push(this.parsePartitionChild(depth));
        this.match(TokenType.COMMA);
        continue;
      }

      if (this.check(TokenType.ATAT)) {
        throw new ParseError("partition child or key ('by', 'fields', …)", this.current());
      }

      const keyToken = this.expect(TokenType.IDENT, 'partition key');
      this.expect(TokenType.COLON, "':'");

      switch (keyToken.value) {
        case 'by': {
          const value = this.expect(TokenType.IDENT, 'RANGE, LIST, or HASH');
          const strategy = value.value.toUpperCase();
          if (strategy !== 'RANGE' && strategy !== 'LIST' && strategy !== 'HASH') {
            throw new ParseError('RANGE, LIST, or HASH', value);
          }
          by = strategy;
          break;
        }
        case 'fields': {
          const value = this.parseValue();
          if (value.kind !== 'ArrayLiteral') {
            throw new ParseError('array of field names', keyToken);
          }
          fields = value.elements.map((element) => {
            if (element.kind !== 'Identifier') {
              throw new ParseError('field identifier', keyToken);
            }
            return element.name;
          });
          break;
        }
        case 'expression': {
          const value = this.parseValue();
          if (value.kind !== 'StringLiteral') {
            throw new ParseError('string expression', keyToken);
          }
          expression = value.value;
          break;
        }
        case 'count': {
          const value = this.parseValue();
          if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 1) {
            throw new ParseError('positive integer count', keyToken);
          }
          count = value.value;
          break;
        }
        default:
          throw new ParseError("'by', 'fields', 'expression', 'count', or partition", keyToken);
      }

      this.match(TokenType.COMMA);
    }

    if (!by) {
      throw new ParseError("'by: RANGE | LIST | HASH'", this.current());
    }

    return {
      kind: 'PartitionSpec',
      by,
      fields,
      expression,
      count,
      partitions,
      loc: this.loc(start),
    };
  }

  private parsePartitionChild(parentDepth: number): Partition {
    const start = this.expect(TokenType.IDENT, "'partition'");
    if (start.value !== 'partition') {
      throw new ParseError("'partition'", start);
    }
    const nameToken = this.expect(TokenType.IDENT, 'partition name');
    this.expect(TokenType.LBRACE, "'{'");

    let sqlName: string | undefined;
    let from: PartitionBound | undefined;
    let to: PartitionBound | undefined;
    let inValues: Value[] | undefined;
    let isDefault: boolean | undefined;
    let modulus: number | undefined;
    let remainder: number | undefined;
    let nested: PartitionSpec | undefined;

    while (!this.check(TokenType.RBRACE)) {
      if (this.check(TokenType.ATAT)) {
        const atat = this.current();
        if (this.peekType(1) === TokenType.IDENT && this.tokens[this.index + 1]?.value === 'partition') {
          if (nested) {
            throw new ParseError('at most one nested @@partition', atat);
          }
          this.expect(TokenType.ATAT, "'@@'");
          this.expect(TokenType.IDENT, "'partition'");
          this.expect(TokenType.LBRACE, "'{'");
          nested = this.parsePartitionSpecBody(atat, parentDepth + 1);
          this.expect(TokenType.RBRACE, "'}'");
          this.match(TokenType.COMMA);
          continue;
        }
        throw new ParseError("'@@partition'", atat);
      }

      const keyToken = this.expect(TokenType.IDENT, 'partition property');
      this.expect(TokenType.COLON, "':'");

      switch (keyToken.value) {
        case 'name': {
          const value = this.parseValue();
          if (value.kind !== 'StringLiteral') {
            throw new ParseError('string table name', keyToken);
          }
          sqlName = value.value;
          break;
        }
        case 'from':
          from = this.parsePartitionBound();
          break;
        case 'to':
          to = this.parsePartitionBound();
          break;
        case 'in': {
          const value = this.parseValue();
          if (value.kind !== 'ArrayLiteral') {
            throw new ParseError('array of values', keyToken);
          }
          inValues = value.elements;
          break;
        }
        case 'default': {
          const value = this.parseValue();
          if (value.kind !== 'BooleanLiteral') {
            throw new ParseError('boolean', keyToken);
          }
          isDefault = value.value;
          break;
        }
        case 'modulus': {
          const value = this.parseValue();
          if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 1) {
            throw new ParseError('positive integer modulus', keyToken);
          }
          modulus = value.value;
          break;
        }
        case 'remainder': {
          const value = this.parseValue();
          if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 0) {
            throw new ParseError('non-negative integer remainder', keyToken);
          }
          remainder = value.value;
          break;
        }
        default:
          throw new ParseError(
            "'name', 'from', 'to', 'in', 'default', 'modulus', 'remainder', or @@partition",
            keyToken,
          );
      }

      this.match(TokenType.COMMA);
    }

    this.expect(TokenType.RBRACE, "'}'");

    return {
      kind: 'Partition',
      name: nameToken.value,
      sqlName,
      from,
      to,
      in: inValues,
      default: isDefault,
      modulus,
      remainder,
      partition: nested,
      loc: this.loc(start),
    };
  }

  private parsePartitionBound(): PartitionBound {
    return this.parseValue();
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
