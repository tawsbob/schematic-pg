import type { Schema } from '../../schema-dsl/ast.js';
export type PartitionConvertKind = 'ConvertToPartitioned' | 'ConvertFromPartitioned';
export declare function generatePartitionConvertSql(kind: PartitionConvertKind, modelName: string, oldSchema: Schema, newSchema: Schema): string;
