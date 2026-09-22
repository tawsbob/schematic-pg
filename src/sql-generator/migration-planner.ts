import type { Field, Model, Schema, View } from '../schema-dsl/ast.js';
import type { Migration } from './migration-types.js';
import { normalizeCronJob } from './generators/cron-jobs.js';
import {
  flattenPartitions,
  partitionStrategySignature,
  type NormalizedPartition,
} from './generators/partitions.js';
import {
  collectForeignKeys,
  functionIdentity,
  functionSignature,
  getDirectives,
  getEnumNames,
  getModelNames,
  getStoredFields,
  isStoredField,
  normalizeFunction,
  normalizeIndexDirective,
  normalizeTriggerDirective,
  normalizeUniqueDirective,
  parseForeignKeySignature,
  serializeColumnType,
  serializeDefault,
  serializeForeignKey,
  serializeUniqueConstraint,
} from './utils/ast-helpers.js';
import { toTableName } from './utils/snake-case.js';

export class MigrationPlanner {
  generateMigration(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    migrations.push(...this.diffExtensions(oldSchema, newSchema));
    migrations.push(...this.diffEnums(oldSchema, newSchema));
    migrations.push(...this.diffModels(oldSchema, newSchema));
    migrations.push(...this.diffPartitions(oldSchema, newSchema));
    migrations.push(...this.diffConstraints(oldSchema, newSchema));
    migrations.push(...this.diffUniqueConstraints(oldSchema, newSchema));
    const viewMigrations = this.diffViews(oldSchema, newSchema);
    migrations.push(...viewMigrations);
    migrations.push(...this.diffIndexes(oldSchema, newSchema, viewMigrations));
    migrations.push(...this.diffFunctions(oldSchema, newSchema));
    migrations.push(...this.diffTriggers(oldSchema, newSchema));
    migrations.push(...this.diffCronJobs(oldSchema, newSchema));
    return this.suppressMigrationsCoveredByConvert(migrations);
  }

  private diffExtensions(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldNames = new Set(oldSchema.extensions.map((extension) => extension.name));
    const newNames = new Set(newSchema.extensions.map((extension) => extension.name));

    for (const name of newNames) {
      if (!oldNames.has(name)) {
        migrations.push({ kind: 'CreateExtension', extensionName: name });
      }
    }

    for (const name of oldNames) {
      if (!newNames.has(name)) {
        migrations.push({ kind: 'DropExtension', extensionName: name });
      }
    }

    return migrations;
  }

  private diffEnums(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldEnums = new Map(oldSchema.enums.map((enumDef) => [enumDef.name, enumDef]));
    const newEnums = new Map(newSchema.enums.map((enumDef) => [enumDef.name, enumDef]));

    for (const [enumName, enumDef] of newEnums) {
      if (!oldEnums.has(enumName)) {
        migrations.push({ kind: 'CreateEnum', enumName });
        continue;
      }

      const oldValues = oldEnums.get(enumName)!.values;
      for (const value of enumDef.values) {
        if (!oldValues.includes(value)) {
          migrations.push({ kind: 'AddEnumValue', enumName, value });
        }
      }
    }

    return migrations;
  }

  private diffModels(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
    const newModels = new Map(newSchema.models.map((model) => [model.name, model]));
    const oldModelNames = getModelNames(oldSchema);
    const newModelNames = getModelNames(newSchema);
    const oldEnumNames = getEnumNames(oldSchema);
    const newEnumNames = getEnumNames(newSchema);

    for (const [modelName] of newModels) {
      if (!oldModels.has(modelName)) {
        migrations.push({ kind: 'CreateTable', modelName });
      }
    }

    for (const [modelName] of oldModels) {
      if (!newModels.has(modelName)) {
        migrations.push({ kind: 'DropTable', modelName });
      }
    }

    for (const [modelName, newModel] of newModels) {
      const oldModel = oldModels.get(modelName);
      if (!oldModel) {
        continue;
      }

      const oldFields = new Map(
        getStoredFields(oldModel, oldModelNames).map((field) => [field.name, field]),
      );
      const newFields = new Map(
        getStoredFields(newModel, newModelNames).map((field) => [field.name, field]),
      );

      for (const [fieldName] of newFields) {
        if (!oldFields.has(fieldName)) {
          migrations.push({ kind: 'AddColumn', modelName, fieldName });
        }
      }

      for (const [fieldName] of oldFields) {
        if (!newFields.has(fieldName)) {
          migrations.push({ kind: 'DropColumn', modelName, fieldName });
        }
      }

      for (const [fieldName, newField] of newFields) {
        const oldField = oldFields.get(fieldName);
        if (!oldField) {
          continue;
        }

        migrations.push(...this.diffField(modelName, oldField, newField, oldEnumNames, newEnumNames));
      }
    }

    return migrations;
  }

