import { ForbiddenError } from '../errors.js';
import { parseCorsOrigin } from '../../middleware/cors.js';

/**
 * Cookie-bearing auth endpoints reject a present Origin that is not in the
 * concrete CORS_ORIGIN allow-list. Missing Origin (curl, same-site tests) is allowed.
 * CORS_ORIGIN=* or unset cannot authorize credentialed cookie calls.
 */
export function assertAllowedAuthOrigin(origin: string | undefined): void {
  if (origin === undefined || origin === '') {
    return;
  }

  const allowed = parseCorsOrigin();
  if (allowed == null || allowed === '*') {
    throw new ForbiddenError('Origin not allowed');
  }

  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(origin)) {
    throw new ForbiddenError('Origin not allowed');
  }
}
