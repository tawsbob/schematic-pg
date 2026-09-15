import type { Migration } from '../sql-generator/migration-types.js';
export interface DiffResult {
    migrations: Migration[];
    sql: string;
    hasDestructiveChanges: boolean;
}
export declare function generateSchemaDiff(schemaPath?: string, cwd?: string): DiffResult;
export declare function summarizeMigrations(migrations: Migration[]): Map<string, number>;
export declare function defaultSchemaPath(cwd?: string): string;
