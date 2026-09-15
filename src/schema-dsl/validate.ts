import type {
  Model,
  Partition,
  PartitionSpec,
  Schema,
  SourceLocation,
  Value,
} from './ast.js';

export class SchemaError extends Error {
  readonly line: number;
  readonly col: number;
  readonly file?: string;

  constructor(message: string, loc: SourceLocation) {
    const location = loc.file
      ? `${loc.file}:${loc.line}:${loc.col}`
      : `line ${loc.line}, col ${loc.col}`;
    super(`Schema error at ${location}: ${message}`);
    this.name = 'SchemaError';
    this.line = loc.line;
    this.col = loc.col;
    this.file = loc.file;
  }
}

export function validateSchema(schema: Schema): void {
  const modelNames = new Set(schema.models.map((model) => model.name));
  const partitionNames = new Map<string, SourceLocation>();

  for (const model of schema.models) {
    if (!model.partition) {
      continue;
    }
    validatePartitionSpec(model, model.partition, modelNames, partitionNames, 0);
  }

  validateIncomingForeignKeys(schema, modelNames);
}

function validatePartitionSpec(
  model: Model,
  spec: PartitionSpec,
  modelNames: Set<string>,
  partitionNames: Map<string, SourceLocation>,
  depth: number,
): void {
  if (depth > 1) {
    throw new SchemaError('at most one level of nested @@partition is allowed', spec.loc);
  }

  const hasFields = Boolean(spec.fields && spec.fields.length > 0);
  const hasExpression = Boolean(spec.expression);

  if (hasFields && hasExpression) {
    throw new SchemaError('use either fields or expression, not both', spec.loc);
  }

  if (!hasFields && !hasExpression) {
    throw new SchemaError('@@partition requires fields or expression', spec.loc);
  }

  if (spec.fields) {
    const storedNames = new Set(
      model.fields.filter((field) => !modelNames.has(field.type.name)).map((field) => field.name),
    );
    for (const fieldName of spec.fields) {
      if (!storedNames.has(fieldName)) {
        throw new SchemaError(
          `partition field "${fieldName}" is not a stored column on model "${model.name}"`,
          spec.loc,
        );
      }
    }
  }

  if (spec.count !== undefined) {
    if (spec.by !== 'HASH') {
      throw new SchemaError('count is only valid for HASH partitions', spec.loc);
    }
    if (spec.partitions.length > 0) {
      throw new SchemaError('do not mix count with explicit partition blocks', spec.loc);
    }
    if (!Number.isInteger(spec.count) || spec.count < 1) {
      throw new SchemaError('count must be a positive integer', spec.loc);
    }
  }

  if (spec.by === 'HASH' && spec.count === undefined && spec.partitions.length > 0) {
    validateHashPartitions(spec);
  }

  if (spec.by === 'RANGE') {
    validateRangePartitions(spec);
  }

  if (spec.by === 'LIST') {
    validateListPartitions(spec);
  }

  if (depth === 0 && hasFields && spec.fields) {
    validateUniqueConstraintsIncludeKey(model, spec.fields, modelNames, spec.loc);
  }

  for (const partition of spec.partitions) {
    registerPartitionName(partition.name, partition.loc, partitionNames);
    validatePartitionChild(model, spec, partition, modelNames, partitionNames, depth);
  }
}

function validatePartitionChild(
  model: Model,
  parentSpec: PartitionSpec,
  partition: Partition,
  modelNames: Set<string>,
  partitionNames: Map<string, SourceLocation>,
  depth: number,
): void {
  if (parentSpec.by === 'RANGE') {
    if (partition.default) {
      throw new SchemaError('RANGE partitions do not use default: true (use MINVALUE/MAXVALUE)', partition.loc);
    }
    if (partition.in) {
      throw new SchemaError('RANGE partitions use from/to, not in', partition.loc);
    }
    if (partition.modulus !== undefined || partition.remainder !== undefined) {
      throw new SchemaError('RANGE partitions do not use modulus/remainder', partition.loc);
    }
    if (!partition.from || !partition.to) {
      throw new SchemaError('RANGE partitions require from and to', partition.loc);
    }
  }

  if (parentSpec.by === 'LIST') {
    if (partition.modulus !== undefined || partition.remainder !== undefined) {
      throw new SchemaError('LIST partitions do not use modulus/remainder', partition.loc);
    }
    if (partition.from || partition.to) {
      throw new SchemaError('LIST partitions use in or default, not from/to', partition.loc);
    }
    if (partition.default && partition.in) {
      throw new SchemaError('default partitions cannot also set in', partition.loc);
    }
    if (!partition.default && !partition.in) {
      throw new SchemaError('LIST partitions require in: [...] or default: true', partition.loc);
    }
  }

  if (parentSpec.by === 'HASH') {
    if (partition.default || partition.in || partition.from || partition.to) {
      throw new SchemaError('HASH partitions use modulus and remainder', partition.loc);
    }
    if (partition.modulus === undefined || partition.remainder === undefined) {
      throw new SchemaError('HASH partitions require modulus and remainder', partition.loc);
    }
  }

  if (partition.partition) {
    validatePartitionSpec(model, partition.partition, modelNames, partitionNames, depth + 1);
  }
}

