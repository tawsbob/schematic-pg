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

const schemaPath = join(process.cwd(), 'app.schema');
const generatedClientPath = join(process.cwd(), 'generated/db.ts');
const generatedAppPath = join(process.cwd(), 'generated/app.ts');

export interface SeededUsers {
  alice: User;
  admin: User;
  bob: User;
  publicUser: User;
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

export async function resetBootstrapAndSeed(pool: Pool): Promise<{
  db: DbClient;
  users: SeededUsers;
}> {
  await bootstrapDatabase(schemaPath, {
    async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
      return fn(pool);
    },
  });

  const db = createDbClient(pool);
  const users = await seedUsers(db);

  return { db, users };
}
