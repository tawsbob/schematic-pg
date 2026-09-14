import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parse } from '../../schema-dsl/index.js';
import { wrapModels } from '../../schema-dsl/__tests__/helpers.js';
import { flattenPartitions } from '../generators/partitions.js';
import { SqlGenerator } from '../sql-generator.js';

const rangeLog = wrapModels(`model Log {
  id: UUID
  createdAt: TIMESTAMP
  @@id(fields: [id, createdAt])
  @@partition {
    by: RANGE
    fields: [createdAt]
    partition Log2024 { from: "2024-01-01", to: "2025-01-01" }
    partition LogFuture { from: "2025-01-01", to: MAXVALUE }
  }
}`);

const nestedLog = wrapModels(`model Log {
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
}`);

const hashMetric = wrapModels(`model Metric {
  id: UUID @id
  @@partition {
    by: HASH
    fields: [id]
    count: 4
  }
}`);

describe('SqlGenerator — partitions', () => {
  const generator = new SqlGenerator();

  it('emits PARTITION BY and PARTITION OF for RANGE', () => {
    const sql = generator.generateFromSource(rangeLog);
    assert.match(sql, /CREATE TABLE log \([\s\S]*\) PARTITION BY RANGE \(created_at\);/);
    assert.match(
      sql,
      /CREATE TABLE log_2024 PARTITION OF log\n  FOR VALUES FROM \('2024-01-01'\) TO \('2025-01-01'\);/,
    );
    assert.match(
      sql,
      /CREATE TABLE log_future PARTITION OF log\n  FOR VALUES FROM \('2025-01-01'\) TO \(MAXVALUE\);/,
    );
  });

  it('emits nested PARTITION BY on child and grandchildren', () => {
    const sql = generator.generateFromSource(nestedLog);
    assert.match(
      sql,
      /CREATE TABLE log_2024 PARTITION OF log\n  FOR VALUES FROM \('2024-01-01'\) TO \('2025-01-01'\)\n  PARTITION BY LIST \(region\);/,
    );
    assert.match(sql, /CREATE TABLE log_2024_us PARTITION OF log_2024\n  FOR VALUES IN \('US'\);/);
    assert.match(sql, /CREATE TABLE log_2024_eu PARTITION OF log_2024\n  FOR VALUES IN \('EU'\);/);
  });

  it('expands HASH count into modulus/remainder children', () => {
    const schema = parse(hashMetric);
    const partitions = flattenPartitions(schema.models[0]);
    assert.equal(partitions.length, 4);
    assert.deepEqual(
      partitions.map((partition) => partition.tableName),
      ['metric_p0', 'metric_p1', 'metric_p2', 'metric_p3'],
    );

    const sql = generator.generateFromSource(hashMetric);
    assert.match(sql, /PARTITION BY HASH \(id\)/);
    assert.match(
      sql,
      /CREATE TABLE metric_p0 PARTITION OF metric\n  FOR VALUES WITH \(MODULUS 4, REMAINDER 0\);/,
    );
  });
});
