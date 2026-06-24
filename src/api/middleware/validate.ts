import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';
import type { AppEnv } from '../types.js';

function validationHook(
  result: { success: true; data: unknown } | { success: false; error: { issues: { message: string }[] } },
  c: { json: (body: unknown, status: number) => Response },
) {
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Validation failed';
    return c.json({ error: message }, 400);
  }
}

export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, validationHook);
}

export function validateParam<T extends ZodSchema>(schema: T) {
  return zValidator('param', schema, validationHook);
}

export type ValidationTarget = keyof ValidationTargets;
