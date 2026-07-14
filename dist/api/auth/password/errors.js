/** Raised when AUTH_PEPPER is missing. Pepper must never be stored in the DB. */
export class MissingAuthPepperError extends Error {
    constructor(message = 'AUTH_PEPPER is not configured') {
        super(message);
        this.name = 'MissingAuthPepperError';
    }
}
/** Raised when the password input is empty, null, undefined, or not a string. */
export class InvalidPasswordInputError extends Error {
    constructor(message = 'Password must be a non-empty string') {
        super(message);
        this.name = 'InvalidPasswordInputError';
    }
}
