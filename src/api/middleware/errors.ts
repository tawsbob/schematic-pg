import type { ErrorHandler } from 'hono';
import {
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from '../../db/errors.js';

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof UniqueConstraintError) {
    return c.json({ error: error.message }, 409);
  }

  if (error instanceof ForeignKeyConstraintError) {
    return c.json({ error: error.message }, 400);
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
