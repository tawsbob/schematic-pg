import type { Schema } from '../schema-dsl/ast.js';
import type { Migration } from './migration-types.js';
export declare class MigrationSqlGenerator {
    generate(migrations: Migration[], newSchema: Schema, oldSchema?: Schema): string;
    private migrationToSql;
    private getField;
    private findIndexBySignature;
    private findTriggerBySignature;
}
