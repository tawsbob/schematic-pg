import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../errors.js';
import {
  resolveRefreshConfig,
  type RefreshConfig,
} from './config.js';
import { generateRefreshToken, hashRefreshToken } from './token.js';

export type RefreshRawOps = {
  $executeRaw(sql: string, params?: unknown[]): Promise<number>;
  $queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
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

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS auth_refresh_session (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
`;

const CREATE_FAMILY_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS auth_refresh_session_family_id_idx
  ON auth_refresh_session (family_id)
`;

const INVALID_REFRESH_MESSAGE = 'Invalid refresh token';

type SessionRow = {
  user_id: string;
  family_id: string;
  revoked_at: Date | string | null;
  expires_at: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

async function insertSession(
  ops: RefreshRawOps,
  userId: string,
  familyId: string,
  ttlSeconds: number,
): Promise<IssuedRefreshSession> {
  const rawToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawToken);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await ops.$executeRaw(
    `INSERT INTO auth_refresh_session
      (id, user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, familyId, expiresAt.toISOString()],
  );

  return { rawToken, expiresAt, familyId, userId };
}

async function revokeFamily(ops: RefreshRawOps, familyId: string): Promise<void> {
  await ops.$executeRaw(
    `UPDATE auth_refresh_session
     SET revoked_at = now()
     WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId],
  );
}

export function createRefreshSessionStore(
  db: RefreshDb,
  overrides: Partial<RefreshConfig> = {},
): RefreshSessionStore {
  const config = resolveRefreshConfig(overrides);

  async function ensureSchema(): Promise<void> {
    // Always idempotent — survives db:bootstrap (DROP SCHEMA public CASCADE).
    await db.$executeRaw(CREATE_TABLE_SQL);
    await db.$executeRaw(CREATE_FAMILY_INDEX_SQL);
  }

  return {
    ensureSchema,

    async createSession(userId: string): Promise<IssuedRefreshSession> {
      await ensureSchema();
      const familyId = randomUUID();
      return insertSession(db, userId, familyId, config.ttlSeconds);
    },

    async rotateSession(rawToken: string): Promise<IssuedRefreshSession> {
      await ensureSchema();
      const tokenHash = hashRefreshToken(rawToken);

      type RotateOutcome =
        | { status: 'rotated'; session: IssuedRefreshSession }
        | { status: 'invalid'; revokeFamilyId?: string };

      const outcome = await db.$transaction(async (tx): Promise<RotateOutcome> => {
        const rotated = await tx.$queryRaw<{ user_id: string; family_id: string }>(
          `UPDATE auth_refresh_session
           SET revoked_at = now()
           WHERE token_hash = $1
             AND revoked_at IS NULL
             AND expires_at > now()
           RETURNING user_id, family_id`,
          [tokenHash],
        );

        const active = rotated[0];
        if (active) {
          const session = await insertSession(
            tx,
            active.user_id,
            active.family_id,
            config.ttlSeconds,
          );
          return { status: 'rotated', session };
        }

        const existing = await tx.$queryRaw<SessionRow>(
          `SELECT user_id, family_id, revoked_at, expires_at
           FROM auth_refresh_session
           WHERE token_hash = $1
           LIMIT 1`,
          [tokenHash],
        );

        const row = existing[0];
        if (!row) {
          return { status: 'invalid' };
        }

        const expiresAt = toDate(row.expires_at);
        if (expiresAt.getTime() <= Date.now()) {
          return { status: 'invalid' };
        }

        if (row.revoked_at != null) {
          const revokedAt = toDate(row.revoked_at);
          const ageSeconds = Math.max(0, (Date.now() - revokedAt.getTime()) / 1000);
          if (ageSeconds >= config.reuseGraceSeconds) {
            // Revoke inside the transaction so it commits; throw after.
            await revokeFamily(tx, row.family_id);
            return { status: 'invalid' };
          }
          return { status: 'invalid' };
        }

        return { status: 'invalid' };
      });

      if (outcome.status === 'rotated') {
        return outcome.session;
      }

      throw new UnauthorizedError(INVALID_REFRESH_MESSAGE);
    },

    async revokeFamilyByToken(rawToken: string): Promise<void> {
      await ensureSchema();
      const tokenHash = hashRefreshToken(rawToken);
      const rows = await db.$queryRaw<{ family_id: string }>(
        `SELECT family_id FROM auth_refresh_session WHERE token_hash = $1 LIMIT 1`,
        [tokenHash],
      );
      const familyId = rows[0]?.family_id;
      if (!familyId) {
        return;
      }
      await revokeFamily(db, familyId);
    },
  };
}
