/**
 * Cookie-bearing auth endpoints reject a present Origin that is not in the
 * concrete CORS_ORIGIN allow-list. Missing Origin (curl, same-site tests) is allowed.
 * CORS_ORIGIN=* or unset cannot authorize credentialed cookie calls.
 */
export declare function assertAllowedAuthOrigin(origin: string | undefined): void;
