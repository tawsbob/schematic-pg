import type { Model, Partition, PartitionBound, PartitionSpec, Value } from '../../schema-dsl/ast.js';
import { escapeSqlString } from '../utils/value-formatter.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';

export type PartitionValues =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'list'; values: string[] }
  | { kind: 'default' }
  | { kind: 'hash'; modulus: number; remainder: number };

export interface NormalizedPartition {
  modelName: string;
  name: string;
  tableName: string;
  parentTable: string;
  values: PartitionValues;
  /** PARTITION BY clause for this table when it is itself partitioned (nested). */
  partitionBy?: string;
  /** Signature used for migration equality (bounds / list / hash). */
  signature: string;
}

export function formatPartitionBy(spec: PartitionSpec): string {
  const strategy = spec.by;
  if (spec.expression) {
    return `PARTITION BY ${strategy} (${spec.expression})`;
  }
  const columns = (spec.fields ?? []).map((field) => toSnakeCase(field)).join(', ');
  return `PARTITION BY ${strategy} (${columns})`;
}

export function resolvePartitionTableName(partition: Partition): string {
  if (partition.sqlName) {
    return partition.sqlName;
  }
  return toTableName(partition.name);
}

export function flattenPartitions(model: Model): NormalizedPartition[] {
  if (!model.partition) {
    return [];
  }
  return flattenPartitionSpec(model, model.partition, toTableName(model.name));
}

function flattenPartitionSpec(
  model: Model,
  spec: PartitionSpec,
  parentTable: string,
): NormalizedPartition[] {
  const results: NormalizedPartition[] = [];

  if (spec.by === 'HASH' && spec.count !== undefined) {
    for (let remainder = 0; remainder < spec.count; remainder++) {
      const name = `${toPascalCase(parentTable)}P${remainder}`;
      const tableName = `${parentTable}_p${remainder}`;
      const values: PartitionValues = {
        kind: 'hash',
        modulus: spec.count,
        remainder,
      };
      results.push({
        modelName: model.name,
        name,
        tableName,
        parentTable,
        values,
        signature: JSON.stringify(values),
      });
    }
    return results;
  }

  for (const partition of spec.partitions) {
    const tableName = resolvePartitionTableName(partition);
    const values = normalizePartitionValues(spec, partition);
    const nestedBy = partition.partition ? formatPartitionBy(partition.partition) : undefined;

    results.push({
      modelName: model.name,
      name: partition.name,
      tableName,
      parentTable,
      values,
      partitionBy: nestedBy,
      signature: JSON.stringify({ values, partitionBy: nestedBy ?? null }),
    });

    if (partition.partition) {
      results.push(...flattenPartitionSpec(model, partition.partition, tableName));
    }
  }

  return results;
}

function normalizePartitionValues(spec: PartitionSpec, partition: Partition): PartitionValues {
  if (spec.by === 'RANGE') {
    return {
      kind: 'range',
      from: formatPartitionBound(partition.from!),
      to: formatPartitionBound(partition.to!),
    };
  }

  if (spec.by === 'LIST') {
    if (partition.default) {
      return { kind: 'default' };
    }
    return {
      kind: 'list',
      values: (partition.in ?? []).map(formatPartitionBound),
    };
  }

  return {
    kind: 'hash',
    modulus: partition.modulus!,
    remainder: partition.remainder!,
  };
}

export function formatPartitionBound(value: PartitionBound): string {
  return formatBoundValue(value);
}

function formatBoundValue(value: Value): string {
  switch (value.kind) {
    case 'StringLiteral':
      return `'${escapeSqlString(value.value)}'`;
    case 'NumberLiteral':
      return String(value.value);
    case 'BooleanLiteral':
      return value.value ? 'true' : 'false';
    case 'Identifier': {
      const upper = value.name.toUpperCase();
      if (upper === 'MINVALUE' || upper === 'MAXVALUE' || upper === 'NULL') {
        return upper;
      }
      return `'${escapeSqlString(value.name)}'`;
    }
    case 'ArrayLiteral':
      return value.elements.map(formatBoundValue).join(', ');
    default:
      throw new Error(`Unsupported partition bound kind: ${value.kind}`);
  }
}

export function formatPartitionOfClause(partition: NormalizedPartition): string {
  const table = quoteIdentifier(partition.tableName);
  const parent = quoteIdentifier(partition.parentTable);
  const valuesClause = formatValuesClause(partition.values);
  const partitionBy = partition.partitionBy ? `\n  ${partition.partitionBy}` : '';
  return `CREATE TABLE ${table} PARTITION OF ${parent}\n  ${valuesClause}${partitionBy};`;
}

function formatValuesClause(values: PartitionValues): string {
  switch (values.kind) {
    case 'range':
      return `FOR VALUES FROM (${values.from}) TO (${values.to})`;
    case 'list':
      return `FOR VALUES IN (${values.values.join(', ')})`;
    case 'default':
      return 'DEFAULT';
    case 'hash':
      return `FOR VALUES WITH (MODULUS ${values.modulus}, REMAINDER ${values.remainder})`;
  }
}

export function formatDetachAndDropPartition(partition: NormalizedPartition): string {
  const parent = quoteIdentifier(partition.parentTable);
  const table = quoteIdentifier(partition.tableName);
  return `ALTER TABLE ${parent} DETACH PARTITION ${table};\nDROP TABLE ${table} CASCADE;`;
}

function toPascalCase(snake: string): string {
  return snake
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function partitionStrategySignature(spec: PartitionSpec | undefined): string | null {
  if (!spec) {
    return null;
  }
  return JSON.stringify({
    by: spec.by,
    fields: spec.fields ?? null,
    expression: spec.expression ?? null,
    count: spec.count ?? null,
  });
}
