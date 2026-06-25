import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { waitForDatabase } from '../wait-for-database.js';

type MockClient = {
  query: () => Promise<{ rows: Array<{ ok: number }> }>;
  close: () => Promise<void>;
};

function createMockClient(failuresBeforeSuccess: number): {
  client: MockClient;
  attempts: () => number;
} {
  let attempts = 0;

  return {
    client: {
      async query() {
        attempts += 1;

        if (attempts <= failuresBeforeSuccess) {
          throw new Error('connection refused');
        }

        return { rows: [{ ok: 1 }] };
      },
      async close() {},
    },
    attempts: () => attempts,
  };
}

describe('waitForDatabase', () => {
  it('succeeds on first ping', async () => {
    const { client, attempts } = createMockClient(0);

    await waitForDatabase({
      client,
      maxAttempts: 3,
      intervalMs: 1,
      sleep: async () => {},
    });

    assert.equal(attempts(), 1);
  });

  it('retries then succeeds', async () => {
    const { client, attempts } = createMockClient(2);
    const sleepCalls: number[] = [];

    await waitForDatabase({
      client,
      maxAttempts: 5,
      intervalMs: 10,
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    assert.equal(attempts(), 3);
    assert.deepEqual(sleepCalls, [10, 10]);
  });

  it('throws after max attempts', async () => {
    const { client } = createMockClient(Number.POSITIVE_INFINITY);

    await assert.rejects(
      () =>
        waitForDatabase({
          client,
          maxAttempts: 3,
          intervalMs: 1,
          sleep: async () => {},
        }),
      /Database not ready after 3 attempts/,
    );
  });
});
