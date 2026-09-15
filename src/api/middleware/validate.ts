import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';

const FALLBACK_VALIDATION_MESSAGE = 'Validation failed';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationErrorBody {
  error: string;
  issues: ValidationIssue[];
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.map(String).join('.');
}

function formatIssueSummary(path: string, message: string): string {
  return path ? `${path}: ${message}` : message;
}

export function formatValidationError(
  issues: readonly { path?: PropertyKey[]; message: string }[],
): ValidationErrorBody {
  const mapped = issues.map((issue) => ({
    path: formatIssuePath(issue.path ?? []),
    message: issue.message,
  }));

  const first = mapped[0];
  const error = first ? formatIssueSummary(first.path, first.message) : FALLBACK_VALIDATION_MESSAGE;

  return { error, issues: mapped };
}

function validationHook(
  result:
    | { success: true; data: unknown }
    | { success: false; error: { issues: Array<{ path?: PropertyKey[]; message: string }> } },
  c: { json: (body: unknown, status: number) => Response },
) {
  if (!result.success) {
    return c.json(formatValidationError(result.error.issues), 400);
  }
}

export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, validationHook);
}

export function validateParam<T extends ZodSchema>(schema: T) {
  return zValidator('param', schema, validationHook);
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return zValidator('query', schema, validationHook);
}

export type ValidationTarget = keyof ValidationTargets;
