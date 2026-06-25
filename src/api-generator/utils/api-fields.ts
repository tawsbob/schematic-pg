import type { Field, Model, Schema } from '../../schema-dsl/ast.js';
import {
  fieldHasAttribute,
  getModelNames,
  getStoredFields,
} from '../../sql-generator/utils/ast-helpers.js';

export function isStoredScalarField(field: Field, schema: Schema): boolean {
  const modelNames = getModelNames(schema);
  return !modelNames.has(field.type.name);
}

export function isUnfilterable(field: Field): boolean {
  return fieldHasAttribute(field, 'unfilterable') || fieldHasAttribute(field, 'omit');
}

export function isOmitted(field: Field): boolean {
  return fieldHasAttribute(field, 'omit');
}

export function getFilterableFields(model: Model, schema: Schema): Field[] {
  return getStoredFields(model, getModelNames(schema)).filter(
    (field) => isStoredScalarField(field, schema) && !isUnfilterable(field),
  );
}

export function getOmittedFields(model: Model, schema: Schema): Field[] {
  return getStoredFields(model, getModelNames(schema)).filter(
    (field) => isStoredScalarField(field, schema) && isOmitted(field),
  );
}

export function getSortableFieldNames(model: Model, schema: Schema): string[] {
  return getStoredFields(model, getModelNames(schema))
    .filter((field) => isStoredScalarField(field, schema))
    .map((field) => field.name);
}

export function toModelConstantPrefix(modelName: string): string {
  return modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
