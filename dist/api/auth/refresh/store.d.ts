import { type RefreshConfig } from './config.js';
export type RefreshRawOps = {
    $executeRaw(sql: string, params?: unknown[]): Promise<number>;
    $queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};
export type RefreshDb = RefreshRawOps & {
    $transaction<T>(fn: (tx: RefreshRawOps) => Promise<T>): Promise<T>;
};
export interface IssuedRefreshSession {
    rawToken: string;
    expiresAt: Date;
    familyId: string;
    userId: string;
}
export interface RefreshSessionStore {
    ensureSchema(): Promise<void>;
    createSession(userId: string): Promise<IssuedRefreshSession>;
    rotateSession(rawToken: string): Promise<IssuedRefreshSession>;
    revokeFamilyByToken(rawToken: string): Promise<void>;
}
export declare function createRefreshSessionStore(db: RefreshDb, overrides?: Partial<RefreshConfig>): RefreshSessionStore;
