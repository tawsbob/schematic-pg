import type { Model, Partition, PartitionBound, PartitionSpec } from '../../schema-dsl/ast.js';
export type PartitionValues = {
    kind: 'range';
    from: string;
    to: string;
} | {
    kind: 'list';
    values: string[];
} | {
    kind: 'default';
} | {
    kind: 'hash';
    modulus: number;
    remainder: number;
};
export interface NormalizedPartition {
    modelName: string;
    name: string;
    tableName: string;
    parentTable: string;
    values: PartitionValues;
    /** PARTITION BY clause for this table when it is itself partitioned (nested). */
    partitionBy?: string;
    /** Signature used for migration equality (bounds / list / hash). */
    signature: string;
}
export declare function formatPartitionBy(spec: PartitionSpec): string;
export declare function resolvePartitionTableName(partition: Partition): string;
export declare function flattenPartitions(model: Model): NormalizedPartition[];
export declare function formatPartitionBound(value: PartitionBound): string;
export declare function formatPartitionOfClause(partition: NormalizedPartition): string;
export declare function formatDetachAndDropPartition(partition: NormalizedPartition): string;
export declare function partitionStrategySignature(spec: PartitionSpec | undefined): string | null;
