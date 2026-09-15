import { zValidator } from '@hono/zod-validator';
const FALLBACK_VALIDATION_MESSAGE = 'Validation failed';
function formatIssuePath(path) {
    return path.map(String).join('.');
}
function formatIssueSummary(path, message) {
    return path ? `${path}: ${message}` : message;
}
export function formatValidationError(issues) {
    const mapped = issues.map((issue) => ({
        path: formatIssuePath(issue.path ?? []),
        message: issue.message,
    }));
    const first = mapped[0];
    const error = first ? formatIssueSummary(first.path, first.message) : FALLBACK_VALIDATION_MESSAGE;
    return { error, issues: mapped };
}
function validationHook(result, c) {
    if (!result.success) {
        return c.json(formatValidationError(result.error.issues), 400);
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
