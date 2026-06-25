import { zValidator } from '@hono/zod-validator';
function validationHook(result, c) {
    if (!result.success) {
        const message = result.error.issues[0]?.message ?? 'Validation failed';
        return c.json({ error: message }, 400);
    }
}
export function validateJson(schema) {
    return zValidator('json', schema, validationHook);
}
export function validateParam(schema) {
    return zValidator('param', schema, validationHook);
}
export function validateQuery(schema) {
    return zValidator('query', schema, validationHook);
}
