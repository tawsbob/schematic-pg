import { fieldHasAttribute, getModelNames, getStoredFields, } from '../../sql-generator/utils/ast-helpers.js';
export function isStoredScalarField(field, schema) {
    const modelNames = getModelNames(schema);
    return !modelNames.has(field.type.name);
}
export function isRelationField(field, schema) {
    return getModelNames(schema).has(field.type.name);
}
export function isUnfilterable(field) {
    return fieldHasAttribute(field, 'unfilterable') || fieldHasAttribute(field, 'omit');
}
export function isUnincludeable(field) {
    return fieldHasAttribute(field, 'unincludeable');
}
export function isOmitted(field) {
    return fieldHasAttribute(field, 'omit');
}
export function getFilterableFields(model, schema) {
    return getStoredFields(model, getModelNames(schema)).filter((field) => isStoredScalarField(field, schema) && !isUnfilterable(field));
}
export function getOmittedFields(model, schema) {
    return getStoredFields(model, getModelNames(schema)).filter((field) => isStoredScalarField(field, schema) && isOmitted(field));
}
export function getIncludableRelationFields(model, schema) {
    return model.fields.filter((field) => isRelationField(field, schema) && !isUnincludeable(field));
}
export function buildIncludableRelationTree(model, schema, visited = new Set()) {
    if (visited.has(model.name)) {
        return {};
    }
    const nextVisited = new Set(visited);
    nextVisited.add(model.name);
    const tree = {};
    for (const field of getIncludableRelationFields(model, schema)) {
        const targetModel = schema.models.find((candidate) => candidate.name === field.type.name);
        if (!targetModel) {
            continue;
        }
        tree[field.name] = buildIncludableRelationTree(targetModel, schema, nextVisited);
    }
    return tree;
}
export function buildRelationTargets(model, schema) {
    const targets = {};
    for (const field of getIncludableRelationFields(model, schema)) {
        targets[field.name] = field.type.name;
    }
    return targets;
}
export function getSortableFieldNames(model, schema) {
    return getStoredFields(model, getModelNames(schema))
        .filter((field) => isStoredScalarField(field, schema))
        .map((field) => field.name);
}
export function toModelConstantPrefix(modelName) {
    return modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