  private diffPartitions(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
    const newModels = new Map(newSchema.models.map((model) => [model.name, model]));

    for (const [modelName, newModel] of newModels) {
      const oldModel = oldModels.get(modelName);

      if (!oldModel) {
        for (const partition of flattenPartitions(newModel)) {
          migrations.push({
            kind: 'CreatePartition',
            modelName,
            partitionName: partition.name,
          });
        }
        continue;
      }

      const oldStrategy = partitionStrategySignature(oldModel.partition);
      const newStrategy = partitionStrategySignature(newModel.partition);

      if (oldStrategy !== newStrategy) {
        if (oldStrategy === null && newStrategy !== null) {
          migrations.push({ kind: 'ConvertToPartitioned', modelName });
          continue;
        }
        if (oldStrategy !== null && newStrategy === null) {
          migrations.push({ kind: 'ConvertFromPartitioned', modelName });
          continue;
        }
        throw new Error(
          `Unsupported partition change on model "${modelName}": changing partition strategy or key requires a manual migration.`,
        );
      }

      if (!newModel.partition) {
        continue;
      }

      const oldPartitions = new Map(
        flattenPartitions(oldModel).map((partition) => [partition.name, partition]),
      );
      const newPartitions = new Map(
        flattenPartitions(newModel).map((partition) => [partition.name, partition]),
      );

      const droppedNames = new Set<string>();
      for (const [name] of oldPartitions) {
        if (!newPartitions.has(name)) {
          droppedNames.add(name);
        }
      }

      for (const [name, newPartition] of newPartitions) {
        const oldPartition = oldPartitions.get(name);
        if (!oldPartition) {
          migrations.push({
            kind: 'CreatePartition',
            modelName,
            partitionName: name,
          });
          continue;
        }

        if (oldPartition.signature !== newPartition.signature) {
          throw new Error(
            `Unsupported partition change on model "${modelName}": partition "${name}" bounds/values changed. Drop the old partition and add a new one (manual data move if needed).`,
          );
        }
      }

      for (const [name, oldPartition] of oldPartitions) {
        if (!newPartitions.has(name)) {
          if (this.isDescendantOfDropped(oldPartition, oldPartitions, droppedNames)) {
            continue;
          }
          migrations.push({
            kind: 'DropPartition',
            modelName,
            partitionName: name,
            parentTable: oldPartition.parentTable,
            tableName: oldPartition.tableName,
          });
        }
      }
    }

    return migrations;
  }

  private isDescendantOfDropped(
    partition: NormalizedPartition,
    all: Map<string, NormalizedPartition>,
    droppedNames: Set<string>,
  ): boolean {
    for (const name of droppedNames) {
      if (name === partition.name) {
        continue;
      }
      const ancestor = all.get(name);
      if (!ancestor) {
        continue;
      }
      if (this.isUnderParent(partition, ancestor.tableName, all)) {
        return true;
      }
    }
    return false;
  }

  private isUnderParent(
    partition: NormalizedPartition,
    ancestorTable: string,
    all: Map<string, NormalizedPartition>,
  ): boolean {
    let current: NormalizedPartition | undefined = partition;
    const visited = new Set<string>();
    while (current) {
      if (current.parentTable === ancestorTable) {
        return true;
      }
      if (visited.has(current.name)) {
        break;
      }
      visited.add(current.name);
      current = [...all.values()].find((item) => item.tableName === current!.parentTable);
    }
    return false;
  }

