import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expectParseError,
  expectSchemaError,
  parseModelBody,
  parseSnippet,
  wrapModels,
} from './helpers.js';

describe('Parser — @@partition', () => {
  it('parses RANGE partitions with from/to and MAXVALUE', () => {
    const model = parseModelBody(`
      id: UUID
      createdAt: TIMESTAMP
      @@id(fields: [id, createdAt])
      @@partition {
        by: RANGE
        fields: [createdAt]
        partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
        partition LogFuture { from: "2025-01-01", to: MAXVALUE }
      }
    `);

    assert.ok(model.partition);
    assert.equal(model.partition!.by, 'RANGE');
    assert.deepEqual(model.partition!.fields, ['createdAt']);
    assert.equal(model.partition!.partitions.length, 2);
    assert.equal(model.partition!.partitions[0].name, 'Log2024');
    assert.equal(model.partition!.partitions[1].to?.kind, 'Identifier');
  });

  it('parses LIST partitions with in and default', () => {
    const model = parseModelBody(`
      id: UUID
      region: TEXT
      @@id(fields: [id, region])
      @@partition {
        by: LIST
        fields: [region]
        partition AuditUs { in: ["US", "USA"] }
        partition AuditDefault { default: true }
      }
    `);

    assert.equal(model.partition!.by, 'LIST');
    assert.equal(model.partition!.partitions[0].in?.length, 2);
    assert.equal(model.partition!.partitions[1].default, true);
  });

  it('parses HASH count shorthand', () => {
    const model = parseModelBody(`
      id: UUID @id
      @@partition {
        by: HASH
        fields: [id]
        count: 4
      }
    `);

    assert.equal(model.partition!.by, 'HASH');
    assert.equal(model.partition!.count, 4);
    assert.equal(model.partition!.partitions.length, 0);
  });

  it('parses HASH with explicit modulus/remainder', () => {
    const model = parseModelBody(`
      id: UUID @id
      @@partition {
        by: HASH
        fields: [id]
        partition MetricA { modulus: 2, remainder: 0 }
        partition MetricB { modulus: 2, remainder: 1 }
      }
    `);

    assert.equal(model.partition!.partitions[0].modulus, 2);
    assert.equal(model.partition!.partitions[1].remainder, 1);
  });

  it('parses nested @@partition one level deep', () => {
    const model = parseModelBody(`
      id: UUID
      createdAt: TIMESTAMP
      region: TEXT
      @@id(fields: [id, createdAt, region])
      @@partition {
        by: RANGE
        fields: [createdAt]
        partition Log2024 {
          from: "2024-01-01", to: "2025-01-01"
          @@partition {
            by: LIST
            fields: [region]
            partition Log2024Us { in: ["US"] }
            partition Log2024Eu { in: ["EU"] }
          }
        }
      }
    `);

    const child = model.partition!.partitions[0];
    assert.ok(child.partition);
    assert.equal(child.partition!.by, 'LIST');
    assert.equal(child.partition!.partitions.length, 2);
  });

  it('parses expression partition key', () => {
    const model = parseModelBody(`
      id: UUID
      createdAt: TIMESTAMP
      @@id(fields: [id, createdAt])
      @@partition {
        by: RANGE
        expression: "date_trunc('month', created_at)"
        partition Log202401 { from: "2024-01-01", to: "2024-02-01" }
      }
    `);

    assert.equal(model.partition!.expression, "date_trunc('month', created_at)");
    assert.equal(model.partition!.fields, undefined);
  });

  it('rejects two @@partition directives', () => {
    expectParseError(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition { by: RANGE, fields: [createdAt] }
        @@partition { by: LIST, fields: [createdAt] }
      }`),
      'at most one @@partition',
    );
  });

  it('rejects fields and expression together', () => {
    expectSchemaError(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: RANGE
          fields: [createdAt]
          expression: "created_at"
        }
      }`),
      'either fields or expression',
    );
  });
});

describe('Validate — @@partition', () => {
  it('rejects primary key missing partition key', () => {
    expectSchemaError(
      wrapModels(`model Log {
        id: UUID @id
        createdAt: TIMESTAMP
        @@partition {
          by: RANGE
          fields: [createdAt]
          partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
        }
      }`),
      'primary key must include partition key',
    );
  });

  it('rejects overlapping RANGE partitions', () => {
    expectSchemaError(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: RANGE
          fields: [createdAt]
          partition A { from: "2024-01-01", to: "2025-01-01" }
          partition B { from: "2024-06-01", to: "2026-01-01" }
        }
      }`),
      'overlapping bounds',
    );
  });

  it('rejects HASH remainder gaps', () => {
    expectSchemaError(
      wrapModels(`model Metric {
        id: UUID @id
        @@partition {
          by: HASH
          fields: [id]
          partition A { modulus: 2, remainder: 0 }
        }
      }`),
      'exactly 2 partitions',
    );
  });

  it('rejects FK to partitioned model without partition key in references', () => {
    expectSchemaError(
      wrapModels(`
        model Order {
          id: UUID
          status: TEXT
          @@id(fields: [id, status])
          @@partition {
            by: LIST
            fields: [status]
            partition Open { in: ["PENDING"] }
          }
        }
        model Line {
          id: UUID @id
          orderId: UUID
          order: Order @relation(fields: [orderId], references: [id])
        }
      `),
      'must reference a unique key that includes partition fields',
    );
  });

  it('rejects duplicate partition names', () => {
    expectSchemaError(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: RANGE
          fields: [createdAt]
          partition Same { from: "2024-01-01", to: "2025-01-01" }
          partition Same { from: "2025-01-01", to: "2026-01-01" }
        }
      }`),
      'duplicate partition name',
    );
  });

  it('accepts a valid partitioned model', () => {
    const schema = parseSnippet(
      wrapModels(`model Log {
        id: UUID
        createdAt: TIMESTAMP
        @@id(fields: [id, createdAt])
        @@partition {
          by: RANGE
          fields: [createdAt]
          partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
        }
      }`),
    );
    assert.equal(schema.models[0].partition?.partitions.length, 1);
  });
});
