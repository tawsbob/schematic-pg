export class InvalidCookieConfigError extends Error {
  constructor(message = 'Invalid refresh cookie configuration') {
    super(message);
    this.name = 'InvalidCookieConfigError';
  }
}