  private diffField(
    modelName: string,
    oldField: Field,
    newField: Field,
    oldEnumNames: Set<string>,
    newEnumNames: Set<string>,
  ): Migration[] {
    const migrations: Migration[] = [];
    const oldType = serializeColumnType(oldField.type, oldEnumNames);
    const newType = serializeColumnType(newField.type, newEnumNames);

    if (oldType !== newType) {
      migrations.push({
        kind: 'AlterColumn',
        modelName,
        fieldName: oldField.name,
        change: { type: 'type', from: oldType, to: newType },
      });
    }

    const oldOptional = Boolean(oldField.type.optional);
    const newOptional = Boolean(newField.type.optional);
    if (oldOptional !== newOptional) {
      migrations.push({
        kind: 'AlterColumn',
        modelName,
        fieldName: oldField.name,
        change: { type: 'nullability', from: oldOptional, to: newOptional },
      });
    }

    const oldDefault = serializeDefault(oldField, oldEnumNames);
    const newDefault = serializeDefault(newField, newEnumNames);
    if (oldDefault !== newDefault) {
      migrations.push({
        kind: 'AlterColumn',
        modelName,
        fieldName: oldField.name,
        change: { type: 'default', from: oldDefault, to: newDefault },
      });
    }

    return migrations;
  }

  private diffConstraints(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldKeys = new Map(
      collectForeignKeys(oldSchema).map((foreignKey) => [serializeForeignKey(foreignKey), foreignKey]),
    );
    const newKeys = new Map(
      collectForeignKeys(newSchema).map((foreignKey) => [serializeForeignKey(foreignKey), foreignKey]),
    );

    for (const [signature, foreignKey] of newKeys) {
      if (!oldKeys.has(signature)) {
        migrations.push({
          kind: 'AddConstraint',
          modelName: foreignKey.sourceModel,
          constraintType: 'foreignKey',
          details: signature,
        });
      }
    }

    for (const [signature, foreignKey] of oldKeys) {
      if (!newKeys.has(signature)) {
        migrations.push({
          kind: 'DropConstraint',
          modelName: foreignKey.sourceModel,
          constraintType: 'foreignKey',
          details: signature,
        });
      }
    }

    return migrations;
  }

  private diffUniqueConstraints(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
    const newModels = new Map(newSchema.models.map((model) => [model.name, model]));

    for (const [modelName, newModel] of newModels) {
      const oldModel = oldModels.get(modelName);
      if (!oldModel) {
        continue;
      }

      const oldUniques = this.uniqueSignatures(oldModel);
      const newUniques = this.uniqueSignatures(newModel);

      for (const signature of newUniques) {
        if (!oldUniques.has(signature)) {
          migrations.push({
            kind: 'AddConstraint',
            modelName,
            constraintType: 'unique',
            details: signature,
          });
        }
      }

      for (const signature of oldUniques) {
        if (!newUniques.has(signature)) {
          migrations.push({
            kind: 'DropConstraint',
            modelName,
            constraintType: 'unique',
            details: signature,
          });
        }
      }
    }

    return migrations;
  }

  private diffIndexes(
    oldSchema: Schema,
    newSchema: Schema,
    viewMigrations: Migration[],
  ): Migration[] {
    const migrations: Migration[] = [];
    const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
    const newModels = new Map(newSchema.models.map((model) => [model.name, model]));
    const oldModelNames = getModelNames(oldSchema);
    const newModelNames = getModelNames(newSchema);

    for (const [modelName, newModel] of newModels) {
      const oldModel = oldModels.get(modelName);
      const oldIndexes = oldModel
        ? this.indexSignatures(oldModel, oldModelNames)
        : new Set<string>();
      const newIndexes = this.indexSignatures(newModel, newModelNames);

      for (const signature of newIndexes) {
        if (!oldIndexes.has(signature)) {
          migrations.push({ kind: 'CreateIndex', modelName, signature });
        }
      }

      for (const signature of oldIndexes) {
        if (!newIndexes.has(signature)) {
          migrations.push({ kind: 'DropIndex', modelName, signature });
        }
      }
    }

    const recreatedMatviews = new Set(
      viewMigrations
        .filter(
          (migration) =>
            migration.kind === 'CreateMaterializedView' ||
            migration.kind === 'DropMaterializedView',
        )
        .map((migration) => migration.viewName),
    );

    const oldViews = new Map(oldSchema.views.map((view) => [view.name, view]));
    const newViews = new Map(newSchema.views.map((view) => [view.name, view]));

    for (const [viewName, newView] of newViews) {
      if (!newView.materialized || recreatedMatviews.has(viewName)) {
        continue;
      }

      const oldView = oldViews.get(viewName);
      if (!oldView?.materialized) {
        continue;
      }

      const oldIndexes = this.indexSignatures(oldView, oldModelNames);
      const newIndexes = this.indexSignatures(newView, newModelNames);

      for (const signature of newIndexes) {
        if (!oldIndexes.has(signature)) {
          migrations.push({ kind: 'CreateIndex', modelName: viewName, signature });
        }
      }

      for (const signature of oldIndexes) {
        if (!newIndexes.has(signature)) {
          migrations.push({ kind: 'DropIndex', modelName: viewName, signature });
        }
      }
    }

    return migrations;
  }

