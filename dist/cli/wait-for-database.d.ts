import { DatabaseClient } from '../db/client.js';
export type WaitForDatabaseOptions = {
    maxAttempts?: number;
    intervalMs?: number;
    client?: Pick<DatabaseClient, 'query'>;
    sleep?: (ms: number) => Promise<void>;
};
export declare function pingDatabase(client: Pick<DatabaseClient, 'query'>): Promise<void>;
export declare function waitForDatabase(options?: WaitForDatabaseOptions): Promise<void>;
