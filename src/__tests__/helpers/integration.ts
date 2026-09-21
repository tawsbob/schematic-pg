import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import type { User } from '../../../generated/db-types.js';
import { createDbClient } from '../../../generated/db.js';
import type { DbClient } from '../../../generated/db.js';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import { getDatabaseUrl } from '../../db/config.js';

export const TEST_JWT_SECRET = 'integration-test-secret';

export const dockerUnavailableMessage =
  'Database unreachable. Start Docker Postgres with: npm run docker:up';

const schemaPath = join(process.cwd(), 'schema');
const generatedClientPath = join(process.cwd(), 'generated/db.ts');
const generatedAppPath = join(process.cwd(), 'generated/app.ts');

export interface SeededUsers {
  alice: User;
  admin: User;
  bob: User;
  publicUser: User;
}

export interface SeededTeams {
  alpha: { id: string; name: string };
  beta: { id: string; name: string };
  aliceAlphaNote: { id: string; teamId: string; title: string };
  betaNote: { id: string; teamId: string; title: string };
  alphaAnnouncement: { id: string; teamId: string; message: string };
  betaAnnouncement: { id: string; teamId: string; message: string };
}

export async function assertDockerPostgres(): Promise<Pool> {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 3000,
  });

  try {
    await pool.query('SELECT 1');
  } catch {
    await pool.end().catch(() => undefined);
    throw new Error(dockerUnavailableMessage);
  }

  return pool;
}

export function assertGeneratedArtifacts(): void {
  if (!existsSync(generatedClientPath)) {
    throw new Error('Generated client missing. Run: npm run generate:client');
  }

  if (!existsSync(generatedAppPath)) {
    throw new Error('Generated app missing. Run: npm run generate:api');
  }
}

export async function seedUsers(db: DbClient): Promise<SeededUsers> {
  const alice = await db.user.create({
    email: 'a@b.com',
    name: 'Alice',
    balance: 0,
  });

  const admin = await db.user.create({
    email: 'admin@b.com',
    name: 'Admin',
    balance: 100,
    role: 'ADMIN',
  });

  const bob = await db.user.create({
    email: 'bob@b.com',
    name: 'Bob',
    balance: 50,
    isActive: false,
  });

  const publicUser = await db.user.create({
    email: 'public@b.com',
    name: 'Public',
    balance: 0,
    role: 'PUBLIC',
  });

  return { alice, admin, bob, publicUser };
}

export async function seedTeams(db: DbClient, users: SeededUsers): Promise<SeededTeams> {
  const alpha = await db.team.create({ name: 'Alpha' });
  const beta = await db.team.create({ name: 'Beta' });

  await db.teamMember.create({
    teamId: alpha.id,
    userId: users.alice.id,
    isActive: true,
  });

  await db.teamMember.create({
    teamId: beta.id,
    userId: users.bob.id,
    isActive: true,
  });

  const aliceAlphaNote = await db.note.create({
    teamId: alpha.id,
    title: 'Alpha note',
    body: 'Visible to Alpha members',
  });

  const betaNote = await db.note.create({
    teamId: beta.id,
    title: 'Beta note',
    body: 'Visible to Beta members',
  });

  const alphaAnnouncement = await db.announcement.create({
    teamId: alpha.id,
    message: 'Alpha announcement',
  });

  const betaAnnouncement = await db.announcement.create({
    teamId: beta.id,
    message: 'Beta announcement',
  });

  return {
    alpha,
    beta,
    aliceAlphaNote,
    betaNote,
    alphaAnnouncement,
    betaAnnouncement,
  };
}

export async function resetBootstrapAndSeed(pool: Pool): Promise<{
  db: DbClient;
  users: SeededUsers;
  teams: SeededTeams;
}> {
  await bootstrapDatabase(schemaPath, {
    async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
      return fn(pool);
    },
  });

  const db = createDbClient(pool);
  const users = await seedUsers(db);
  const teams = await seedTeams(db, users);

  return { db, users, teams };
}
