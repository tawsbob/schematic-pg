import { fieldHasAttribute, getModelNames, getStoredFields, } from '../../sql-generator/utils/ast-helpers.js';
export function isStoredScalarField(field, schema) {
    const modelNames = getModelNames(schema);
    return !modelNames.has(field.type.name);
}
export function isUnfilterable(field) {
    return fieldHasAttribute(field, 'unfilterable') || fieldHasAttribute(field, 'omit');
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
export function getSortableFieldNames(model, schema) {
    return getStoredFields(model, getModelNames(schema))
        .filter((field) => isStoredScalarField(field, schema))
        .map((field) => field.name);
}
export function toModelConstantPrefix(modelName) {
    return modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
