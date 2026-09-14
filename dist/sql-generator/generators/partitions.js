import { escapeSqlString } from '../utils/value-formatter.js';
import { quoteIdentifier, toSnakeCase, toTableName } from '../utils/snake-case.js';
export function formatPartitionBy(spec) {
    const strategy = spec.by;
    if (spec.expression) {
        return `PARTITION BY ${strategy} (${spec.expression})`;
    }
    const columns = (spec.fields ?? []).map((field) => toSnakeCase(field)).join(', ');
    return `PARTITION BY ${strategy} (${columns})`;
}
export function resolvePartitionTableName(partition) {
    if (partition.sqlName) {
        return partition.sqlName;
    }
    return toTableName(partition.name);
}
export function flattenPartitions(model) {
    if (!model.partition) {
        return [];
    }
    return flattenPartitionSpec(model, model.partition, toTableName(model.name));
}
function flattenPartitionSpec(model, spec, parentTable) {
    const results = [];
    if (spec.by === 'HASH' && spec.count !== undefined) {
        for (let remainder = 0; remainder < spec.count; remainder++) {
            const name = `${toPascalCase(parentTable)}P${remainder}`;
            const tableName = `${parentTable}_p${remainder}`;
            const values = {
                kind: 'hash',
                modulus: spec.count,
                remainder,
            };
            results.push({
                modelName: model.name,
                name,
                tableName,
                parentTable,
                values,
                signature: JSON.stringify(values),
            });
        }
        return results;
    }
    for (const partition of spec.partitions) {
        const tableName = resolvePartitionTableName(partition);
        const values = normalizePartitionValues(spec, partition);
        const nestedBy = partition.partition ? formatPartitionBy(partition.partition) : undefined;
        results.push({
            modelName: model.name,
            name: partition.name,
            tableName,
            parentTable,
            values,
            partitionBy: nestedBy,
            signature: JSON.stringify({ values, partitionBy: nestedBy ?? null }),
        });
        if (partition.partition) {
            results.push(...flattenPartitionSpec(model, partition.partition, tableName));
        }
    }
    return results;
}
function normalizePartitionValues(spec, partition) {
    if (spec.by === 'RANGE') {
        return {
            kind: 'range',
            from: formatPartitionBound(partition.from),
            to: formatPartitionBound(partition.to),
        };
    }
    if (spec.by === 'LIST') {
        if (partition.default) {
            return { kind: 'default' };
        }
        return {
            kind: 'list',
            values: (partition.in ?? []).map(formatPartitionBound),
        };
    }
    return {
        kind: 'hash',
        modulus: partition.modulus,
        remainder: partition.remainder,
    };
}
export function formatPartitionBound(value) {
    return formatBoundValue(value);
}
function formatBoundValue(value) {
    switch (value.kind) {
        case 'StringLiteral':
            return `'${escapeSqlString(value.value)}'`;
        case 'NumberLiteral':
            return String(value.value);
        case 'BooleanLiteral':
            return value.value ? 'true' : 'false';
        case 'Identifier': {
            const upper = value.name.toUpperCase();
            if (upper === 'MINVALUE' || upper === 'MAXVALUE' || upper === 'NULL') {
                return upper;
            }
            return `'${escapeSqlString(value.name)}'`;
        }
        case 'ArrayLiteral':
            return value.elements.map(formatBoundValue).join(', ');
        default:
            throw new Error(`Unsupported partition bound kind: ${value.kind}`);
    }
}
export function formatPartitionOfClause(partition) {
    const table = quoteIdentifier(partition.tableName);
    const parent = quoteIdentifier(partition.parentTable);
    const valuesClause = formatValuesClause(partition.values);
    const partitionBy = partition.partitionBy ? `\n  ${partition.partitionBy}` : '';
    return `CREATE TABLE ${table} PARTITION OF ${parent}\n  ${valuesClause}${partitionBy};`;
}
function formatValuesClause(values) {
    switch (values.kind) {
        case 'range':
            return `FOR VALUES FROM (${values.from}) TO (${values.to})`;
        case 'list':
            return `FOR VALUES IN (${values.values.join(', ')})`;
        case 'default':
            return 'DEFAULT';
        case 'hash':
            return `FOR VALUES WITH (MODULUS ${values.modulus}, REMAINDER ${values.remainder})`;
    }
}
export function formatDetachAndDropPartition(partition) {
    const parent = quoteIdentifier(partition.parentTable);
    const table = quoteIdentifier(partition.tableName);
    return `ALTER TABLE ${parent} DETACH PARTITION ${table};\nDROP TABLE ${table} CASCADE;`;
}
function toPascalCase(snake) {
    return snake
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
export function partitionStrategySignature(spec) {
    if (!spec) {
        return null;
    }
    return JSON.stringify({
        by: spec.by,
        fields: spec.fields ?? null,
        expression: spec.expression ?? null,
        count: spec.count ?? null,
    });
}
