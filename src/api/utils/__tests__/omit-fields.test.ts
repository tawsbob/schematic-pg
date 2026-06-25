import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { omitFields, omitFieldsMany } from '../omit-fields.js';

describe('omitFields', () => {
  it('removes listed keys from a row', () => {
    const row = { id: '1', email: 'a@b.com', passwordHash: 'secret' };
    const result = omitFields(row, ['passwordHash']);

    assert.deepEqual(result, { id: '1', email: 'a@b.com' });
    assert.equal('passwordHash' in result, false);
  });

  it('returns the same object reference when omit list is empty', () => {
    const row = { id: '1', email: 'a@b.com' };
    const result = omitFields(row, []);

    assert.equal(result, row);
  });

  it('does not mutate the original row', () => {
    const row = { id: '1', passwordHash: 'secret' };
    omitFields(row, ['passwordHash']);

    assert.equal(row.passwordHash, 'secret');
  });
});

describe('omitFieldsMany', () => {
  it('omits keys from every row', () => {
    const rows = [
      { id: '1', passwordHash: 'a' },
      { id: '2', passwordHash: 'b' },
    ];

    const result = omitFieldsMany(rows, ['passwordHash']);

    assert.deepEqual(result, [{ id: '1' }, { id: '2' }]);
  });
});
