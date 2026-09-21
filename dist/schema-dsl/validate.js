import { PRIMITIVE_TYPES } from './primitives.js';
import { toTableName } from '../sql-generator/utils/snake-case.js';
export class SchemaError extends Error {
    line;
    col;
    file;
    constructor(message, loc) {
        const location = loc.file
            ? `${loc.file}:${loc.line}:${loc.col}`
            : `line ${loc.line}, col ${loc.col}`;
        super(`Schema error at ${location}: ${message}`);
        this.name = 'SchemaError';
        this.line = loc.line;
        this.col = loc.col;
        this.file = loc.file;
    }
}
export function validateSchema(schema) {
    const modelNames = new Set(schema.models.map((model) => model.name));
    const partitionNames = new Map();
    for (const model of schema.models) {
        if (!model.partition) {
            continue;
        }
        validatePartitionSpec(model, model.partition, modelNames, partitionNames, 0);
    }
    validateIncomingForeignKeys(schema, modelNames);
    validateViews(schema);
}
function validatePartitionSpec(model, spec, modelNames, partitionNames, depth) {
    if (depth > 1) {
        throw new SchemaError('at most one level of nested @@partition is allowed', spec.loc);
    }
    const hasFields = Boolean(spec.fields && spec.fields.length > 0);
    const hasExpression = Boolean(spec.expression);
    if (hasFields && hasExpression) {
        throw new SchemaError('use either fields or expression, not both', spec.loc);
    }
    if (!hasFields && !hasExpression) {
        throw new SchemaError('@@partition requires fields or expression', spec.loc);
    }
    if (spec.fields) {
        const storedNames = new Set(model.fields.filter((field) => !modelNames.has(field.type.name)).map((field) => field.name));
        for (const fieldName of spec.fields) {
            if (!storedNames.has(fieldName)) {
                throw new SchemaError(`partition field "${fieldName}" is not a stored column on model "${model.name}"`, spec.loc);
            }
        }
    }
    if (spec.count !== undefined) {
        if (spec.by !== 'HASH') {
            throw new SchemaError('count is only valid for HASH partitions', spec.loc);
        }
        if (spec.partitions.length > 0) {
            throw new SchemaError('do not mix count with explicit partition blocks', spec.loc);
        }
        if (!Number.isInteger(spec.count) || spec.count < 1) {
            throw new SchemaError('count must be a positive integer', spec.loc);
        }
    }
    if (spec.by === 'HASH' && spec.count === undefined && spec.partitions.length > 0) {
        validateHashPartitions(spec);
    }
    if (spec.by === 'RANGE') {
        validateRangePartitions(spec);
    }
    if (spec.by === 'LIST') {
        validateListPartitions(spec);
    }
    if (depth === 0 && hasFields && spec.fields) {
        validateUniqueConstraintsIncludeKey(model, spec.fields, modelNames, spec.loc);
    }
    for (const partition of spec.partitions) {
        registerPartitionName(partition.name, partition.loc, partitionNames);
        validatePartitionChild(model, spec, partition, modelNames, partitionNames, depth);
    }
}
function validatePartitionChild(model, parentSpec, partition, modelNames, partitionNames, depth) {
    if (parentSpec.by === 'RANGE') {
        if (partition.default) {
            throw new SchemaError('RANGE partitions do not use default: true (use MINVALUE/MAXVALUE)', partition.loc);
        }
        if (partition.in) {
            throw new SchemaError('RANGE partitions use from/to, not in', partition.loc);
        }
        if (partition.modulus !== undefined || partition.remainder !== undefined) {
            throw new SchemaError('RANGE partitions do not use modulus/remainder', partition.loc);
        }
        if (!partition.from || !partition.to) {
            throw new SchemaError('RANGE partitions require from and to', partition.loc);
        }
    }
    if (parentSpec.by === 'LIST') {
        if (partition.modulus !== undefined || partition.remainder !== undefined) {
            throw new SchemaError('LIST partitions do not use modulus/remainder', partition.loc);
        }
        if (partition.from || partition.to) {
            throw new SchemaError('LIST partitions use in or default, not from/to', partition.loc);
        }
        if (partition.default && partition.in) {
            throw new SchemaError('default partitions cannot also set in', partition.loc);
        }
        if (!partition.default && !partition.in) {
            throw new SchemaError('LIST partitions require in: [...] or default: true', partition.loc);
        }
    }
    if (parentSpec.by === 'HASH') {
        if (partition.default || partition.in || partition.from || partition.to) {
            throw new SchemaError('HASH partitions use modulus and remainder', partition.loc);
        }
        if (partition.modulus === undefined || partition.remainder === undefined) {
            throw new SchemaError('HASH partitions require modulus and remainder', partition.loc);
        }
    }
    if (partition.partition) {
        validatePartitionSpec(model, partition.partition, modelNames, partitionNames, depth + 1);
    }
}
function validateRangePartitions(spec) {
    for (const partition of spec.partitions) {
        if (!partition.from || !partition.to) {
            continue;
        }
    }
    // Overlap detection for simple single-value bounds; composite keys are left to Postgres.
    const simpleBounds = spec.partitions
        .filter((partition) => partition.from && partition.to)
        .map((partition) => ({
        partition,
        from: serializeBoundForCompare(partition.from),
        to: serializeBoundForCompare(partition.to),
    }))
        .filter((entry) => entry.from !== null && entry.to !== null);
    for (let i = 0; i < simpleBounds.length; i++) {
        for (let j = i + 1; j < simpleBounds.length; j++) {
            const left = simpleBounds[i];
            const right = simpleBounds[j];
            if (rangeOverlaps(left.from, left.to, right.from, right.to)) {
                throw new SchemaError(`RANGE partitions "${left.partition.name}" and "${right.partition.name}" have overlapping bounds`, right.partition.loc);
            }
        }
    }
}
function validateListPartitions(spec) {
    let defaultCount = 0;
    const seen = new Map();
    for (const partition of spec.partitions) {
        if (partition.default) {
            defaultCount += 1;
            if (defaultCount > 1) {
                throw new SchemaError('at most one default LIST partition is allowed', partition.loc);
            }
            continue;
        }
        for (const value of partition.in ?? []) {
            const key = serializeBoundForCompare(value);
            if (key === null) {
                continue;
            }
            const existing = seen.get(key);
            if (existing) {
                throw new SchemaError(`LIST value ${key} appears in partitions "${existing}" and "${partition.name}"`, partition.loc);
            }
            seen.set(key, partition.name);
        }
    }
}
function validateHashPartitions(spec) {
    const moduli = new Set(spec.partitions.map((partition) => partition.modulus));
    if (moduli.size !== 1) {
        throw new SchemaError('all HASH partitions must share the same modulus', spec.loc);
    }
    const modulus = spec.partitions[0]?.modulus;
    if (modulus === undefined) {
        return;
    }
    if (spec.partitions.length !== modulus) {
        throw new SchemaError(`HASH with modulus ${modulus} requires exactly ${modulus} partitions (got ${spec.partitions.length})`, spec.loc);
    }
    const remainders = new Set();
    for (const partition of spec.partitions) {
        if (partition.remainder === undefined) {
            continue;
        }
        if (partition.remainder < 0 || partition.remainder >= modulus) {
            throw new SchemaError(`remainder must be between 0 and ${modulus - 1}`, partition.loc);
        }
        if (remainders.has(partition.remainder)) {
            throw new SchemaError(`duplicate HASH remainder ${partition.remainder}`, partition.loc);
        }
        remainders.add(partition.remainder);
    }
    for (let remainder = 0; remainder < modulus; remainder++) {
        if (!remainders.has(remainder)) {
            throw new SchemaError(`missing HASH remainder ${remainder}`, spec.loc);
        }
    }
}
function validateUniqueConstraintsIncludeKey(model, partitionFields, modelNames, loc) {
    const keySet = new Set(partitionFields);
    const primaryKeyFields = getPrimaryKeyFieldNames(model);
    if (primaryKeyFields && !keySetIsCovered(primaryKeyFields, keySet)) {
        throw new SchemaError(`primary key must include partition key fields [${partitionFields.join(', ')}]`, loc);
    }
    for (const field of model.fields) {
        if (modelNames.has(field.type.name)) {
            continue;
        }
        if (field.attributes.some((attr) => attr.name === 'unique')) {
            if (!keySetIsCovered([field.name], keySet)) {
                throw new SchemaError(`unique field "${field.name}" must include partition key fields [${partitionFields.join(', ')}] (use @@index with unique: true)`, field.loc);
            }
        }
    }
    for (const directive of model.directives.filter((item) => item.name === 'index')) {
        if (!directive.args || directive.args.kind !== 'KeyValueArgs') {
            continue;
        }
        const uniquePair = directive.args.pairs.find((pair) => pair.key === 'unique');
        if (!uniquePair || uniquePair.value.kind !== 'BooleanLiteral' || !uniquePair.value.value) {
            continue;
        }
        const fieldsPair = directive.args.pairs.find((pair) => pair.key === 'fields');
        if (!fieldsPair || fieldsPair.value.kind !== 'ArrayLiteral') {
            continue;
        }
        const fields = fieldsPair.value.elements
            .filter((element) => element.kind === 'Identifier')
            .map((element) => element.name);
        if (!keySetIsCovered(fields, keySet)) {
            throw new SchemaError(`unique index must include partition key fields [${partitionFields.join(', ')}]`, directive.loc);
        }
    }
}
function validateIncomingForeignKeys(schema, modelNames) {
    const modelsByName = new Map(schema.models.map((model) => [model.name, model]));
    for (const model of schema.models) {
        for (const field of model.fields) {
            if (!modelNames.has(field.type.name)) {
                continue;
            }
            const relation = field.attributes.find((attr) => attr.name === 'relation');
            if (!relation?.args || relation.args.kind !== 'KeyValueArgs') {
                continue;
            }
            const referencesPair = relation.args.pairs.find((pair) => pair.key === 'references');
            if (!referencesPair || referencesPair.value.kind !== 'ArrayLiteral') {
                continue;
            }
            const targetModel = modelsByName.get(field.type.name);
            if (!targetModel?.partition?.fields) {
                continue;
            }
            const referenced = referencesPair.value.elements
                .filter((element) => element.kind === 'Identifier')
                .map((element) => element.name);
            const partitionKey = new Set(targetModel.partition.fields);
            if (!keySetIsCovered(referenced, partitionKey)) {
                throw new SchemaError(`foreign key to partitioned model "${targetModel.name}" must reference a unique key that includes partition fields [${targetModel.partition.fields.join(', ')}]`, field.loc);
            }
        }
    }
}
function getPrimaryKeyFieldNames(model) {
    const composite = model.directives.find((directive) => directive.name === 'id');
    if (composite?.args?.kind === 'KeyValueArgs') {
        const fieldsPair = composite.args.pairs.find((pair) => pair.key === 'fields');
        if (fieldsPair?.value.kind === 'ArrayLiteral') {
            return fieldsPair.value.elements
                .filter((element) => element.kind === 'Identifier')
                .map((element) => element.name);
        }
    }
    const idFields = model.fields
        .filter((field) => field.attributes.some((attr) => attr.name === 'id'))
        .map((field) => field.name);
    if (idFields.length > 0) {
        return idFields;
    }
    return undefined;
}
function keySetIsCovered(constraintFields, partitionKey) {
    return [...partitionKey].every((field) => constraintFields.includes(field));
}
function registerPartitionName(name, loc, partitionNames) {
    if (partitionNames.has(name)) {
        throw new SchemaError(`duplicate partition name "${name}"`, loc);
    }
    partitionNames.set(name, loc);
}
function serializeBoundForCompare(value) {
    switch (value.kind) {
        case 'StringLiteral':
            return JSON.stringify(value.value);
        case 'NumberLiteral':
            return String(value.value);
        case 'BooleanLiteral':
            return value.value ? 'true' : 'false';
        case 'Identifier':
            return value.name.toUpperCase();
        case 'ArrayLiteral': {
            const parts = value.elements.map(serializeBoundForCompare);
            if (parts.some((part) => part === null)) {
                return null;
            }
            return `[${parts.join(',')}]`;
        }
        default:
            return null;
    }
}
function rangeOverlaps(fromA, toA, fromB, toB) {
    // Treat bounds lexicographically for strings/numbers/identifiers after serializeBoundForCompare.
    // RANGE is half-open [from, to). Overlap when fromA < toB && fromB < toA, with MINVALUE/MAXVALUE extremes.
    const startA = boundRank(fromA, 'min');
    const endA = boundRank(toA, 'max');
    const startB = boundRank(fromB, 'min');
    const endB = boundRank(toB, 'max');
    return startA < endB && startB < endA;
}
function boundRank(bound, extreme) {
    if (bound === 'MINVALUE') {
        return extreme === 'min' ? '\u0000' : '\u0000';
    }
    if (bound === 'MAXVALUE') {
        return '\uffff';
    }
    return bound;
}
const VIEW_DISALLOWED_FIELD_ATTRS = new Set(['default', 'relation', 'unique']);
const VIEW_ALLOWED_DIRECTIVES = new Set(['id', 'index']);
const VIEW_READ_OPS = new Set(['list', 'get']);
const VIEW_WRITE_OPS = new Set(['create', 'update', 'delete']);
function validateViews(schema) {
    const enumNames = new Set(schema.enums.map((enumDef) => enumDef.name));
    const modelSqlNames = new Map(schema.models.map((model) => [toTableName(model.name), model.name]));
    const viewSqlNames = new Map();
    const viewNames = new Set();
    for (const view of schema.views) {
        if (viewNames.has(view.name)) {
            throw new SchemaError(`duplicate view name "${view.name}"`, view.loc);
        }
        viewNames.add(view.name);
        if (schema.models.some((model) => model.name === view.name)) {
            throw new SchemaError(`view name "${view.name}" conflicts with model "${view.name}"`, view.loc);
        }
        const sqlName = toTableName(view.name);
        const modelClash = modelSqlNames.get(sqlName);
        if (modelClash) {
            throw new SchemaError(`view "${view.name}" SQL name "${sqlName}" conflicts with model "${modelClash}"`, view.loc);
        }
        const viewClash = viewSqlNames.get(sqlName);
        if (viewClash) {
            throw new SchemaError(`view "${view.name}" SQL name "${sqlName}" conflicts with view "${viewClash}"`, view.loc);
        }
        viewSqlNames.set(sqlName, view.name);
        if (view.columns.length === 0) {
            throw new SchemaError(`view "${view.name}" requires at least one column`, view.loc);
        }
        if (!view.query || view.query.trim().length === 0) {
            throw new SchemaError(`view "${view.name}" requires a non-empty as query`, view.loc);
        }
        const columnNames = new Set();
        for (const column of view.columns) {
            if (columnNames.has(column.name)) {
                throw new SchemaError(`duplicate column "${column.name}" on view "${view.name}"`, column.loc);
            }
            columnNames.add(column.name);
            const typeName = column.type.name;
            if (!PRIMITIVE_TYPES.has(typeName) && !enumNames.has(typeName)) {
                throw new SchemaError(`view column "${view.name}.${column.name}" type must be a primitive or enum, got "${typeName}"`, column.type.loc);
            }
            for (const attribute of column.attributes) {
                if (VIEW_DISALLOWED_FIELD_ATTRS.has(attribute.name)) {
                    throw new SchemaError(`@${attribute.name} is not allowed on view column "${view.name}.${column.name}"`, attribute.loc);
                }
            }
        }
        for (const directive of view.directives) {
            if (!VIEW_ALLOWED_DIRECTIVES.has(directive.name)) {
                throw new SchemaError(`@@${directive.name} is not allowed on view "${view.name}"`, directive.loc);
            }
            if (directive.name === 'index') {
                if (!view.materialized) {
                    throw new SchemaError(`@@index is only allowed on materialized views (view "${view.name}")`, directive.loc);
                }
                validateViewIndexFields(view, directive, columnNames);
            }
            if (directive.name === 'id') {
                validateViewIdDirective(view, directive, columnNames);
            }
        }
        validateViewRest(view);
        validateViewPolicies(view);
    }
}
function validateViewIndexFields(view, directive, columnNames) {
    if (!directive.args || directive.args.kind !== 'KeyValueArgs' || !directive.args.pairs) {
        throw new SchemaError(`@@index on view "${view.name}" requires fields`, directive.loc);
    }
    const fieldsPair = directive.args.pairs.find((pair) => pair.key === 'fields');
    if (!fieldsPair || fieldsPair.value.kind !== 'ArrayLiteral') {
        throw new SchemaError(`@@index on view "${view.name}" requires fields`, directive.loc);
    }
    for (const element of fieldsPair.value.elements) {
        if (element.kind !== 'Identifier') {
            throw new SchemaError(`@@index fields must be identifiers on view "${view.name}"`, directive.loc);
        }
        if (!columnNames.has(element.name)) {
            throw new SchemaError(`@@index field "${element.name}" is not a column on view "${view.name}"`, directive.loc);
        }
    }
}
function validateViewIdDirective(view, directive, columnNames) {
    if (!directive.args || directive.args.kind !== 'KeyValueArgs' || !directive.args.pairs) {
        throw new SchemaError(`@@id on view "${view.name}" requires fields`, directive.loc);
    }
    const fieldsPair = directive.args.pairs.find((pair) => pair.key === 'fields');
    if (!fieldsPair || fieldsPair.value.kind !== 'ArrayLiteral') {
        throw new SchemaError(`@@id on view "${view.name}" requires fields`, directive.loc);
    }
    for (const element of fieldsPair.value.elements) {
        if (element.kind !== 'Identifier') {
            throw new SchemaError(`@@id fields must be identifiers on view "${view.name}"`, directive.loc);
        }
        if (!columnNames.has(element.name)) {
            throw new SchemaError(`@@id field "${element.name}" is not a column on view "${view.name}"`, directive.loc);
        }
    }
}
function validateViewRest(view) {
    const restAttributes = view.attributes.filter((attribute) => attribute.name === 'rest');
    if (restAttributes.length > 1) {
        throw new SchemaError(`view "${view.name}" has duplicate @rest attributes`, restAttributes[1].loc);
    }
    const rest = restAttributes[0];
    const operations = rest
        ? parseViewRestOperations(view, rest)
        : new Set(VIEW_READ_OPS);
    for (const operation of operations) {
        if (VIEW_WRITE_OPS.has(operation)) {
            throw new SchemaError(`@rest on view "${view.name}" cannot include write operation "${operation}"`, rest?.loc ?? view.loc);
        }
        if (!VIEW_READ_OPS.has(operation)) {
            throw new SchemaError(`unknown @rest operation "${operation}" on view "${view.name}"`, rest?.loc ?? view.loc);
        }
    }
    if (operations.has('get') && !viewHasPrimaryKey(view)) {
        throw new SchemaError(`@rest get on view "${view.name}" requires @id or @@id`, rest?.loc ?? view.loc);
    }
}
function viewHasPrimaryKey(view) {
    if (view.directives.some((directive) => directive.name === 'id')) {
        return true;
    }
    if (view.attributes.some((attribute) => attribute.name === 'id')) {
        return true;
    }
    return view.columns.some((column) => column.attributes.some((attribute) => attribute.name === 'id'));
}
function parseViewRestOperations(view, rest) {
    if (!rest.args) {
        return new Set();
    }
    if (rest.args.kind === 'ExpressionArgs') {
        if (rest.args.expressions.length === 1 && rest.args.expressions[0]?.kind === 'BooleanLiteral') {
            if (rest.args.expressions[0].value === false) {
                return new Set();
            }
            return new Set(VIEW_READ_OPS);
        }
        throw new SchemaError(`@rest on view "${view.name}" expects false, only, or except`, rest.loc);
    }
    const onlyPair = rest.args.pairs.find((pair) => pair.key === 'only');
    const exceptPair = rest.args.pairs.find((pair) => pair.key === 'except');
    if (onlyPair && exceptPair) {
        throw new SchemaError(`@rest on view "${view.name}" cannot mix only and except`, rest.loc);
    }
    if (!onlyPair && !exceptPair) {
        throw new SchemaError(`@rest on view "${view.name}" requires only, except, or false`, rest.loc);
    }
    if (onlyPair) {
        if (onlyPair.value.kind !== 'ArrayLiteral') {
            throw new SchemaError(`@rest only on view "${view.name}" must be an array`, rest.loc);
        }
        return new Set(onlyPair.value.elements.map((element) => {
            if (element.kind !== 'Identifier') {
                throw new SchemaError(`@rest operation on view "${view.name}" must be an identifier`, rest.loc);
            }
            return element.name.toLowerCase();
        }));
    }
    if (exceptPair.value.kind !== 'ArrayLiteral') {
        throw new SchemaError(`@rest except on view "${view.name}" must be an array`, rest.loc);
    }
    const excluded = new Set(exceptPair.value.elements.map((element) => {
        if (element.kind !== 'Identifier') {
            throw new SchemaError(`@rest operation on view "${view.name}" must be an identifier`, rest.loc);
        }
        return element.name.toLowerCase();
    }));
    return new Set([...VIEW_READ_OPS].filter((operation) => !excluded.has(operation)));
}
function validateViewPolicies(view) {
    for (const attribute of view.attributes) {
        if (attribute.name !== 'policy') {
            continue;
        }
        if (!attribute.args || attribute.args.kind !== 'KeyValueArgs') {
            throw new SchemaError(`@policy on view "${view.name}" requires key-value args`, attribute.loc);
        }
        const allowPair = attribute.args.pairs.find((pair) => pair.key === 'allow');
        if (!allowPair) {
            throw new SchemaError(`@policy on view "${view.name}" requires allow`, attribute.loc);
        }
        if (allowPair.value.kind === 'Identifier') {
            if (allowPair.value.name !== 'all' && allowPair.value.name !== 'select') {
                throw new SchemaError(`@policy on view "${view.name}" allow must be select or all`, allowPair.loc ?? attribute.loc);
            }
            continue;
        }
        if (allowPair.value.kind !== 'ArrayLiteral') {
            throw new SchemaError(`@policy on view "${view.name}" allow must be select, all, or an array`, allowPair.loc ?? attribute.loc);
        }
        for (const element of allowPair.value.elements) {
            if (element.kind !== 'Identifier') {
                throw new SchemaError(`@policy operation on view "${view.name}" must be an identifier`, allowPair.loc ?? attribute.loc);
            }
            if (element.name.toLowerCase() !== 'select') {
                throw new SchemaError(`@policy on view "${view.name}" allow may only include select`, allowPair.loc ?? attribute.loc);
            }
        }
    }
}
