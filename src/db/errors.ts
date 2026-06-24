export class DatabaseError extends Error {
  readonly code?: string;
  readonly detail?: string;
  readonly constraint?: string;

  constructor(message: string, options?: { code?: string; detail?: string; constraint?: string; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'DatabaseError';
    this.code = options?.code;
    this.detail = options?.detail;
    this.constraint = options?.constraint;
  }
}

export class UniqueConstraintError extends DatabaseError {
  readonly fields: string[];

  constructor(fields: string[], options?: { constraint?: string; detail?: string; cause?: unknown }) {
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
  readonly field?: string;

  constructor(message: string, options?: { field?: string; constraint?: string; detail?: string; cause?: unknown }) {
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
  readonly model: string;
  readonly where: Record<string, unknown>;

  constructor(model: string, where: Record<string, unknown>) {
    super(`Record not found in ${model}`);
    this.name = 'NotFoundError';
    this.model = model;
    this.where = where;
  }
}

interface PgErrorLike {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
}

export function mapPgError(error: unknown, modelName: string, columnToField: Map<string, string>): DatabaseError {
  if (!(error && typeof error === 'object' && 'code' in error)) {
    return new DatabaseError(error instanceof Error ? error.message : String(error), { cause: error });
  }

  const pgError = error as PgErrorLike;

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

function extractConstraintFields(detail: string | undefined, columnToField: Map<string, string>): string[] {
  if (!detail) {
    return [];
  }

  const match = detail.match(/\(([^)]+)\)=\(/);
  if (!match) {
    return [];
  }

  return match[1]!
    .split(',')
    .map((column) => column.trim())
    .map((column) => columnToField.get(column) ?? column);
}
