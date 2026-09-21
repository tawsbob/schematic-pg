import {
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  PolicyInsertDeniedError,
} from '../../db/errors.js';
import { ForbiddenError, UnauthorizedError } from '../auth/errors.js';
import {
  InvalidPasswordInputError,
  MissingAuthPepperError,
} from '../auth/password/errors.js';
import { InvalidCookieConfigError } from '../auth/refresh/errors.js';
import { InvalidTokenTtlError, MissingJwtSecretError } from '../auth/token/errors.js';
import type { ErrorHandler } from 'hono';

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof UnauthorizedError) {
    return c.json({ error: error.message }, 401);
  }

  if (error instanceof ForbiddenError || error instanceof PolicyInsertDeniedError) {
    return c.json({ error: error.message }, 403);
  }

  if (error instanceof UniqueConstraintError) {
    return c.json({ error: error.message }, 409);
  }

  if (error instanceof ForeignKeyConstraintError) {
    return c.json({ error: error.message }, 400);
  }

  if (error instanceof InvalidPasswordInputError) {
    return c.json({ error: error.message }, 400);
  }

  if (error instanceof InvalidTokenTtlError || error instanceof InvalidCookieConfigError) {
    return c.json({ error: error.message }, 500);
  }

  if (error instanceof MissingAuthPepperError || error instanceof MissingJwtSecretError) {
    return c.json({ error: error.message }, 500);
  }

  if (error instanceof DatabaseError) {
    return c.json({ error: error.message }, 500);
  }

  if (error instanceof Error && error.message.includes('returned no rows')) {
    return c.json({ error: 'Not found' }, 404);
  }

  console.error(error);
  return c.json({ error: 'Internal server error' }, 500);
};

export function notFoundResponse(c: { json: (body: unknown, status: number) => Response }) {
  return c.json({ error: 'Not found' }, 404);
}
