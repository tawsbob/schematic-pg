export class MissingJwtSecretError extends Error {
    constructor(message = 'JWT_SECRET is not configured') {
        super(message);
        this.name = 'MissingJwtSecretError';
    }
}
export class InvalidTokenTtlError extends Error {
    constructor(message = 'Invalid AUTH_ACCESS_TOKEN_TTL value') {
        super(message);
        this.name = 'InvalidTokenTtlError';
    }
}
