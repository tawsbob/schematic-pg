import { ForbiddenError } from './errors.js';
import type { AuthContext } from './types.js';

const TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;
const POSITIONAL_PARAM_PATTERN = /\$\d+\b/;
const STATEMENT_SEPARATOR = ';';

export interface BoundSqlFragment {
  sql: string;
  params: unknown[];
}

/**
 * Replaces `{{auth.*}}` placeholders with positional `$n` parameters.
 * Auth values are never concatenated into the SQL string.
 */
export function bindAuthTemplate(template: string, auth: AuthContext): BoundSqlFragment {
  const trimmed = template.trim();

  if (trimmed.includes(STATEMENT_SEPARATOR)) {
    throw new ForbiddenError('Policy where clause must not contain statement separators');
  }

  if (POSITIONAL_PARAM_PATTERN.test(trimmed)) {
    throw new ForbiddenError(
      'Policy where clause must not contain positional parameters; use {{auth.*}} placeholders',
    );
  }

  const root = { auth };
  const params: unknown[] = [];

  const sql = trimmed.replace(TEMPLATE_PATTERN, (_, rawPath: string) => {
    const path = rawPath.trim();
    const value = resolveAuthPath(root, path);

    if (value === undefined || value === null) {
      throw new ForbiddenError(`Missing auth context value for "${path}"`);
    }

    params.push(value);
    return `$${params.length}`;
  });

  return { sql, params };
}

/** @deprecated Prefer bindAuthTemplate — kept only if external callers still import it. */
export function interpolateTemplate(template: string, auth: AuthContext): string {
  const root = { auth };

  return template.replace(TEMPLATE_PATTERN, (_, rawPath: string) => {
    const path = rawPath.trim();
    const value = resolveAuthPath(root, path);

    if (value === undefined || value === null) {
      throw new ForbiddenError(`Missing auth context value for "${path}"`);
    }

    return String(value);
  });
}

function resolveAuthPath(root: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
