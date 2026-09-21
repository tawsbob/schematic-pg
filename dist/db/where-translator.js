const SQL_WHERE_KEY = '$sql';
export class WhereTranslator {
    model;
    scalarFields;
    paramIndex;
    startParamIndex;
    constructor(model, startParamIndex = 1) {
        this.model = model;
        this.scalarFields = new Set(model.fields.map((field) => field.name));
        this.startParamIndex = startParamIndex;
        this.paramIndex = startParamIndex;
    }
    translate(where) {
        this.paramIndex = this.startParamIndex;
        if (!where || Object.keys(where).length === 0) {
            return { sql: '', params: [] };
        }
        const params = [];
        const clauses = [];
        for (const [key, value] of Object.entries(where)) {
            if (key === SQL_WHERE_KEY) {
                clauses.push(this.translateSqlFragment(value, params));
                continue;
            }
            if (key === 'AND') {
                clauses.push(this.translateLogical(value, 'AND', params));
                continue;
            }
            if (key === 'OR') {
                clauses.push(this.translateLogical(value, 'OR', params));
                continue;
            }
            if (key === 'NOT') {
                const nested = this.translateNested(value, params);
                clauses.push(`NOT (${nested})`);
                continue;
            }
            if (!this.scalarFields.has(key)) {
                throw new Error(`Unknown where field "${key}" on model ${this.model.name}`);
            }
            clauses.push(this.translateField(key, value, params));
        }
        return {
            sql: clauses.join(' AND '),
            params,
        };
    }
    getNextParamIndex() {
        return this.paramIndex;
    }
    translateLogical(value, operator, params) {
        if (!Array.isArray(value)) {
            throw new Error(`${operator} expects an array of where clauses`);
        }
        const parts = value.map((entry) => this.translateNested(entry, params));
        return `(${parts.join(` ${operator} `)})`;
    }
    translateNested(where, params) {
        const nestedClauses = [];
        for (const [key, value] of Object.entries(where)) {
            if (key === SQL_WHERE_KEY) {
                nestedClauses.push(this.translateSqlFragment(value, params));
                continue;
            }
            if (key === 'AND') {
                nestedClauses.push(this.translateLogical(value, 'AND', params));
                continue;
            }
            if (key === 'OR') {
                nestedClauses.push(this.translateLogical(value, 'OR', params));
                continue;
            }
            if (key === 'NOT') {
                const nested = this.translateNested(value, params);
                nestedClauses.push(`NOT (${nested})`);
                continue;
            }
            nestedClauses.push(this.translateField(key, value, params));
        }
        return nestedClauses.join(' AND ');
    }
    /**
     * Embeds a developer-authored SQL predicate, renumbering `$n` placeholders
     * to continue from the current parameter index and wrapping in parentheses.
     */
    translateSqlFragment(value, params) {
        const fragment = assertSqlFragment(value);
        const renumbered = renumberPlaceholders(fragment.sql, this.paramIndex);
        this.paramIndex += fragment.params.length;
        params.push(...fragment.params);
        return `(${renumbered})`;
    }
    translateField(fieldName, value, params) {
        const field = this.model.fieldByName.get(fieldName);
        if (!field) {
            throw new Error(`Unknown field "${fieldName}"`);
        }
        const column = field.columnName;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return this.translateOperator(field, column, value, params);
        }
        params.push(value);
        return `${column} = ${this.nextPlaceholder()}`;
    }
    translateOperator(field, column, operators, params) {
        const entries = Object.entries(operators);
        if (entries.length !== 1) {
            throw new Error(`Field "${field.name}" expects a single filter operator`);
        }
        const [operator, rawValue] = entries[0];
        if (operator === 'equals') {
            params.push(rawValue);
            return `${column} = ${this.nextPlaceholder()}`;
        }
        if (operator === 'in') {
            if (!Array.isArray(rawValue) || rawValue.length === 0) {
                throw new Error(`Field "${field.name}" "in" expects a non-empty array`);
            }
            const placeholders = rawValue.map((item) => {
                params.push(item);
                return this.nextPlaceholder();
            });
            return `${column} IN (${placeholders.join(', ')})`;
        }
        if (operator === 'contains' || operator === 'startsWith' || operator === 'endsWith') {
            if (!field.isString) {
                throw new Error(`Operator "${operator}" is only supported on string fields`);
            }
            params.push(wrapLikePattern(String(rawValue), operator));
            return `${column} LIKE ${this.nextPlaceholder()}`;
        }
        if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
            if (!field.isNumeric && !field.isEnum) {
                throw new Error(`Operator "${operator}" is only supported on numeric or enum fields`);
            }
            const sqlOperator = {
                gt: '>',
                gte: '>=',
                lt: '<',
                lte: '<=',
            }[operator];
            params.push(rawValue);
            return `${column} ${sqlOperator} ${this.nextPlaceholder()}`;
        }
        throw new Error(`Unsupported operator "${operator}" for field "${field.name}"`);
    }
    nextPlaceholder() {
        const placeholder = `$${this.paramIndex}`;
        this.paramIndex += 1;
        return placeholder;
    }
}
function assertSqlFragment(value) {
    if (value === null ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        !('sql' in value) ||
        !('params' in value)) {
        throw new Error('$sql expects { sql: string, params: unknown[] }');
    }
    const fragment = value;
    if (typeof fragment.sql !== 'string' || !Array.isArray(fragment.params)) {
        throw new Error('$sql expects { sql: string, params: unknown[] }');
    }
    return { sql: fragment.sql, params: fragment.params };
}
/**
 * Rewrites `$1`, `$2`, … in a fragment so they continue from `startIndex`.
 * Placeholders are remapped by original index (not left-to-right appearance)
 * so repeated `$1` references stay consistent.
 */
export function renumberPlaceholders(sql, startIndex) {
    const indices = new Set();
    for (const match of sql.matchAll(/\$(\d+)\b/g)) {
        indices.add(Number(match[1]));
    }
    if (indices.size === 0) {
        return sql;
    }
    const sorted = [...indices].sort((a, b) => a - b);
    const mapping = new Map();
    for (let i = 0; i < sorted.length; i += 1) {
        mapping.set(sorted[i], startIndex + i);
    }
    return sql.replace(/\$(\d+)\b/g, (_, rawIndex) => {
        const next = mapping.get(Number(rawIndex));
        if (next === undefined) {
            throw new Error(`Missing placeholder mapping for $${rawIndex}`);
        }
        return `$${next}`;
    });
}
function wrapLikePattern(value, operator) {
    if (operator === 'contains') {
        return `%${value}%`;
    }
    if (operator === 'startsWith') {
        return `${value}%`;
    }
    return `%${value}`;
}
