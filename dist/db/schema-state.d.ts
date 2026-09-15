import type { Schema } from '../schema-dsl/ast.js';
export declare function getSnapshotPath(cwd?: string): string;
export declare function snapshotExists(cwd?: string): boolean;
export declare function readSnapshotSource(cwd?: string): string | null;
export declare function readSnapshotSchema(cwd?: string): Schema | null;
export declare function writeSnapshotSource(source: string, cwd?: string): void;
export declare function writeSnapshot(sourcePath: string, cwd?: string): void;
export declare function ensureSnapshot(schemaPath: string, cwd?: string): void;