function validateRangePartitions(spec: PartitionSpec): void {
  for (const partition of spec.partitions) {
    if (!partition.from || !partition.to) {
      continue;
    }
  }
  // Overlap detection for simple single-value bounds; composite keys are left to Postgres.
  const simpleBounds = spec.partitions
    .filter((partition) => partition.from && partition.to)
    .map((partition) => ({
      partition,
      from: serializeBoundForCompare(partition.from!),
      to: serializeBoundForCompare(partition.to!),
    }))
    .filter((entry) => entry.from !== null && entry.to !== null) as Array<{
    partition: Partition;
    from: string;
    to: string;
  }>;

  for (let i = 0; i < simpleBounds.length; i++) {
    for (let j = i + 1; j < simpleBounds.length; j++) {
      const left = simpleBounds[i];
      const right = simpleBounds[j];
      if (rangeOverlaps(left.from, left.to, right.from, right.to)) {
        throw new SchemaError(
          `RANGE partitions "${left.partition.name}" and "${right.partition.name}" have overlapping bounds`,
          right.partition.loc,
        );
      }
    }
  }
}

function validateListPartitions(spec: PartitionSpec): void {
  let defaultCount = 0;
  const seen = new Map<string, string>();

  for (const partition of spec.partitions) {
    if (partition.default) {
      defaultCount += 1;
      if (defaultCount > 1) {
        throw new SchemaError('at most one default LIST partition is allowed', partition.loc);
      }
      continue;
    }

    for (const value of partition.in ?? []) {
      const key = serializeBoundForCompare(value);
      if (key === null) {
        continue;
      }
      const existing = seen.get(key);
      if (existing) {
        throw new SchemaError(
          `LIST value ${key} appears in partitions "${existing}" and "${partition.name}"`,
          partition.loc,
        );
      }
      seen.set(key, partition.name);
    }
  }
}

function validateHashPartitions(spec: PartitionSpec): void {
  const moduli = new Set(spec.partitions.map((partition) => partition.modulus));
  if (moduli.size !== 1) {
    throw new SchemaError('all HASH partitions must share the same modulus', spec.loc);
  }

  const modulus = spec.partitions[0]?.modulus;
  if (modulus === undefined) {
    return;
  }

  if (spec.partitions.length !== modulus) {
    throw new SchemaError(
      `HASH with modulus ${modulus} requires exactly ${modulus} partitions (got ${spec.partitions.length})`,
      spec.loc,
    );
  }

  const remainders = new Set<number>();
  for (const partition of spec.partitions) {
    if (partition.remainder === undefined) {
      continue;
    }
    if (partition.remainder < 0 || partition.remainder >= modulus) {
      throw new SchemaError(
        `remainder must be between 0 and ${modulus - 1}`,
        partition.loc,
      );
    }
    if (remainders.has(partition.remainder)) {
      throw new SchemaError(`duplicate HASH remainder ${partition.remainder}`, partition.loc);
    }
    remainders.add(partition.remainder);
  }

  for (let remainder = 0; remainder < modulus; remainder++) {
    if (!remainders.has(remainder)) {
      throw new SchemaError(`missing HASH remainder ${remainder}`, spec.loc);
    }
  }
}

function validateUniqueConstraintsIncludeKey(
  model: Model,
  partitionFields: string[],
  modelNames: Set<string>,
  loc: SourceLocation,
): void {
  const keySet = new Set(partitionFields);

  const primaryKeyFields = getPrimaryKeyFieldNames(model);
  if (primaryKeyFields && !keySetIsCovered(primaryKeyFields, keySet)) {
    throw new SchemaError(
      `primary key must include partition key fields [${partitionFields.join(', ')}]`,
      loc,
    );
  }

  for (const field of model.fields) {
    if (modelNames.has(field.type.name)) {
      continue;
    }
    if (field.attributes.some((attr) => attr.name === 'unique')) {
      if (!keySetIsCovered([field.name], keySet)) {
        throw new SchemaError(
          `unique field "${field.name}" must include partition key fields [${partitionFields.join(', ')}] (use @@index with unique: true)`,
          field.loc,
        );
      }
    }
  }

  for (const directive of model.directives.filter((item) => item.name === 'index')) {
    if (!directive.args || directive.args.kind !== 'KeyValueArgs') {
      continue;
    }
    const uniquePair = directive.args.pairs.find((pair) => pair.key === 'unique');
    if (!uniquePair || uniquePair.value.kind !== 'BooleanLiteral' || !uniquePair.value.value) {
      continue;
    }
    const fieldsPair = directive.args.pairs.find((pair) => pair.key === 'fields');
    if (!fieldsPair || fieldsPair.value.kind !== 'ArrayLiteral') {
      continue;
    }
    const fields = fieldsPair.value.elements
      .filter((element): element is { kind: 'Identifier'; name: string } => element.kind === 'Identifier')
      .map((element) => element.name);
    if (!keySetIsCovered(fields, keySet)) {
      throw new SchemaError(
        `unique index must include partition key fields [${partitionFields.join(', ')}]`,
        directive.loc,
      );
    }
  }
}

