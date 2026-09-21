export declare class DatabaseError extends Error {
    readonly code?: string;
    readonly detail?: string;
    readonly constraint?: string;
    constructor(message: string, options?: {
        code?: string;
        detail?: string;
        constraint?: string;
        cause?: unknown;
    });
}
export declare class UniqueConstraintError extends DatabaseError {
    readonly fields: string[];
    constructor(fields: string[], options?: {
        constraint?: string;
        detail?: string;
        cause?: unknown;
    });
}
export declare class ForeignKeyConstraintError extends DatabaseError {
    readonly field?: string;
    constructor(message: string, options?: {
        field?: string;
        constraint?: string;
        detail?: string;
        cause?: unknown;
    });
}
export declare class NotFoundError extends DatabaseError {
    readonly model: string;
    readonly where: Record<string, unknown>;
    constructor(model: string, where: Record<string, unknown>);
}
/** Thrown when INSERT … SELECT with a policy predicate returns no rows. */
export declare class PolicyInsertDeniedError extends DatabaseError {
    readonly model: string;
    constructor(model: string);
}
export declare function mapPgError(error: unknown, modelName: string, columnToField: Map<string, string>): DatabaseError;
