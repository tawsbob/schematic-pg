import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { argon2id } from 'argon2';
import {
  ARGON2_VERSION,
  createPasswordService,
  InvalidPasswordInputError,
  MissingAuthPepperError,
} from '../index.js';

const TEST_PEPPER = 'unit-test-pepper';

describe('passwordService', () => {
  const previousPepper = process.env.AUTH_PEPPER;

  beforeEach(() => {
    process.env.AUTH_PEPPER = TEST_PEPPER;
  });

  afterEach(() => {
    if (previousPepper === undefined) {
      delete process.env.AUTH_PEPPER;
    } else {
      process.env.AUTH_PEPPER = previousPepper;
    }
  });

  it('hashPassword returns encoded argon2id digest, not plaintext', async () => {
    const service = createPasswordService();
    const password = 'correct-horse-battery';
    const digest = await service.hashPassword(password);

    assert.notEqual(digest, password);
    assert.match(digest, /^\$argon2id\$/);
  });

  it('verifyPassword returns true for matching password', async () => {
    const service = createPasswordService();
    const password = 'secret-password';
    const digest = await service.hashPassword(password);

    assert.equal(await service.verifyPassword(password, digest), true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const service = createPasswordService();
    const digest = await service.hashPassword('secret-password');

    assert.equal(await service.verifyPassword('wrong-password', digest), false);
  });

  it('verify fails when pepper differs from hash-time pepper', async () => {
    const service = createPasswordService();
    const digest = await service.hashPassword('secret-password');

    process.env.AUTH_PEPPER = 'different-pepper';
    assert.equal(await service.verifyPassword('secret-password', digest), false);
  });

  it('needsRehash is false for current params and true when params change', async () => {
    const service = createPasswordService();
    const digest = await service.hashPassword('secret-password');
    assert.equal(service.needsRehash(digest), false);

    const stricter = createPasswordService({
      memoryCost: 65_536,
      timeCost: 4,
      parallelism: 1,
      type: argon2id,
      version: ARGON2_VERSION,
    });
    assert.equal(stricter.needsRehash(digest), true);
  });

  it('rejects missing pepper', async () => {
    delete process.env.AUTH_PEPPER;
    const service = createPasswordService();

    await assert.rejects(() => service.hashPassword('secret'), MissingAuthPepperError);
  });

  it('rejects empty, null, undefined, and non-string passwords', async () => {
    const service = createPasswordService();

    await assert.rejects(() => service.hashPassword(''), InvalidPasswordInputError);
    await assert.rejects(
      () => service.hashPassword(undefined as unknown as string),
      InvalidPasswordInputError,
    );
    await assert.rejects(
      () => service.hashPassword(null as unknown as string),
      InvalidPasswordInputError,
    );
    await assert.rejects(
      () => service.hashPassword(123 as unknown as string),
      InvalidPasswordInputError,
    );
  });
});
