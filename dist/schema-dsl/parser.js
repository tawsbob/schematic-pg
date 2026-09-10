import { TokenType } from './tokens.js';
export class ParseError extends Error {
    line;
    col;
    expected;
    found;
    constructor(expected, found) {
        super(`Parse error at line ${found.line}, col ${found.col}: expected ${expected}, found ${found.type} (${found.value || 'EOF'})`);
        this.name = 'ParseError';
        this.line = found.line;
        this.col = found.col;
        this.expected = expected;
        this.found = found;
    }
}
export class Parser {
    tokens;
    index = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parseSchema() {
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
    parseModel() {
        this.expect(TokenType.MODEL, "'model'");
        const nameToken = this.expect(TokenType.IDENT, 'model name');
        this.expect(TokenType.LBRACE, "'{'");
        const model = this.parseModelBody(nameToken.value, nameToken);
        this.expect(TokenType.RBRACE, "'}'");
        return model;
    }
    parseField() {
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
    parseAttribute() {
        return this.parseAttributeInternal();
    }
    parseExtensionsSection() {
        this.expect(TokenType.EXTENSIONS, "'extensions'");
        this.expect(TokenType.LBRACE, "'{'");
        const extensions = [];
        while (!this.check(TokenType.RBRACE)) {
            extensions.push(this.parseExtension());
        }
        this.expect(TokenType.RBRACE, "'}'");
        return extensions;
    }
    parseExtension() {
        const start = this.expect(TokenType.IDENT, 'extension name');
        let options;
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
    parseEnumsSection() {
        this.expect(TokenType.ENUMS, "'enums'");
        this.expect(TokenType.LBRACE, "'{'");
        const enums = [];
        while (!this.check(TokenType.RBRACE)) {
            enums.push(this.parseEnum());
        }
        this.expect(TokenType.RBRACE, "'}'");
        return enums;
    }
    parseEnum() {
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
    parseModelsSection() {
        this.expect(TokenType.MODELS, "'models'");
        this.expect(TokenType.LBRACE, "'{'");
        const models = [];
        while (!this.check(TokenType.RBRACE)) {
            models.push(this.parseModel());
        }
        this.expect(TokenType.RBRACE, "'}'");
        return models;
    }
    parseFunctionsSection() {
        this.expect(TokenType.FUNCTIONS, "'functions'");
        this.expect(TokenType.LBRACE, "'{'");
        const functions = [];
        const names = new Set();
        while (!this.check(TokenType.RBRACE)) {
            functions.push(this.parseFunction(names));
        }
        this.expect(TokenType.RBRACE, "'}'");
        return functions;
    }
    parseFunction(existingNames) {
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
        const returns = this.parseTypeExpr();
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
    parseFunctionParams() {
        if (this.check(TokenType.RPAREN)) {
            return [];
        }
        const params = [];
        do {
            params.push(this.parseFunctionParam());
        } while (this.match(TokenType.COMMA) && !this.check(TokenType.RPAREN));
        this.consumeTrailingComma();
        return params;
    }
    parseFunctionParam() {
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
    parseFunctionBody() {
        if (this.check(TokenType.RBRACE)) {
            throw new ParseError("function body key 'execute'", this.current());
        }
        let language;
        let volatility;
        let security;
        let execute;
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
                    if (volatilityName !== 'VOLATILE' &&
                        volatilityName !== 'STABLE' &&
                        volatilityName !== 'IMMUTABLE') {
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
                    throw new ParseError("function body key 'language', 'volatility', 'security', or 'execute'", keyToken);
            }
            this.match(TokenType.COMMA);
        } while (!this.check(TokenType.RBRACE));
        if (!execute) {
            throw new ParseError("function body key 'execute'", this.current());
        }
        return { language, volatility, security, execute };
    }
    parseModelBody(name, start) {
        const fields = [];
        const attributes = [];
        const directives = [];
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
    parseTypeExpr() {
        const start = this.expect(TokenType.IDENT, 'type name');
        let args;
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
        }
        else if (this.check(TokenType.LBRACKET) && this.peekType(1) === TokenType.RBRACKET) {
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
    parseFieldAttributes(typeLine) {
        const attributes = [];
        while (this.check(TokenType.AT) &&
            this.peekType(1) !== TokenType.AT &&
            this.current().line === typeLine) {
            attributes.push(this.parseAttributeInternal());
        }
        return attributes;
    }
    parseAttributeInternal() {
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
    parseDirective() {
        const start = this.expect(TokenType.ATAT, "'@@'");
        const nameToken = this.expect(TokenType.IDENT, 'directive name');
        let args;
        if (this.check(TokenType.LBRACE)) {
            args = {
                kind: 'KeyValueArgs',
                pairs: this.parseBlockLiteral().pairs,
            };
        }
        else if (this.check(TokenType.LPAREN)) {
            args = this.parseAttributeArgs();
        }
        return {
            kind: 'Directive',
            name: nameToken.value,
            args,
            loc: this.loc(start),
        };
    }
    parseAttributeArgs() {
        this.expect(TokenType.LPAREN, "'('");
        if (this.check(TokenType.RPAREN)) {
            this.advance();
            return { kind: 'ExpressionArgs', expressions: [] };
        }
        const args = this.isKeyValueListStart()
            ? { kind: 'KeyValueArgs', pairs: this.parseKeyValueList() }
            : { kind: 'ExpressionArgs', expressions: this.parseValueList() };
        this.expect(TokenType.RPAREN, "')'");
        return args;
    }
    parseValue() {
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
    parseIdentOrCall() {
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
    parseArrayLiteral() {
        this.expect(TokenType.LBRACKET, "'['");
        const elements = this.check(TokenType.RBRACKET) ? [] : this.parseValueList();
        this.expect(TokenType.RBRACKET, "']'");
        return { kind: 'ArrayLiteral', elements };
    }
    parseBlockLiteral() {
        this.expect(TokenType.LBRACE, "'{'");
        const pairs = this.check(TokenType.RBRACE) ? [] : this.parseKeyValueList();
        this.expect(TokenType.RBRACE, "'}'");
        return { kind: 'BlockLiteral', pairs };
    }
    parseKeyValueList() {
        const pairs = [];
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
    parseValueList() {
        const values = [];
        do {
            values.push(this.parseValue());
        } while (this.match(TokenType.COMMA) && !this.isListEnd());
        this.consumeTrailingComma();
        return values;
    }
    parseIdentList() {
        const values = [];
        do {
            values.push(this.expect(TokenType.IDENT, 'identifier').value);
        } while (this.match(TokenType.COMMA) && !this.check(TokenType.RBRACE));
        this.consumeTrailingComma();
        return values;
    }
    isKeyValueListStart() {
        if (!this.check(TokenType.IDENT)) {
            return false;
        }
        return this.peekType(1) === TokenType.COLON;
    }
    isListEnd() {
        return (this.check(TokenType.RPAREN) ||
            this.check(TokenType.RBRACE) ||
            this.check(TokenType.RBRACKET));
    }
    consumeTrailingComma() {
        if (this.isListEnd() && this.previous().type === TokenType.COMMA) {
            // Trailing comma already consumed by match(); nothing else to do.
        }
    }
    loc(start) {
        const prev = this.previous();
        return {
            line: start.line,
            col: start.col,
            endLine: prev.line,
            endCol: prev.col + prev.value.length,
        };
    }
    current() {
        return this.tokens[this.index] ?? this.eofToken();
    }
    previous() {
        return this.tokens[this.index - 1] ?? this.eofToken();
    }
    advance() {
        if (!this.isAtEnd()) {
            this.index += 1;
        }
        return this.previous();
    }
    match(type) {
        if (!this.check(type)) {
            return false;
        }
        this.advance();
        return true;
    }
    check(type) {
        return this.current().type === type;
    }
    peekType(offset) {
        return this.tokens[this.index + offset]?.type ?? TokenType.EOF;
    }
    expect(type, description) {
        const token = this.current();
        if (token.type !== type) {
            throw new ParseError(description, token);
        }
        this.advance();
        return token;
    }
    isAtEnd() {
        return this.current().type === TokenType.EOF;
    }
    eofToken() {
        const last = this.tokens[this.tokens.length - 1];
        return {
            type: TokenType.EOF,
            value: '',
            line: last?.line ?? 1,
            col: last?.col ?? 1,
        };
    }
}
