/** Raised when AUTH_PEPPER is missing. Pepper must never be stored in the DB. */
export declare class MissingAuthPepperError extends Error {
    constructor(message?: string);
}
/** Raised when the password input is empty, null, undefined, or not a string. */
export declare class InvalidPasswordInputError extends Error {
    constructor(message?: string);
}
