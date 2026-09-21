import type { Model, Schema } from '../../schema-dsl/ast.js';
import {
  collectForeignKeys,
  getDirectives,
  getEnumNames,
  getModelNames,
  getStoredFields,
  normalizeIndexDirective,
  normalizeTriggerDirective,
  resolveTriggerNames,
  serializeColumnType,
  type ForeignKeyInfo,
} from '../utils/ast-helpers.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';
import { generateForeignKey } from './foreign-keys.js';
import { generateCreateIndex, generateDropIndex } from './indexes.js';
import { flattenPartitions, formatPartitionOfClause } from './partitions.js';
import { generateTable } from './tables.js';
import { generateCreateTrigger } from './triggers.js';

export type PartitionConvertKind = 'ConvertToPartitioned' | 'ConvertFromPartitioned';

export function generatePartitionConvertSql(
  kind: PartitionConvertKind,
  modelName: string,
  oldSchema: Schema,
  newSchema: Schema,
): string {
  const oldModel = oldSchema.models.find((model) => model.name === modelName);
  const newModel = newSchema.models.find((model) => model.name === modelName);
  if (!oldModel || !newModel) {
    throw new Error(`Model "${modelName}" not found for partition conversion`);
  }

  const oldEnumNames = getEnumNames(oldSchema);
  const newEnumNames = getEnumNames(newSchema);
  const oldModelNames = getModelNames(oldSchema);
  const newModelNames = getModelNames(newSchema);
  const tableName = toTableName(modelName);
  const quotedTable = quoteIdentifier(tableName);
  const stagingTable = `${tableName}_pre_partition`;
  const quotedStaging = quoteIdentifier(stagingTable);

  const statements: string[] = [];

  for (const foreignKey of collectIncomingForeignKeys(oldSchema, modelName)) {
    statements.push(formatDropForeignKey(foreignKey));
  }

  statements.push(`ALTER TABLE ${quotedTable} RENAME TO ${quotedStaging};`);
  statements.push(generateTable(newModel, newEnumNames, newModelNames));

  if (kind === 'ConvertToPartitioned') {
    for (const partition of flattenPartitions(newModel)) {
      statements.push(formatPartitionOfClause(partition));
    }
  }

  const copySql = formatDataCopy(
    oldModel,
    newModel,
    oldEnumNames,
    newEnumNames,
    oldModelNames,
    newModelNames,
    quotedTable,
    quotedStaging,
  );
  if (copySql) {
    statements.push(copySql);
  }

  for (const directive of getDirectives(oldModel, 'index')) {
    const normalized = normalizeIndexDirective(directive, oldModel, oldModelNames);
    statements.push(generateDropIndex(oldModel, normalized));
  }

  for (const directive of getDirectives(newModel, 'index')) {
    const normalized = normalizeIndexDirective(directive, newModel, newModelNames);
    statements.push(generateCreateIndex(newModel, normalized));
  }

  for (const directive of getDirectives(newModel, 'trigger')) {
    const normalized = normalizeTriggerDirective(directive);
    statements.push(generateCreateTrigger(newModel, normalized));
  }

  for (const foreignKey of collectOutgoingForeignKeys(newSchema, modelName)) {
    statements.push(generateForeignKey(foreignKey));
  }

  for (const foreignKey of collectIncomingForeignKeys(newSchema, modelName)) {
    statements.push(generateForeignKey(foreignKey));
  }

  if (kind === 'ConvertFromPartitioned') {
    statements.push(`DROP TABLE ${quotedStaging} CASCADE;`);
  } else {
    statements.push(`DROP TABLE ${quotedStaging};`);
  }

  const newTriggerKeys = new Set(
    getDirectives(newModel, 'trigger').map((directive) => {
      const normalized = normalizeTriggerDirective(directive);
      return `${normalized.timing}:${normalized.event}`;
    }),
  );

  for (const directive of getDirectives(oldModel, 'trigger')) {
    const normalized = normalizeTriggerDirective(directive);
    const key = `${normalized.timing}:${normalized.event}`;
    if (newTriggerKeys.has(key)) {
      continue;
    }
    const { functionName } = resolveTriggerNames(oldModel, normalized.timing, normalized.event);
    statements.push(`DROP FUNCTION IF EXISTS ${functionName}();`);
  }

  return statements.join('\n\n');
}

function collectIncomingForeignKeys(schema: Schema, modelName: string): ForeignKeyInfo[] {
  return collectForeignKeys(schema).filter((foreignKey) => foreignKey.targetModel === modelName);
}

function collectOutgoingForeignKeys(schema: Schema, modelName: string): ForeignKeyInfo[] {
  return collectForeignKeys(schema).filter((foreignKey) => foreignKey.sourceModel === modelName);
}

function formatDropForeignKey(foreignKey: ForeignKeyInfo): string {
  const constraintName = `${foreignKey.sourceTable}_${foreignKey.sourceColumns.join('_')}_fkey`;
  return `ALTER TABLE ${quoteIdentifier(foreignKey.sourceTable)} DROP CONSTRAINT ${constraintName};`;
}

function formatDataCopy(
  oldModel: Model,
  newModel: Model,
  oldEnumNames: Set<string>,
  newEnumNames: Set<string>,
  oldModelNames: Set<string>,
  newModelNames: Set<string>,
  quotedTable: string,
  quotedStaging: string,
): string | null {
  const oldFields = new Map(
    getStoredFields(oldModel, oldModelNames).map((field) => [field.name, field]),
  );
  const sharedFields = getStoredFields(newModel, newModelNames).filter((field) =>
    oldFields.has(field.name),
  );

  if (sharedFields.length === 0) {
    return null;
  }

  const targetColumns = sharedFields.map((field) => toSnakeCase(field.name)).join(', ');
  const selectColumns = sharedFields
    .map((field) => {
      const columnName = toSnakeCase(field.name);
      const oldType = serializeColumnType(oldFields.get(field.name)!.type, oldEnumNames);
      const newType = serializeColumnType(field.type, newEnumNames);
      if (oldType === newType) {
        return columnName;
      }
      return `${columnName}::${newType}`;
    })
    .join(', ');

  return `INSERT INTO ${quotedTable} (${targetColumns})\nSELECT ${selectColumns}\nFROM ${quotedStaging};`;
}
