import { DatabaseClient } from './client.js';
export declare function generateBootstrapSql(schemaPath?: string): string;
export declare function bootstrapDatabase(schemaPath?: string, client?: Pick<DatabaseClient, 'withClient'>): Promise<void>;
