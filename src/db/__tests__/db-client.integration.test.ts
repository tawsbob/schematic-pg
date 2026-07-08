import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { createDbClient } from '../../../generated/db.js';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'schematic-pg/db/errors';
import {
  assertDockerPostgres,
  assertGeneratedArtifacts,
  resetBootstrapAndSeed,
  type SeededUsers,
} from '../../__tests__/helpers/integration.js';

describe('db client integration (Docker)', { concurrency: 1 }, () => {
  let pool: Pool;
  let db: ReturnType<typeof createDbClient>;
  let users: SeededUsers;

  before(async () => {
    assertGeneratedArtifacts();

    pool = await assertDockerPostgres();
    ({ db, users } = await resetBootstrapAndSeed(pool));
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

  describe('include eager-loading', () => {
    it('findMany loads sibling relations without cartesian duplication', async () => {
      const order = await db.order.create({
        userId: users.admin.id,
        totalAmount: '19.99',
        items: { sku: 'book' },
      });

      await db.profile.create({
        userId: users.admin.id,
        bio: 'Admin profile',
        avatar: 'avatar.png',
        location: '(0,0)',
      });

      const found = await db.user.findMany({
        where: { id: users.admin.id },
        include: {
          profile: true,
          orders: true,
        },
      });

      assert.equal(found.length, 1);
      assert.equal(found[0]!.profile?.bio, 'Admin profile');
      assert.equal(found[0]!.orders.length, 1);
      assert.equal(found[0]!.orders[0]!.id, order.id);
    });

    it('findUnique loads nested relations three levels deep', async () => {
      const includeUser = await db.user.create({
        email: 'include-nested@b.com',
        name: 'Include Nested',
        balance: 0,
      });

      const order = await db.order.create({
        userId: includeUser.id,
        totalAmount: '49.99',
        items: { sku: 'bundle' },
      });

      const product = await db.product.create({
        name: 'Widget',
        description: 'A widget',
        price: '9.99',
        stock: 10,
        category: 'tools',
        tags: ['new'],
        metadata: { color: 'blue' },
      });

      await db.productOrder.create({
        orderId: order.id,
        productId: product.id,
        quantity: 2,
        price: '9.99',
      });

      const found = await db.user.findUnique(
        { id: includeUser.id },
        {
          include: {
            orders: {
              include: {
                products: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      );

      assert.ok(found);
      assert.equal(found.orders.length, 1);
      assert.equal(found.orders[0]!.products.length, 1);
      assert.equal(found.orders[0]!.products[0]!.product.name, 'Widget');
    });

    it('findFirst supports include on SELECT path', async () => {
      const found = await db.user.findFirst({
        where: { email: 'admin@b.com' },
        include: { orders: true },
      });

      assert.ok(found);
      assert.ok(Array.isArray(found.orders));
    });

    it('findMany supports relationLoadStrategy join via json aggregation', async () => {
      const found = await db.user.findMany({
        where: { id: users.admin.id },
        include: {
          profile: true,
          orders: true,
        },
        relationLoadStrategy: 'join',
      });

      assert.equal(found.length, 1);
      assert.equal(found[0]!.profile?.bio, 'Admin profile');
      assert.equal(found[0]!.orders.length, 1);
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

  describe('$transaction', () => {
    async function createProduct(stock: number): Promise<{ id: string; stock: number }> {
      return db.product.create({
        name: 'Tx Product',
        description: 'A product used by transaction tests',
        price: '9.99',
        stock,
        category: 'tools',
        tags: ['tx'],
        metadata: { origin: 'tx-test' },
      });
    }

    it('commits every write when the callback resolves', async () => {
      const product = await createProduct(10);

      const order = await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          userId: users.admin.id,
          totalAmount: '19.99',
          items: { sku: 'tx-commit' },
        });

        await tx.productOrder.create({
          orderId: created.id,
          productId: product.id,
          quantity: 2,
          price: '9.99',
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stock: 8 },
        });

        return created;
      });

      const savedOrder = await db.order.findUnique({ id: order.id });
      assert.ok(savedOrder);

      const savedProductOrder = await db.productOrder.findFirst({
        where: { orderId: order.id },
      });
      assert.ok(savedProductOrder);
      assert.equal(savedProductOrder.quantity, 2);

      const savedProduct = await db.product.findUnique({ id: product.id });
      assert.ok(savedProduct);
      assert.equal(savedProduct.stock, 8);
    });

    it('rolls back every write when the callback throws', async () => {
      const product = await createProduct(20);
      let createdOrderId: string | undefined;

      await assert.rejects(
        db.$transaction(async (tx) => {
          const created = await tx.order.create({
            userId: users.admin.id,
            totalAmount: '5.00',
            items: { sku: 'tx-rollback' },
          });
          createdOrderId = created.id;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: 5 },
          });

          throw new Error('rollback boom');
        }),
        /rollback boom/,
      );

      assert.ok(createdOrderId);
      const goneOrder = await db.order.findUnique({ id: createdOrderId });
      assert.equal(goneOrder, null);

      const savedProduct = await db.product.findUnique({ id: product.id });
      assert.ok(savedProduct);
      assert.equal(savedProduct.stock, 20);
    });

    it('rolls back and propagates the typed error on a constraint violation', async () => {
      let createdOrderId: string | undefined;

      await assert.rejects(
        db.$transaction(async (tx) => {
          const created = await tx.order.create({
            userId: users.admin.id,
            totalAmount: '1.00',
            items: { sku: 'tx-constraint' },
          });
          createdOrderId = created.id;

          await tx.user.create({
            email: 'admin@b.com',
            name: 'Duplicate In Tx',
            balance: 0,
          });
        }),
        (error: unknown) => {
          assert.ok(error instanceof UniqueConstraintError);
          assert.ok(error.fields.includes('email'));
          return true;
        },
      );

      assert.ok(createdOrderId);
      const goneOrder = await db.order.findUnique({ id: createdOrderId });
      assert.equal(goneOrder, null);
    });

    it('sees its own uncommitted writes within the same transaction', async () => {
      await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          userId: users.admin.id,
          totalAmount: '2.00',
          items: { sku: 'tx-isolation' },
        });

        const found = await tx.order.findUnique({ id: created.id });
        assert.ok(found);
        assert.equal(found.id, created.id);
      });
    });
  });

  describe('$queryRaw / $executeRaw', () => {
    it('$queryRaw runs a literal query', async () => {
      const rows = await db.$queryRaw<{ one: number }>('SELECT 1 as one');
      assert.deepEqual(rows, [{ one: 1 }]);
    });

    it('$queryRaw returns raw snake_case columns for parameterized queries', async () => {
      const rows = await db.$queryRaw<{ id: string; email: string }>(
        'SELECT id, email, created_at FROM "user" WHERE email = $1',
        [users.admin.email],
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.id, users.admin.id);
      assert.equal(rows[0]!.email, users.admin.email);
      assert.ok('created_at' in rows[0]!);
    });

    it('$executeRaw returns the affected row count', async () => {
      const count = await db.$executeRaw(
        'UPDATE "user" SET name = $1 WHERE role = $2',
        ['Raw Update', 'ADMIN'],
      );
      assert.equal(count, 1);

      const [row] = await db.$queryRaw<{ name: string }>(
        'SELECT name FROM "user" WHERE id = $1',
        [users.admin.id],
      );
      assert.equal(row!.name, 'Raw Update');
    });

    it('runs on the transaction connection and reads uncommitted writes', async () => {
      await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          userId: users.admin.id,
          totalAmount: '7.00',
          items: { sku: 'raw-tx' },
        });

        const rows = await tx.$queryRaw<{ id: string }>(
          'SELECT id FROM "order" WHERE id = $1',
          [created.id],
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0]!.id, created.id);
      });
    });

    it('rolls back raw writes when the transaction throws', async () => {
      const marker = randomUUID();

      await assert.rejects(
        db.$transaction(async (tx) => {
          await tx.$executeRaw('INSERT INTO "log" (message) VALUES ($1)', [marker]);
          throw new Error('raw rollback boom');
        }),
        /raw rollback boom/,
      );

      const rows = await db.$queryRaw<{ id: string }>(
        'SELECT id FROM "log" WHERE message = $1',
        [marker],
      );
      assert.equal(rows.length, 0);
    });
  });
});
