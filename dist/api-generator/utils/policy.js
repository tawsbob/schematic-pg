import { assertKeyValueArgs, getKvPair, getOptionalKvPair } from '../../sql-generator/utils/ast-helpers.js';
export const PUBLIC_ROLE = 'PUBLIC';
export const POLICY_OPERATIONS = ['select', 'insert', 'update', 'delete'];
export const OP_BY_METHOD = {
    GET: 'select',
    POST: 'insert',
    PUT: 'update',
    DELETE: 'delete',
};
export function normalizePolicies(model, predicates = []) {
    const predicateByName = new Map(predicates.map((predicate) => [predicate.name, predicate.sql]));
    return model.attributes
        .filter((attribute) => attribute.name === 'policy')
        .map((attribute) => normalizePolicyAttribute(attribute, predicateByName));
}
export function hasPolicies(model) {
    return model.attributes.some((attribute) => attribute.name === 'policy');
}
function normalizePolicyAttribute(attribute, predicateByName) {
    const args = assertKeyValueArgs(attribute.args);
    const role = parseIdentifierValue(getKvPair(args, 'role').value, 'role');
    const allow = parseAllowOperations(getKvPair(args, 'allow').value);
    const wherePair = getOptionalKvPair(args, 'where');
    const policy = { role, operations: allow };
    if (wherePair) {
        policy.where = resolveWhereValue(wherePair.value, predicateByName);
    }
    return policy;
}
function resolveWhereValue(value, predicateByName) {
    if (value.kind === 'StringLiteral' || value.kind === 'TripleStringLiteral') {
        return value.value.trim();
    }
    if (value.kind === 'Identifier') {
        const sql = predicateByName.get(value.name);
        if (sql === undefined) {
            throw new Error(`Unknown policy predicate "${value.name}"`);
        }
        return sql;
    }
    throw new Error('Policy where must be a string or predicate identifier');
}
function parseAllowOperations(value) {
    if (value.kind === 'Identifier') {
        if (value.name === 'all') {
            return 'all';
        }
        throw new Error(`Unknown policy allow value "${value.name}"`);
    }
    if (value.kind === 'ArrayLiteral') {
        return value.elements.map((element) => parsePolicyOperation(element));
    }
    throw new Error('Policy allow must be "all" or an array of operations');
}
function parsePolicyOperation(value) {
    if (value.kind !== 'Identifier') {
        throw new Error('Policy operation must be an identifier');
    }
    const operation = value.name.toLowerCase();
    if (!isPolicyOperation(operation)) {
        throw new Error(`Unknown policy operation "${value.name}"`);
    }
    return operation;
}
function parseIdentifierValue(value, fieldName) {
    if (value.kind !== 'Identifier') {
        throw new Error(`Policy ${fieldName} must be an identifier`);
    }
    return value.name;
}
function isPolicyOperation(value) {
    return POLICY_OPERATIONS.includes(value);
}
export function serializePolicy(policy) {
    const operations = policy.operations === 'all'
        ? "'all'"
        : `[${policy.operations.map((operation) => `'${operation}'`).join(', ')}]`;
    const where = policy.where ? `, where: ${JSON.stringify(policy.where)}` : '';
    return `{ role: '${policy.role}', operations: ${operations}${where} }`;
}
