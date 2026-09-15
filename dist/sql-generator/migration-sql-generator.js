import { generateAddEnumValue, generateEnum } from './generators/enums.js';
import { generateCreateExtension, generateDropExtension } from './generators/extensions.js';
import { generateForeignKey } from './generators/foreign-keys.js';
import { generateCreateFunction, generateDropFunction, } from './generators/functions.js';
import { generateCreateIndex, generateDropIndex, } from './generators/indexes.js';
import { flattenPartitions, formatDetachAndDropPartition, formatPartitionOfClause, } from './generators/partitions.js';
import { generateColumnDefinition, generateTable } from './generators/tables.js';
import { generateCreateTrigger, generateDropTrigger, } from './generators/triggers.js';
import { getDirectives, getDefaultExpression, getEnumNames, getModelNames, getStoredFields, normalizeFunction, normalizeIndexDirective, normalizeTriggerDirective, parseForeignKeySignature, } from './utils/ast-helpers.js';
import { quoteIdentifier, toSnakeCase, toTableName } from './utils/snake-case.js';
const MIGRATION_ORDER = {
    CreateExtension: 0,
    CreateEnum: 1,
    AddEnumValue: 2,
    CreateTable: 3,
    AddColumn: 4,
    CreatePartition: 5,
    AlterColumn: 6,
    CreateIndex: 7,
    AddConstraint: 8,
    DropColumn: 9,
    DropConstraint: 10,
    DropIndex: 11,
    DropFunction: 12,
    CreateFunction: 13,
    ReplaceFunction: 14,
    CreateTrigger: 15,
    DropTrigger: 16,
    DropPartition: 17,
    DropTable: 18,
    DropExtension: 19,
};
export class MigrationSqlGenerator {
    generate(migrations, newSchema) {
        if (migrations.length === 0) {
            return '';
        }
        const enumNames = getEnumNames(newSchema);
        const modelNames = getModelNames(newSchema);
        const modelMap = new Map(newSchema.models.map((model) => [model.name, model]));
        const enumMap = new Map(newSchema.enums.map((enumDef) => [enumDef.name, enumDef]));
        const functionMap = new Map(newSchema.functions.map((sqlFunction) => [sqlFunction.name, sqlFunction]));
        const ordered = [...migrations].sort((left, right) => MIGRATION_ORDER[left.kind] - MIGRATION_ORDER[right.kind]);
        const statements = ordered.map((migration) => this.migrationToSql(migration, {
            newSchema,
            enumNames,
            modelNames,
            modelMap,
            enumMap,
            functionMap,
        }));
        return `${statements.join('\n\n')}\n`;
    }
    migrationToSql(migration, context) {
        const { enumNames, modelNames, modelMap, enumMap, functionMap } = context;
        switch (migration.kind) {
            case 'CreateExtension':
                return generateCreateExtension(migration.extensionName);
            case 'DropExtension':
                return generateDropExtension(migration.extensionName);
            case 'CreateEnum': {
                const enumDef = enumMap.get(migration.enumName);
                if (!enumDef) {
                    throw new Error(`Enum "${migration.enumName}" not found in new schema`);
                }
                return generateEnum(enumDef);
            }
            case 'AddEnumValue':
                return generateAddEnumValue(migration.enumName, migration.value);
            case 'CreateTable': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                return generateTable(model, enumNames, modelNames);
            }
            case 'AddColumn': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const field = this.getField(model, migration.fieldName, modelNames);
                const columnDef = generateColumnDefinition(field, model, enumNames, modelNames);
                const tableName = quoteIdentifier(toTableName(model.name));
                return `ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`;
            }
            case 'DropColumn': {
                const tableName = quoteIdentifier(toTableName(migration.modelName));
                const columnName = toSnakeCase(migration.fieldName);
                return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
            }
            case 'AlterColumn': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const field = this.getField(model, migration.fieldName, modelNames);
                const tableName = quoteIdentifier(toTableName(model.name));
                const columnName = toSnakeCase(migration.fieldName);
                switch (migration.change.type) {
                    case 'type':
                        return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${migration.change.to} USING ${columnName}::${migration.change.to};`;
                    case 'nullability':
                        return migration.change.to
                            ? `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP NOT NULL;`
                            : `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET NOT NULL;`;
                    case 'default': {
                        const defaultExpression = getDefaultExpression(field, enumNames);
                        return defaultExpression
                            ? `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET DEFAULT ${defaultExpression};`
                            : `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP DEFAULT;`;
                    }
                }
            }
            case 'DropTable': {
                const tableName = quoteIdentifier(toTableName(migration.modelName));
                return `DROP TABLE IF EXISTS ${tableName} CASCADE;`;
            }
            case 'CreatePartition': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const partition = flattenPartitions(model).find((item) => item.name === migration.partitionName);
                if (!partition) {
                    throw new Error(`Partition "${migration.partitionName}" not found on model "${migration.modelName}"`);
                }
                return formatPartitionOfClause(partition);
            }
            case 'DropPartition':
                return formatDetachAndDropPartition({
                    modelName: migration.modelName,
                    name: migration.partitionName,
                    tableName: migration.tableName,
                    parentTable: migration.parentTable,
                    values: { kind: 'default' },
                    signature: '',
                });
            case 'CreateIndex': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const normalized = this.findIndexBySignature(model, migration.signature, modelNames);
                return generateCreateIndex(model, normalized);
            }
            case 'DropIndex': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const normalized = JSON.parse(migration.signature);
                return generateDropIndex(model, normalized);
            }
            case 'AddConstraint': {
                if (migration.constraintType !== 'foreignKey') {
                    throw new Error(`Unsupported constraint type: ${migration.constraintType}`);
                }
                return generateForeignKey(parseForeignKeySignature(migration.details));
            }
            case 'DropConstraint': {
                if (migration.constraintType !== 'foreignKey') {
                    throw new Error(`Unsupported constraint type: ${migration.constraintType}`);
                }
                const foreignKey = parseForeignKeySignature(migration.details);
                const constraintName = `${foreignKey.sourceTable}_${foreignKey.sourceColumns.join('_')}_fkey`;
                return `ALTER TABLE ${quoteIdentifier(foreignKey.sourceTable)} DROP CONSTRAINT ${constraintName};`;
            }
            case 'CreateTrigger': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const normalized = this.findTriggerBySignature(model, migration.signature);
                return generateCreateTrigger(model, normalized);
            }
            case 'DropTrigger': {
                const model = modelMap.get(migration.modelName);
                if (!model) {
                    throw new Error(`Model "${migration.modelName}" not found in new schema`);
                }
                const normalized = JSON.parse(migration.signature);
                return generateDropTrigger(model, normalized);
            }
            case 'CreateFunction':
            case 'ReplaceFunction': {
                const sqlFunction = functionMap.get(migration.functionName);
                if (!sqlFunction) {
                    throw new Error(`Function "${migration.functionName}" not found in new schema`);
                }
                return generateCreateFunction(normalizeFunction(sqlFunction, enumNames));
            }
            case 'DropFunction': {
                const normalized = JSON.parse(migration.signature);
                return generateDropFunction(normalized);
            }
            default: {
                const exhaustive = migration;
                throw new Error(`Unsupported migration kind: ${exhaustive.kind}`);
            }
        }
    }
    getField(model, fieldName, modelNames) {
        const field = getStoredFields(model, modelNames).find((item) => item.name === fieldName);
        if (!field) {
            throw new Error(`Field "${fieldName}" not found on model "${model.name}"`);
        }
        return field;
    }
    findIndexBySignature(model, signature, modelNames) {
        for (const directive of getDirectives(model, 'index')) {
            const normalized = normalizeIndexDirective(directive, model, modelNames);
            if (JSON.stringify(normalized) === signature) {
                return normalized;
            }
        }
        throw new Error(`Index signature not found on model "${model.name}"`);
    }
    findTriggerBySignature(model, signature) {
        for (const directive of getDirectives(model, 'trigger')) {
            const normalized = normalizeTriggerDirective(directive);
            if (JSON.stringify(normalized) === signature) {
                return normalized;
            }
        }
        throw new Error(`Trigger signature not found on model "${model.name}"`);
    }
}
