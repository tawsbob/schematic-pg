import type { Model, Schema } from '../schema-dsl/ast.js';
import type { Migration } from './migration-types.js';
export declare class MigrationPlanner {
    generateMigration(oldSchema: Schema, newSchema: Schema): Migration[];
    private diffExtensions;
    private diffEnums;
    private diffModels;
    private diffPartitions;
    private isDescendantOfDropped;
    private isUnderParent;
    private diffField;
    private diffConstraints;
    private diffIndexes;
    private diffViews;
    private viewColumnSignature;
    private diffTriggers;
    private diffFunctions;
    private triggerSignatures;
    private indexSignatures;
    private suppressMigrationsCoveredByConvert;
}
export declare function getStoredFieldNames(model: Model, modelNames: Set<string>): string[];