  private diffViews(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldEnumNames = getEnumNames(oldSchema);
    const newEnumNames = getEnumNames(newSchema);
    const oldViews = new Map(oldSchema.views.map((view) => [view.name, view]));
    const newViews = new Map(newSchema.views.map((view) => [view.name, view]));

    for (const [viewName, newView] of newViews) {
      const oldView = oldViews.get(viewName);
      if (!oldView) {
        migrations.push(
          newView.materialized
            ? { kind: 'CreateMaterializedView', viewName }
            : { kind: 'CreateView', viewName },
        );
        continue;
      }

      const kindChanged = oldView.materialized !== newView.materialized;
      const columnsChanged =
        this.viewColumnSignature(oldView, oldEnumNames) !==
        this.viewColumnSignature(newView, newEnumNames);
      const queryChanged = oldView.query.trim() !== newView.query.trim();

      if (kindChanged || columnsChanged || (newView.materialized && queryChanged)) {
        migrations.push(
          oldView.materialized
            ? { kind: 'DropMaterializedView', viewName }
            : { kind: 'DropView', viewName },
        );
        migrations.push(
          newView.materialized
            ? { kind: 'CreateMaterializedView', viewName }
            : { kind: 'CreateView', viewName },
        );
        continue;
      }

      if (!newView.materialized && queryChanged) {
        migrations.push({ kind: 'ReplaceView', viewName });
      }
    }

    for (const [viewName, oldView] of oldViews) {
      if (!newViews.has(viewName)) {
        migrations.push(
          oldView.materialized
            ? { kind: 'DropMaterializedView', viewName }
            : { kind: 'DropView', viewName },
        );
      }
    }

    return migrations;
  }

  private viewColumnSignature(view: View, enumNames: Set<string>): string {
    return JSON.stringify(
      view.columns.map((column) => ({
        name: column.name,
        type: serializeColumnType(column.type, enumNames),
        optional: Boolean(column.type.optional),
        array: Boolean(column.type.array),
      })),
    );
  }

  private diffTriggers(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
    const newModels = new Map(newSchema.models.map((model) => [model.name, model]));

    for (const [modelName, newModel] of newModels) {
      const oldModel = oldModels.get(modelName);
      const oldTriggers = oldModel ? this.triggerSignatures(oldModel) : new Set<string>();
      const newTriggers = this.triggerSignatures(newModel);

      for (const signature of newTriggers) {
        if (!oldTriggers.has(signature)) {
          migrations.push({ kind: 'CreateTrigger', modelName, signature });
        }
      }

      for (const signature of oldTriggers) {
        if (!newTriggers.has(signature)) {
          migrations.push({ kind: 'DropTrigger', modelName, signature });
        }
      }
    }

    return migrations;
  }

