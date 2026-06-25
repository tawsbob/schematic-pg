import { DatabaseClient } from '../db/client.js';

export type WaitForDatabaseOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  client?: Pick<DatabaseClient, 'query'>;
  sleep?: (ms: number) => Promise<void>;
};

export async function pingDatabase(
  client: Pick<DatabaseClient, 'query'>,
): Promise<void> {
  const result = await client.query<{ ok: number }>('SELECT 1 AS ok');
  const ok = result.rows[0]?.ok;

  if (ok !== 1) {
    throw new Error(`Unexpected ping result: ${String(ok)}`);
  }
}

export async function waitForDatabase(options: WaitForDatabaseOptions = {}): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 30;
  const intervalMs = options.intervalMs ?? 1000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const ownClient = options.client ? null : new DatabaseClient();
  const client = options.client ?? ownClient!;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pingDatabase(client);

        if (attempt > 1) {
          process.stderr.write(`Database ready (attempt ${attempt}/${maxAttempts})\n`);
        }

        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Database not ready after ${maxAttempts} attempts (${intervalMs}ms interval): ${message}`,
          );
        }

        process.stderr.write(`Waiting for database (${attempt}/${maxAttempts})...\n`);
        await sleep(intervalMs);
      }
    }
  } finally {
    if (ownClient) {
      await ownClient.close();
    }
  }
}
