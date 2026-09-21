export class DatabaseError extends Error {
    code;
    detail;
    constraint;
    constructor(message, options) {
        super(message, { cause: options?.cause });
        this.name = 'DatabaseError';
        this.code = options?.code;
        this.detail = options?.detail;
        this.constraint = options?.constraint;
    }
}
export class UniqueConstraintError extends DatabaseError {
    fields;
    constructor(fields, options) {
        super(`Unique constraint violation on ${fields.join(', ')}`, {
            code: '23505',
            constraint: options?.constraint,
            detail: options?.detail,
            cause: options?.cause,
        });
        this.name = 'UniqueConstraintError';
        this.fields = fields;
    }
}
export class ForeignKeyConstraintError extends DatabaseError {
    field;
    constructor(message, options) {
        super(message, {
            code: '23503',
            constraint: options?.constraint,
            detail: options?.detail,
            cause: options?.cause,
        });
        this.name = 'ForeignKeyConstraintError';
        this.field = options?.field;
    }
}
export class NotFoundError extends DatabaseError {
    model;
    where;
    constructor(model, where) {
        super(`Record not found in ${model}`);
        this.name = 'NotFoundError';
        this.model = model;
        this.where = where;
    }
}
/** Thrown when INSERT … SELECT with a policy predicate returns no rows. */
export class PolicyInsertDeniedError extends DatabaseError {
    model;
    constructor(model) {
        super(`Insert denied by policy for model ${model}`);
        this.name = 'PolicyInsertDeniedError';
        this.model = model;
    }
}
export function mapPgError(error, modelName, columnToField) {
    if (!(error && typeof error === 'object' && 'code' in error)) {
        return new DatabaseError(error instanceof Error ? error.message : String(error), { cause: error });
    }
    const pgError = error;
    if (pgError.code === '23505') {
        const fields = extractConstraintFields(pgError.detail, columnToField);
        return new UniqueConstraintError(fields, {
            constraint: pgError.constraint,
            detail: pgError.detail,
            cause: error,
        });
    }
    if (pgError.code === '23503') {
        return new ForeignKeyConstraintError(pgError.message ?? 'Foreign key constraint violation', {
            constraint: pgError.constraint,
            detail: pgError.detail,
            cause: error,
        });
    }
    return new DatabaseError(pgError.message ?? 'Database error', {
        code: pgError.code,
        detail: pgError.detail,
        constraint: pgError.constraint,
        cause: error,
    });
}
function extractConstraintFields(detail, columnToField) {
    if (!detail) {
        return [];
    }
    const match = detail.match(/\(([^)]+)\)=\(/);
    if (!match) {
        return [];
    }
    return match[1]
        .split(',')
        .map((column) => column.trim())
        .map((column) => columnToField.get(column) ?? column);
}