  private diffFunctions(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldEnumNames = getEnumNames(oldSchema);
    const newEnumNames = getEnumNames(newSchema);
    const oldFunctions = new Map(
      oldSchema.functions.map((sqlFunction) => [
        sqlFunction.name,
        normalizeFunction(sqlFunction, oldEnumNames),
      ]),
    );
    const newFunctions = new Map(
      newSchema.functions.map((sqlFunction) => [
        sqlFunction.name,
        normalizeFunction(sqlFunction, newEnumNames),
      ]),
    );

    for (const [functionName, newFunction] of newFunctions) {
      const oldFunction = oldFunctions.get(functionName);
      if (!oldFunction) {
        migrations.push({ kind: 'CreateFunction', functionName });
        continue;
      }

      if (functionIdentity(oldFunction) !== functionIdentity(newFunction)) {
        migrations.push({
          kind: 'DropFunction',
          functionName,
          signature: functionSignature(oldFunction),
        });
        migrations.push({ kind: 'CreateFunction', functionName });
        continue;
      }

      if (functionSignature(oldFunction) !== functionSignature(newFunction)) {
        migrations.push({ kind: 'ReplaceFunction', functionName });
      }
    }

    for (const [functionName, oldFunction] of oldFunctions) {
      if (!newFunctions.has(functionName)) {
        migrations.push({
          kind: 'DropFunction',
          functionName,
          signature: functionSignature(oldFunction),
        });
      }
    }

    return migrations;
  }

  private diffCronJobs(oldSchema: Schema, newSchema: Schema): Migration[] {
    const migrations: Migration[] = [];
    const oldJobs = new Map(
      oldSchema.jobs.map((job) => [job.name, this.cronJobSignature(job)]),
    );
    const newJobs = new Map(
      newSchema.jobs.map((job) => [job.name, this.cronJobSignature(job)]),
    );

    for (const [jobName, newSignature] of newJobs) {
      const oldSignature = oldJobs.get(jobName);
      if (!oldSignature) {
        migrations.push({ kind: 'CreateCronJob', jobName });
        continue;
      }

      if (oldSignature !== newSignature) {
        migrations.push({ kind: 'ReplaceCronJob', jobName });
      }
    }

    for (const jobName of oldJobs.keys()) {
      if (!newJobs.has(jobName)) {
        migrations.push({ kind: 'DropCronJob', jobName });
      }
    }

    return migrations;
  }

  private cronJobSignature(job: Schema['jobs'][number]): string {
    return JSON.stringify(normalizeCronJob(job));
  }

  private triggerSignatures(model: Model): Set<string> {
    return new Set(
      getDirectives(model, 'trigger').map((directive) =>
        JSON.stringify(normalizeTriggerDirective(directive)),
      ),
    );
  }

  private indexSignatures(
    relation: Model | View,
    modelNames: Set<string>,
  ): Set<string> {
    return new Set(
      getDirectives(relation, 'index').map((directive) =>
        JSON.stringify(normalizeIndexDirective(directive, relation, modelNames)),
      ),
    );
  }

  private uniqueSignatures(model: Model): Set<string> {
    return new Set(
      getDirectives(model, 'unique').map((directive) =>
        serializeUniqueConstraint(normalizeUniqueDirective(directive)),
      ),
    );
  }

  private suppressMigrationsCoveredByConvert(migrations: Migration[]): Migration[] {
    const convertedModels = new Set(
      migrations
        .filter(
          (migration) =>
            migration.kind === 'ConvertToPartitioned' ||
            migration.kind === 'ConvertFromPartitioned',
        )
        .map((migration) => migration.modelName),
    );

    if (convertedModels.size === 0) {
      return migrations;
    }

    const convertedTables = new Set(
      [...convertedModels].map((modelName) => toTableName(modelName)),
    );

    return migrations.filter((migration) => {
      if (
        migration.kind === 'AddColumn' ||
        migration.kind === 'DropColumn' ||
        migration.kind === 'AlterColumn' ||
        migration.kind === 'CreateIndex' ||
        migration.kind === 'DropIndex' ||
        migration.kind === 'CreateTrigger' ||
        migration.kind === 'DropTrigger'
      ) {
        return !convertedModels.has(migration.modelName);
      }

      if (migration.kind === 'AddConstraint' || migration.kind === 'DropConstraint') {
        if (migration.constraintType === 'unique') {
          return !convertedModels.has(migration.modelName);
        }
        if (migration.constraintType !== 'foreignKey') {
          return true;
        }
        const foreignKey = parseForeignKeySignature(migration.details);
        return (
          !convertedTables.has(foreignKey.sourceTable) &&
          !convertedTables.has(foreignKey.targetTable)
        );
      }

      return true;
    });
  }
}

export function getStoredFieldNames(model: Model, modelNames: Set<string>): string[] {
  return model.fields.filter((field) => isStoredField(field, modelNames)).map((field) => field.name);
}
