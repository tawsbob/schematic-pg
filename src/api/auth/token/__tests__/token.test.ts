import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { UnauthorizedError } from '../../errors.js';
import { signHs256Jwt, verifyHs256Jwt } from '../../jwt-crypto.js';
import { createTokenService } from '../index.js';

const TEST_SECRET = 'token-unit-secret';

describe('createTokenService', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousTtl = process.env.AUTH_ACCESS_TOKEN_TTL;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_ACCESS_TOKEN_TTL;
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }

    if (previousTtl === undefined) {
      delete process.env.AUTH_ACCESS_TOKEN_TTL;
    } else {
      process.env.AUTH_ACCESS_TOKEN_TTL = previousTtl;
    }
  });

  it('round-trips signAccessToken → verifyAccessToken', () => {
    const tokens = createTokenService();
    const jwt = tokens.signAccessToken({ userId: 'user-1', role: 'USER' });
    const payload = tokens.verifyAccessToken(jwt);

    assert.equal(payload.sub, 'user-1');
    assert.equal(payload.role, 'USER');
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
  });

  it('rejects tampered tokens', () => {
    const tokens = createTokenService();
    const jwt = tokens.signAccessToken({ userId: 'user-1', role: 'USER' });

    assert.throws(() => tokens.verifyAccessToken(`${jwt}x`), UnauthorizedError);
  });

  it('rejects expired tokens', () => {
    const tokens = createTokenService({ ttlSeconds: 1 });
    const jwt = tokens.signAccessToken({ userId: 'user-1', role: 'USER' });
    const payload = tokens.verifyAccessToken(jwt);
    const expired = signHs256Jwt(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 10 },
      TEST_SECRET,
    );

    assert.throws(() => tokens.verifyAccessToken(expired), /expired/i);
  });

  it('rejects wrong secret', () => {
    const tokens = createTokenService();
    const jwt = tokens.signAccessToken({ userId: 'user-1', role: 'USER' });
    const other = createTokenService({ secret: 'other-secret' });

    assert.throws(() => other.verifyAccessToken(jwt), UnauthorizedError);
  });
});

describe('verifyHs256Jwt time claims', () => {
  it('accepts tokens without exp/nbf (backward compatible)', () => {
    const token = signHs256Jwt({ sub: 'u1', role: 'USER' }, TEST_SECRET);
    const payload = verifyHs256Jwt(token, TEST_SECRET);
    assert.equal(payload.sub, 'u1');
  });

  it('rejects nbf in the future', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256Jwt({ sub: 'u1', role: 'USER', nbf: now + 60 }, TEST_SECRET);

    assert.throws(() => verifyHs256Jwt(token, TEST_SECRET, now), /not yet valid/i);
  });
});