function validateIncomingForeignKeys(schema: Schema, modelNames: Set<string>): void {
  const modelsByName = new Map(schema.models.map((model) => [model.name, model]));

  for (const model of schema.models) {
    for (const field of model.fields) {
      if (!modelNames.has(field.type.name)) {
        continue;
      }

      const relation = field.attributes.find((attr) => attr.name === 'relation');
      if (!relation?.args || relation.args.kind !== 'KeyValueArgs') {
        continue;
      }

      const referencesPair = relation.args.pairs.find((pair) => pair.key === 'references');
      if (!referencesPair || referencesPair.value.kind !== 'ArrayLiteral') {
        continue;
      }

      const targetModel = modelsByName.get(field.type.name);
      if (!targetModel?.partition?.fields) {
        continue;
      }

      const referenced = referencesPair.value.elements
        .filter((element): element is { kind: 'Identifier'; name: string } => element.kind === 'Identifier')
        .map((element) => element.name);

      const partitionKey = new Set(targetModel.partition.fields);
      if (!keySetIsCovered(referenced, partitionKey)) {
        throw new SchemaError(
          `foreign key to partitioned model "${targetModel.name}" must reference a unique key that includes partition fields [${targetModel.partition.fields.join(', ')}]`,
          field.loc,
        );
      }
    }
  }
}

function getPrimaryKeyFieldNames(model: Model): string[] | undefined {
  const composite = model.directives.find((directive) => directive.name === 'id');
  if (composite?.args?.kind === 'KeyValueArgs') {
    const fieldsPair = composite.args.pairs.find((pair) => pair.key === 'fields');
    if (fieldsPair?.value.kind === 'ArrayLiteral') {
      return fieldsPair.value.elements
        .filter((element): element is { kind: 'Identifier'; name: string } => element.kind === 'Identifier')
        .map((element) => element.name);
    }
  }

  const idFields = model.fields
    .filter((field) => field.attributes.some((attr) => attr.name === 'id'))
    .map((field) => field.name);
  if (idFields.length > 0) {
    return idFields;
  }

  return undefined;
}

function keySetIsCovered(constraintFields: string[], partitionKey: Set<string>): boolean {
  return [...partitionKey].every((field) => constraintFields.includes(field));
}

function registerPartitionName(
  name: string,
  loc: SourceLocation,
  partitionNames: Map<string, SourceLocation>,
): void {
  if (partitionNames.has(name)) {
    throw new SchemaError(`duplicate partition name "${name}"`, loc);
  }
  partitionNames.set(name, loc);
}

function serializeBoundForCompare(value: Value): string | null {
  switch (value.kind) {
    case 'StringLiteral':
      return JSON.stringify(value.value);
    case 'NumberLiteral':
      return String(value.value);
    case 'BooleanLiteral':
      return value.value ? 'true' : 'false';
    case 'Identifier':
      return value.name.toUpperCase();
    case 'ArrayLiteral': {
      const parts = value.elements.map(serializeBoundForCompare);
      if (parts.some((part) => part === null)) {
        return null;
      }
      return `[${parts.join(',')}]`;
    }
    default:
      return null;
  }
}

function rangeOverlaps(fromA: string, toA: string, fromB: string, toB: string): boolean {
  // Treat bounds lexicographically for strings/numbers/identifiers after serializeBoundForCompare.
  // RANGE is half-open [from, to). Overlap when fromA < toB && fromB < toA, with MINVALUE/MAXVALUE extremes.
  const startA = boundRank(fromA, 'min');
  const endA = boundRank(toA, 'max');
  const startB = boundRank(fromB, 'min');
  const endB = boundRank(toB, 'max');
  return startA < endB && startB < endA;
}

function boundRank(bound: string, extreme: 'min' | 'max'): string {
  if (bound === 'MINVALUE') {
    return extreme === 'min' ? '\u0000' : '\u0000';
  }
  if (bound === 'MAXVALUE') {
    return '\uffff';
  }
  return bound;
}
