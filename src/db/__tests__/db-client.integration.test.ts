import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Pool, type PoolClient } from 'pg';
import type { User } from '../../../generated/db-types.js';
import { createDbClient } from '../../../generated/db.js';
import { bootstrapDatabase } from '../bootstrap.js';
import { getDatabaseUrl } from '../config.js';
import { ForeignKeyConstraintError, UniqueConstraintError } from '../errors.js';
import { resetPublicSchema } from '../reset-database.js';

const schemaPath = join(process.cwd(), 'app.schema');
const generatedClientPath = join(process.cwd(), 'generated/db.ts');
const dockerUnavailableMessage =
  'Database unreachable. Start Docker Postgres with: npm run docker:up';

interface SeededUsers {
  alice: User;
  admin: User;
  bob: User;
  publicUser: User;
}

async function seedUsers(db: ReturnType<typeof createDbClient>): Promise<SeededUsers> {
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

describe('db client integration (Docker)', { concurrency: 1 }, () => {
  let pool: Pool;
  let db: ReturnType<typeof createDbClient>;
  let users: SeededUsers;

  before(async () => {
    assert.ok(
      existsSync(generatedClientPath),
      'Generated client missing. Run: npm run generate:client',
    );

    pool = new Pool({
      connectionString: getDatabaseUrl(),
      connectionTimeoutMillis: 3000,
    });

    try {
      await pool.query('SELECT 1');
    } catch {
      await pool.end().catch(() => undefined);
      throw new Error(dockerUnavailableMessage);
    }

    await resetPublicSchema(pool);
    await bootstrapDatabase(schemaPath, {
      async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
        return fn(pool);
      },
    });

    db = createDbClient(pool);
    users = await seedUsers(db);
  });

  after(async () => {
    await pool.end();
  });

  describe('create', () => {
    it('seeds users with expected defaults', () => {
      assert.match(users.alice.id, /^[0-9a-f-]{36}$/i);
      assert.equal(users.alice.email, 'a@b.com');
      assert.equal(users.alice.name, 'Alice');
      assert.equal(users.alice.role, 'USER');
      assert.equal(users.alice.isActive, true);
      assert.ok(users.alice.createdAt instanceof Date);

      assert.equal(users.admin.role, 'ADMIN');
      assert.equal(users.admin.balance, 100);
      assert.equal(users.bob.isActive, false);
      assert.equal(users.publicUser.role, 'PUBLIC');
    });
  });

  describe('read operations', () => {
    it('findUnique by id', async () => {
      const found = await db.user.findUnique({ id: users.alice.id });
      assert.ok(found);
      assert.equal(found.id, users.alice.id);
      assert.equal(found.name, 'Alice');
    });

    it('findUnique by unique email', async () => {
      const found = await db.user.findUnique({ email: 'a@b.com' });
      assert.ok(found);
      assert.equal(found.id, users.alice.id);
    });

    it('findFirst with where and orderBy', async () => {
      const found = await db.user.findFirst({
        where: { role: 'USER', isActive: true },
        orderBy: { name: 'asc' },
      });

      assert.ok(found);
      assert.equal(found.id, users.alice.id);
      assert.equal(found.name, 'Alice');
    });

    it('findMany with skip and take', async () => {
      const page = await db.user.findMany({
        orderBy: { createdAt: 'asc' },
        skip: 1,
        take: 2,
      });

      assert.equal(page.length, 2);
    });

    it('findMany with array orderBy', async () => {
      const rows = await db.user.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      });

      assert.equal(rows.length, 4);
      assert.ok(rows.every((row) => row.createdAt instanceof Date));
    });

    it('findMany with string filter operators', async () => {
      const byContains = await db.user.findMany({
        where: { email: { contains: '@' } },
      });
      assert.equal(byContains.length, 4);

      const byStartsWith = await db.user.findMany({
        where: { name: { startsWith: 'Al' } },
      });
      assert.equal(byStartsWith.length, 1);
      assert.equal(byStartsWith[0]!.id, users.alice.id);

      const byEquals = await db.user.findMany({
        where: { email: { equals: 'bob@b.com' } },
      });
      assert.equal(byEquals.length, 1);
      assert.equal(byEquals[0]!.id, users.bob.id);
    });

    it('findMany with numeric and enum filter operators', async () => {
      const byGte = await db.user.findMany({
        where: { balance: { gte: 50 } },
      });
      assert.equal(byGte.length, 2);

      const byIn = await db.user.findMany({
        where: { role: { in: ['ADMIN', 'PUBLIC'] } },
      });
      assert.equal(byIn.length, 2);
    });

    it('findMany with AND, OR, and NOT', async () => {
      const byAnd = await db.user.findMany({
        where: {
          AND: [{ role: 'USER' }, { isActive: false }],
        },
      });
      assert.equal(byAnd.length, 1);
      assert.equal(byAnd[0]!.id, users.bob.id);

      const byOr = await db.user.findMany({
        where: {
          OR: [{ role: 'ADMIN' }, { role: 'PUBLIC' }],
        },
      });
      assert.equal(byOr.length, 2);

      const byNot = await db.user.findMany({
        where: {
          NOT: { isActive: false },
        },
      });
      assert.equal(byNot.length, 3);
    });

    it('count with and without where', async () => {
      const total = await db.user.count();
      assert.equal(total, 4);

      const adminCount = await db.user.count({ where: { role: 'ADMIN' } });
      assert.equal(adminCount, 1);
    });
  });

  describe('write operations', () => {
    it('update a single user', async () => {
      const updated = await db.user.update({
        where: { id: users.alice.id },
        data: { name: 'Bob' },
      });

      assert.equal(updated.name, 'Bob');

      const found = await db.user.findUnique({ id: users.alice.id });
      assert.ok(found);
      assert.equal(found.name, 'Bob');
    });

    it('updateMany matching rows', async () => {
      const result = await db.user.updateMany({
        where: { isActive: false },
        data: { name: 'Bobby' },
      });

      assert.equal(result.count, 1);

      const bob = await db.user.findUnique({ id: users.bob.id });
      assert.ok(bob);
      assert.equal(bob.name, 'Bobby');
    });
  });

  describe('delete operations', () => {
    it('delete a single user', async () => {
      const deleted = await db.user.delete({ id: users.alice.id });
      assert.equal(deleted.id, users.alice.id);

      const gone = await db.user.findUnique({ id: users.alice.id });
      assert.equal(gone, null);
    });

    it('deleteMany matching rows', async () => {
      const result = await db.user.deleteMany({
        where: { role: 'PUBLIC' },
      });

      assert.equal(result.count, 1);

      const remaining = await db.user.count();
      assert.equal(remaining, 2);
    });
  });

  describe('error handling', () => {
    it('throws UniqueConstraintError on duplicate email', async () => {
      await assert.rejects(
        () =>
          db.user.create({
            email: 'admin@b.com',
            name: 'Duplicate',
            balance: 0,
          }),
        (error: unknown) => {
          assert.ok(error instanceof UniqueConstraintError);
          assert.ok(error.fields.includes('email'));
          return true;
        },
      );
    });

    it('throws ForeignKeyConstraintError on invalid userId', async () => {
      await assert.rejects(
        () =>
          db.order.create({
            userId: randomUUID(),
            totalAmount: '9.99',
            items: { sku: 'test' },
          }),
        (error: unknown) => {
          assert.ok(error instanceof ForeignKeyConstraintError);
          return true;
        },
      );
    });
  });

  describe('multi-model smoke', () => {
    it('creates, counts, and deleteMany on Log model', async () => {
      await db.log.create({ message: 'integration test' });

      const total = await db.log.count();
      assert.ok(total >= 1);

      const result = await db.log.deleteMany({
        where: { message: { contains: 'integration' } },
      });

      assert.equal(result.count, 1);
    });
  });
});
