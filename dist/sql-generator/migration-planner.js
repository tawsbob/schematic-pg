import { flattenPartitions, partitionStrategySignature, } from './generators/partitions.js';
import { collectForeignKeys, functionIdentity, functionSignature, getDirectives, getEnumNames, getModelNames, getStoredFields, isStoredField, normalizeFunction, normalizeIndexDirective, normalizeTriggerDirective, parseForeignKeySignature, serializeColumnType, serializeDefault, serializeForeignKey, } from './utils/ast-helpers.js';
import { toTableName } from './utils/snake-case.js';
export class MigrationPlanner {
    generateMigration(oldSchema, newSchema) {
        const migrations = [];
        migrations.push(...this.diffExtensions(oldSchema, newSchema));
        migrations.push(...this.diffEnums(oldSchema, newSchema));
        migrations.push(...this.diffModels(oldSchema, newSchema));
        migrations.push(...this.diffPartitions(oldSchema, newSchema));
        migrations.push(...this.diffConstraints(oldSchema, newSchema));
        migrations.push(...this.diffIndexes(oldSchema, newSchema));
        migrations.push(...this.diffFunctions(oldSchema, newSchema));
        migrations.push(...this.diffTriggers(oldSchema, newSchema));
        return this.suppressMigrationsCoveredByConvert(migrations);
    }
    diffExtensions(oldSchema, newSchema) {
        const migrations = [];
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
    diffEnums(oldSchema, newSchema) {
        const migrations = [];
        const oldEnums = new Map(oldSchema.enums.map((enumDef) => [enumDef.name, enumDef]));
        const newEnums = new Map(newSchema.enums.map((enumDef) => [enumDef.name, enumDef]));
        for (const [enumName, enumDef] of newEnums) {
            if (!oldEnums.has(enumName)) {
                migrations.push({ kind: 'CreateEnum', enumName });
                continue;
            }
            const oldValues = oldEnums.get(enumName).values;
            for (const value of enumDef.values) {
                if (!oldValues.includes(value)) {
                    migrations.push({ kind: 'AddEnumValue', enumName, value });
                }
            }
        }
        return migrations;
    }
    diffModels(oldSchema, newSchema) {
        const migrations = [];
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
            const oldFields = new Map(getStoredFields(oldModel, oldModelNames).map((field) => [field.name, field]));
            const newFields = new Map(getStoredFields(newModel, newModelNames).map((field) => [field.name, field]));
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
    diffPartitions(oldSchema, newSchema) {
        const migrations = [];
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
                throw new Error(`Unsupported partition change on model "${modelName}": changing partition strategy or key requires a manual migration.`);
            }
            if (!newModel.partition) {
                continue;
            }
            const oldPartitions = new Map(flattenPartitions(oldModel).map((partition) => [partition.name, partition]));
            const newPartitions = new Map(flattenPartitions(newModel).map((partition) => [partition.name, partition]));
            const droppedNames = new Set();
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
                    throw new Error(`Unsupported partition change on model "${modelName}": partition "${name}" bounds/values changed. Drop the old partition and add a new one (manual data move if needed).`);
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
    isDescendantOfDropped(partition, all, droppedNames) {
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
    isUnderParent(partition, ancestorTable, all) {
        let current = partition;
        const visited = new Set();
        while (current) {
            if (current.parentTable === ancestorTable) {
                return true;
            }
            if (visited.has(current.name)) {
                break;
            }
            visited.add(current.name);
            current = [...all.values()].find((item) => item.tableName === current.parentTable);
        }
        return false;
    }
    diffField(modelName, oldField, newField, oldEnumNames, newEnumNames) {
        const migrations = [];
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
    diffConstraints(oldSchema, newSchema) {
        const migrations = [];
        const oldKeys = new Map(collectForeignKeys(oldSchema).map((foreignKey) => [serializeForeignKey(foreignKey), foreignKey]));
        const newKeys = new Map(collectForeignKeys(newSchema).map((foreignKey) => [serializeForeignKey(foreignKey), foreignKey]));
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
    diffIndexes(oldSchema, newSchema) {
        const migrations = [];
        const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
        const newModels = new Map(newSchema.models.map((model) => [model.name, model]));
        const oldModelNames = getModelNames(oldSchema);
        const newModelNames = getModelNames(newSchema);
        for (const [modelName, newModel] of newModels) {
            const oldModel = oldModels.get(modelName);
            const oldIndexes = oldModel
                ? this.indexSignatures(oldModel, oldModelNames)
                : new Set();
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
        return migrations;
    }
    diffTriggers(oldSchema, newSchema) {
        const migrations = [];
        const oldModels = new Map(oldSchema.models.map((model) => [model.name, model]));
        const newModels = new Map(newSchema.models.map((model) => [model.name, model]));
        for (const [modelName, newModel] of newModels) {
            const oldModel = oldModels.get(modelName);
            const oldTriggers = oldModel ? this.triggerSignatures(oldModel) : new Set();
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
    diffFunctions(oldSchema, newSchema) {
        const migrations = [];
        const oldEnumNames = getEnumNames(oldSchema);
        const newEnumNames = getEnumNames(newSchema);
        const oldFunctions = new Map(oldSchema.functions.map((sqlFunction) => [
            sqlFunction.name,
            normalizeFunction(sqlFunction, oldEnumNames),
        ]));
        const newFunctions = new Map(newSchema.functions.map((sqlFunction) => [
            sqlFunction.name,
            normalizeFunction(sqlFunction, newEnumNames),
        ]));
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
    triggerSignatures(model) {
        return new Set(getDirectives(model, 'trigger').map((directive) => JSON.stringify(normalizeTriggerDirective(directive))));
    }
    indexSignatures(model, modelNames) {
        return new Set(getDirectives(model, 'index').map((directive) => JSON.stringify(normalizeIndexDirective(directive, model, modelNames))));
    }
    suppressMigrationsCoveredByConvert(migrations) {
        const convertedModels = new Set(migrations
            .filter((migration) => migration.kind === 'ConvertToPartitioned' ||
            migration.kind === 'ConvertFromPartitioned')
            .map((migration) => migration.modelName));
        if (convertedModels.size === 0) {
            return migrations;
        }
        const convertedTables = new Set([...convertedModels].map((modelName) => toTableName(modelName)));
        return migrations.filter((migration) => {
            if (migration.kind === 'AddColumn' ||
                migration.kind === 'DropColumn' ||
                migration.kind === 'AlterColumn' ||
                migration.kind === 'CreateIndex' ||
                migration.kind === 'DropIndex' ||
                migration.kind === 'CreateTrigger' ||
                migration.kind === 'DropTrigger') {
                return !convertedModels.has(migration.modelName);
            }
            if (migration.kind === 'AddConstraint' || migration.kind === 'DropConstraint') {
                if (migration.constraintType !== 'foreignKey') {
                    return true;
                }
                const foreignKey = parseForeignKeySignature(migration.details);
                return (!convertedTables.has(foreignKey.sourceTable) &&
                    !convertedTables.has(foreignKey.targetTable));
            }
            return true;
        });
    }
}
export function getStoredFieldNames(model, modelNames) {
    return model.fields.filter((field) => isStoredField(field, modelNames)).map((field) => field.name);
}
