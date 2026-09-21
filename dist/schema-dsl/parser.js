import { TokenType } from './tokens.js';
export class ParseError extends Error {
    line;
    col;
    file;
    expected;
    found;
    constructor(expected, found, file) {
        const location = file
            ? `${file}:${found.line}:${found.col}`
            : `line ${found.line}, col ${found.col}`;
        super(`Parse error at ${location}: expected ${expected}, found ${found.type} (${found.value || 'EOF'})`);
        this.name = 'ParseError';
        this.line = found.line;
        this.col = found.col;
        this.file = file;
        this.expected = expected;
        this.found = found;
    }
}
export class Parser {
    tokens;
    file;
    index = 0;
    constructor(tokens, file) {
        this.tokens = tokens;
        this.file = file;
    }
    parseSchema() {
        const start = this.current();
        const extensions = this.check(TokenType.EXTENSIONS) ? this.parseExtensionsSection() : [];
        const enums = this.check(TokenType.ENUMS) ? this.parseEnumsSection() : [];
        const predicates = this.check(TokenType.PREDICATES) ? this.parsePredicatesSection() : [];
        const models = this.check(TokenType.MODELS) ? this.parseModelsSection() : [];
        const views = this.check(TokenType.VIEWS) ? this.parseViewsSection() : [];
        const functions = this.check(TokenType.FUNCTIONS) ? this.parseFunctionsSection() : [];
        const jobs = this.check(TokenType.CRON) ? this.parseCronSection() : [];
        if (!this.isAtEnd()) {
            const unexpected = this.current();
            const sectionHint = this.sectionOrderHint(unexpected.type);
            throw new ParseError(sectionHint ?? 'end of schema', unexpected, this.file);
        }
        return {
            kind: 'Schema',
            extensions,
            enums,
            predicates,
            models,
            views,
            functions,
            jobs,
            loc: this.loc(start),
        };
    }
    sectionOrderHint(type) {
        const order = "'extensions', 'enums', 'predicates', 'models', 'views', 'functions', 'cron'";
        switch (type) {
            case TokenType.EXTENSIONS:
                return `sections in order ${order} (extensions must come first)`;
            case TokenType.ENUMS:
                return `sections in order ${order} (enums before predicates/models/views/functions/cron)`;
            case TokenType.PREDICATES:
                return `sections in order ${order} (predicates before models/views/functions/cron)`;
            case TokenType.MODELS:
                return `sections in order ${order} (models before views/functions/cron)`;
            case TokenType.VIEWS:
                return `sections in order ${order} (views before functions/cron)`;
            case TokenType.FUNCTIONS:
                return `sections in order ${order} (functions before cron)`;
            case TokenType.CRON:
                return `sections in order ${order}`;
            default:
                return null;
        }
    }
    parseModel() {
        const start = this.expect(TokenType.MODEL, "'model'");
        const nameToken = this.expect(TokenType.IDENT, 'model name');
        this.expect(TokenType.LBRACE, "'{'");
        const model = this.parseModelBody(nameToken.value);
        this.expect(TokenType.RBRACE, "'}'");
        return {
            ...model,
            loc: this.loc(start),
        };
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
    parsePredicatesSection() {
        this.expect(TokenType.PREDICATES, "'predicates'");
        this.expect(TokenType.LBRACE, "'{'");
        const predicates = [];
        const names = new Set();
        while (!this.check(TokenType.RBRACE)) {
            predicates.push(this.parsePredicate(names));
            this.match(TokenType.COMMA);
        }
        this.expect(TokenType.RBRACE, "'}'");
        return predicates;
    }
    parsePredicate(existingNames) {
        const nameToken = this.expect(TokenType.IDENT, 'predicate name');
        if (existingNames.has(nameToken.value)) {
            throw new ParseError(`unique predicate name, "${nameToken.value}" already defined`, nameToken, this.file);
        }
        existingNames.add(nameToken.value);
        this.expect(TokenType.COLON, "':'");
        const valueToken = this.current();
        const value = this.parseValue();
        if (value.kind !== 'StringLiteral' && value.kind !== 'TripleStringLiteral') {
            throw new ParseError('string or triple-quoted string predicate body', valueToken, this.file);
        }
        const sql = value.value.trim();
        if (sql.length === 0) {
            throw new ParseError('non-empty predicate body', valueToken, this.file);
        }
        return {
            kind: 'Predicate',
            name: nameToken.value,
            sql,
            loc: this.loc(nameToken),
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
    parseViewsSection() {
        this.expect(TokenType.VIEWS, "'views'");
        this.expect(TokenType.LBRACE, "'{'");
        const views = [];
        const names = new Set();
        while (!this.check(TokenType.RBRACE)) {
            views.push(this.parseView(names));
        }
        this.expect(TokenType.RBRACE, "'}'");
        return views;
    }
    parseView(existingNames) {
        const start = this.current();
        let materialized = false;
        if (this.check(TokenType.MATERIALIZED)) {
            this.advance();
            this.expect(TokenType.VIEW, "'view'");
            materialized = true;
        }
        else {
            this.expect(TokenType.VIEW, "'view'");
        }
        const nameToken = this.expect(TokenType.IDENT, 'view name');
        if (existingNames?.has(nameToken.value)) {
            throw new ParseError(`unique view name, "${nameToken.value}" already defined`, nameToken, this.file);
        }
        existingNames?.add(nameToken.value);
        this.expect(TokenType.LBRACE, "'{'");
        const body = this.parseViewBody(nameToken.value, materialized);
        this.expect(TokenType.RBRACE, "'}'");
        return {
            ...body,
            loc: this.loc(start),
        };
    }
    parseViewBody(name, materialized) {
        const columns = [];
        const attributes = [];
        const directives = [];
        let query;
        let queryToken;
        while (!this.check(TokenType.RBRACE)) {
            if (this.check(TokenType.ATAT)) {
                directives.push(this.parseDirective());
                continue;
            }
            if (this.check(TokenType.AT)) {
                attributes.push(this.parseAttributeInternal());
                continue;
            }
            if (this.check(TokenType.IDENT) &&
                this.current().value === 'as' &&
                this.peekType(1) === TokenType.COLON) {
                if (query !== undefined) {
                    throw new ParseError('at most one as query per view', this.current(), this.file);
                }
                queryToken = this.current();
                this.advance();
                this.expect(TokenType.COLON, "':'");
                const valueToken = this.current();
                const value = this.parseValue();
                if (value.kind !== 'StringLiteral' && value.kind !== 'TripleStringLiteral') {
                    throw new ParseError('string or triple-quoted as query', valueToken, this.file);
                }
                query = value.value.trim();
                if (query.length === 0) {
                    throw new ParseError('non-empty as query', valueToken, this.file);
                }
                this.match(TokenType.COMMA);
                continue;
            }
            columns.push(this.parseField());
        }
        if (!query) {
            throw new ParseError("view body key 'as'", queryToken ?? this.current(), this.file);
        }
        return {
            kind: 'View',
            name,
            materialized,
            columns,
            query,
            attributes,
            directives,
            loc: this.loc(this.current()),
        };
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
    parseCronSection() {
        this.expect(TokenType.CRON, "'cron'");
        this.expect(TokenType.LBRACE, "'{'");
        const jobs = [];
        const names = new Set();
        while (!this.check(TokenType.RBRACE)) {
            jobs.push(this.parseCronJob(names));
        }
        this.expect(TokenType.RBRACE, "'}'");
        return jobs;
    }
    parseCronJob(existingNames) {
        const start = this.expect(TokenType.JOB, "'job'");
        const nameToken = this.expect(TokenType.IDENT, 'job name');
        if (existingNames?.has(nameToken.value)) {
            throw new ParseError(`unique job name, "${nameToken.value}" already defined`, nameToken, this.file);
        }
        existingNames?.add(nameToken.value);
        this.expect(TokenType.LBRACE, "'{'");
        const body = this.parseCronJobBody();
        this.expect(TokenType.RBRACE, "'}'");
        return {
            kind: 'CronJob',
            name: nameToken.value,
            schedule: body.schedule,
            execute: body.execute,
            call: body.call,
            loc: this.loc(start),
        };
    }
    parseCronJobBody() {
        if (this.check(TokenType.RBRACE)) {
            throw new ParseError("job body key 'schedule'", this.current(), this.file);
        }
        let schedule;
        let execute;
        let call;
        do {
            const keyToken = this.expect(TokenType.IDENT, 'job body key');
            this.expect(TokenType.COLON, "':'");
            const valueToken = this.current();
            const value = this.parseValue();
            switch (keyToken.value) {
                case 'schedule': {
                    if (value.kind !== 'StringLiteral' && value.kind !== 'TripleStringLiteral') {
                        throw new ParseError('string or triple-quoted schedule', valueToken, this.file);
                    }
                    schedule = value.value.trim();
                    if (schedule.length === 0) {
                        throw new ParseError('non-empty schedule', valueToken, this.file);
                    }
                    break;
                }
                case 'execute': {
                    if (value.kind !== 'StringLiteral' && value.kind !== 'TripleStringLiteral') {
                        throw new ParseError('string or triple-quoted execute body', valueToken, this.file);
                    }
                    execute = value.value.trim();
                    if (execute.length === 0) {
                        throw new ParseError('non-empty execute body', valueToken, this.file);
                    }
                    break;
                }
                case 'call': {
                    if (value.kind !== 'Identifier') {
                        throw new ParseError('function identifier', valueToken, this.file);
                    }
                    call = value.name;
                    break;
                }
                default:
                    throw new ParseError("job body key 'schedule', 'execute', or 'call'", keyToken, this.file);
            }
            this.match(TokenType.COMMA);
        } while (!this.check(TokenType.RBRACE));
        if (!schedule) {
            throw new ParseError("job body key 'schedule'", this.current(), this.file);
        }
        if (execute !== undefined && call !== undefined) {
            throw new ParseError("exactly one of 'execute' or 'call'", this.current(), this.file);
        }
        if (execute === undefined && call === undefined) {
            throw new ParseError("job body key 'execute' or 'call'", this.current(), this.file);
        }
        return { schedule, execute, call };
    }
    parseFunction(existingNames) {
        const start = this.expect(TokenType.FUNCTION, "'function'");
        const nameToken = this.expect(TokenType.IDENT, 'function name');
        if (existingNames?.has(nameToken.value)) {
            throw new ParseError(`unique function name, "${nameToken.value}" already defined`, nameToken, this.file);
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
    parseFunctionReturn(params) {
        const current = this.current();
        if (current.type === TokenType.IDENT &&
            current.value === 'TABLE' &&
            this.peekType(1) === TokenType.LPAREN) {
            return this.parseTableReturn(params);
        }
        if (current.type === TokenType.IDENT && current.value === 'TABLE') {
            throw new ParseError("TABLE column list '(...)'", current, this.file);
        }
        return this.parseTypeExpr();
    }
    parseTableReturn(params) {
        const start = this.expect(TokenType.IDENT, "'TABLE'");
        this.expect(TokenType.LPAREN, "'('");
        if (this.check(TokenType.RPAREN)) {
            throw new ParseError('at least one TABLE column', this.current(), this.file);
        }
        const columns = [];
        const columnNames = new Set();
        const paramNames = new Set(params.map((param) => param.name));
        do {
            const nameToken = this.expect(TokenType.IDENT, 'TABLE column name');
            if (columnNames.has(nameToken.value)) {
                throw new ParseError(`unique TABLE column name, "${nameToken.value}" already defined`, nameToken, this.file);
            }
            if (paramNames.has(nameToken.value)) {
                throw new ParseError(`TABLE column name distinct from parameter "${nameToken.value}"`, nameToken, this.file);
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
            throw new ParseError("function body key 'execute'", this.current(), this.file);
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
                        throw new ParseError("'sql' or 'plpgsql'", valueToken, this.file);
                    }
                    const languageName = value.name.toLowerCase();
                    if (languageName !== 'sql' && languageName !== 'plpgsql') {
                        throw new ParseError("'sql' or 'plpgsql'", valueToken, this.file);
                    }
                    language = languageName;
                    break;
                }
                case 'volatility': {
                    if (value.kind !== 'Identifier') {
                        throw new ParseError("'VOLATILE', 'STABLE', or 'IMMUTABLE'", valueToken, this.file);
                    }
                    const volatilityName = value.name.toUpperCase();
                    if (volatilityName !== 'VOLATILE' &&
                        volatilityName !== 'STABLE' &&
                        volatilityName !== 'IMMUTABLE') {
                        throw new ParseError("'VOLATILE', 'STABLE', or 'IMMUTABLE'", valueToken, this.file);
                    }
                    volatility = volatilityName;
                    break;
                }
                case 'security': {
                    if (value.kind !== 'Identifier') {
                        throw new ParseError("'INVOKER' or 'DEFINER'", valueToken, this.file);
                    }
                    const securityName = value.name.toUpperCase();
                    if (securityName !== 'INVOKER' && securityName !== 'DEFINER') {
                        throw new ParseError("'INVOKER' or 'DEFINER'", valueToken, this.file);
                    }
                    security = securityName;
                    break;
                }
                case 'execute': {
                    if (value.kind !== 'TripleStringLiteral') {
                        throw new ParseError('triple-quoted execute body', valueToken, this.file);
                    }
                    execute = value.value.trim();
                    if (execute.length === 0) {
                        throw new ParseError('non-empty execute body', valueToken, this.file);
                    }
                    break;
                }
                default:
                    throw new ParseError("function body key 'language', 'volatility', 'security', or 'execute'", keyToken, this.file);
            }
            this.match(TokenType.COMMA);
        } while (!this.check(TokenType.RBRACE));
        if (!execute) {
            throw new ParseError("function body key 'execute'", this.current(), this.file);
        }
        return { language, volatility, security, execute };
    }
    parseModelBody(name) {
        const fields = [];
        const attributes = [];
        const directives = [];
        let partition;
        while (!this.check(TokenType.RBRACE)) {
            if (this.check(TokenType.ATAT)) {
                if (this.peekType(1) === TokenType.IDENT && this.tokens[this.index + 1]?.value === 'partition') {
                    if (partition) {
                        throw new ParseError('at most one @@partition per model', this.current(), this.file);
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
            loc: this.loc(this.current()),
        };
    }
    parsePartitionDirective() {
        const start = this.expect(TokenType.ATAT, "'@@'");
        this.expect(TokenType.IDENT, "'partition'");
        this.expect(TokenType.LBRACE, "'{'");
        const spec = this.parsePartitionSpecBody(start);
        this.expect(TokenType.RBRACE, "'}'");
        return spec;
    }
    parsePartitionSpecBody(start, depth = 0) {
        if (depth > 1) {
            throw new ParseError('at most one level of nested @@partition', this.current(), this.file);
        }
        let by;
        let fields;
        let expression;
        let count;
        const partitions = [];
        while (!this.check(TokenType.RBRACE)) {
            if (this.check(TokenType.IDENT) &&
                this.current().value === 'partition' &&
                this.peekType(1) === TokenType.IDENT) {
                partitions.push(this.parsePartitionChild(depth));
                this.match(TokenType.COMMA);
                continue;
            }
            if (this.check(TokenType.ATAT)) {
                throw new ParseError("partition child or key ('by', 'fields', …)", this.current(), this.file);
            }
            const keyToken = this.expect(TokenType.IDENT, 'partition key');
            this.expect(TokenType.COLON, "':'");
            switch (keyToken.value) {
                case 'by': {
                    const value = this.expect(TokenType.IDENT, 'RANGE, LIST, or HASH');
                    const strategy = value.value.toUpperCase();
                    if (strategy !== 'RANGE' && strategy !== 'LIST' && strategy !== 'HASH') {
                        throw new ParseError('RANGE, LIST, or HASH', value, this.file);
                    }
                    by = strategy;
                    break;
                }
                case 'fields': {
                    const value = this.parseValue();
                    if (value.kind !== 'ArrayLiteral') {
                        throw new ParseError('array of field names', keyToken, this.file);
                    }
                    fields = value.elements.map((element) => {
                        if (element.kind !== 'Identifier') {
                            throw new ParseError('field identifier', keyToken, this.file);
                        }
                        return element.name;
                    });
                    break;
                }
                case 'expression': {
                    const value = this.parseValue();
                    if (value.kind !== 'StringLiteral') {
                        throw new ParseError('string expression', keyToken, this.file);
                    }
                    expression = value.value;
                    break;
                }
                case 'count': {
                    const value = this.parseValue();
                    if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 1) {
                        throw new ParseError('positive integer count', keyToken, this.file);
                    }
                    count = value.value;
                    break;
                }
                default:
                    throw new ParseError("'by', 'fields', 'expression', 'count', or partition", keyToken, this.file);
            }
            this.match(TokenType.COMMA);
        }
        if (!by) {
            throw new ParseError("'by: RANGE | LIST | HASH'", this.current(), this.file);
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
    parsePartitionChild(parentDepth) {
        const start = this.expect(TokenType.IDENT, "'partition'");
        if (start.value !== 'partition') {
            throw new ParseError("'partition'", start, this.file);
        }
        const nameToken = this.expect(TokenType.IDENT, 'partition name');
        this.expect(TokenType.LBRACE, "'{'");
        let sqlName;
        let from;
        let to;
        let inValues;
        let isDefault;
        let modulus;
        let remainder;
        let nested;
        while (!this.check(TokenType.RBRACE)) {
            if (this.check(TokenType.ATAT)) {
                const atat = this.current();
                if (this.peekType(1) === TokenType.IDENT && this.tokens[this.index + 1]?.value === 'partition') {
                    if (nested) {
                        throw new ParseError('at most one nested @@partition', atat, this.file);
                    }
                    this.expect(TokenType.ATAT, "'@@'");
                    this.expect(TokenType.IDENT, "'partition'");
                    this.expect(TokenType.LBRACE, "'{'");
                    nested = this.parsePartitionSpecBody(atat, parentDepth + 1);
                    this.expect(TokenType.RBRACE, "'}'");
                    this.match(TokenType.COMMA);
                    continue;
                }
                throw new ParseError("'@@partition'", atat, this.file);
            }
            const keyToken = this.expect(TokenType.IDENT, 'partition property');
            this.expect(TokenType.COLON, "':'");
            switch (keyToken.value) {
                case 'name': {
                    const value = this.parseValue();
                    if (value.kind !== 'StringLiteral') {
                        throw new ParseError('string table name', keyToken, this.file);
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
                        throw new ParseError('array of values', keyToken, this.file);
                    }
                    inValues = value.elements;
                    break;
                }
                case 'default': {
                    const value = this.parseValue();
                    if (value.kind !== 'BooleanLiteral') {
                        throw new ParseError('boolean', keyToken, this.file);
                    }
                    isDefault = value.value;
                    break;
                }
                case 'modulus': {
                    const value = this.parseValue();
                    if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 1) {
                        throw new ParseError('positive integer modulus', keyToken, this.file);
                    }
                    modulus = value.value;
                    break;
                }
                case 'remainder': {
                    const value = this.parseValue();
                    if (value.kind !== 'NumberLiteral' || !Number.isInteger(value.value) || value.value < 0) {
                        throw new ParseError('non-negative integer remainder', keyToken, this.file);
                    }
                    remainder = value.value;
                    break;
                }
                default:
                    throw new ParseError("'name', 'from', 'to', 'in', 'default', 'modulus', 'remainder', or @@partition", keyToken, this.file);
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
    parsePartitionBound() {
        return this.parseValue();
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
                throw new ParseError('value', token, this.file);
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
            file: this.file,
            line: start.line,
            col: start.col,
            endLine: prev.line,
            endCol: prev.col + prev.value.length,
            start: start.start,
            end: prev.end,
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
            throw new ParseError(description, token, this.file);
        }
        this.advance();
        return token;
    }
    isAtEnd() {
        return this.current().type === TokenType.EOF;
    }
    eofToken() {
        const last = this.tokens[this.tokens.length - 1];
        const offset = last?.end ?? 0;
        return {
            type: TokenType.EOF,
            value: '',
            line: last?.line ?? 1,
            col: last?.col ?? 1,
            start: offset,
            end: offset,
        };
    }
}
