import type { Field, Model, Schema } from '../../schema-dsl/ast.js';
import {
  fieldHasAttribute,
  getModelNames,
  getStoredFields,
} from '../../sql-generator/utils/ast-helpers.js';
import type { IncludableRelationTree } from '../../api/utils/include-query.js';

export function isStoredScalarField(field: Field, schema: Schema): boolean {
  const modelNames = getModelNames(schema);
  return !modelNames.has(field.type.name);
}

export function isRelationField(field: Field, schema: Schema): boolean {
  return getModelNames(schema).has(field.type.name);
}

export function isUnfilterable(field: Field): boolean {
  return fieldHasAttribute(field, 'unfilterable') || fieldHasAttribute(field, 'omit');
}

export function isUnincludeable(field: Field): boolean {
  return fieldHasAttribute(field, 'unincludeable');
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

export function getIncludableRelationFields(model: Model, schema: Schema): Field[] {
  return model.fields.filter(
    (field) => isRelationField(field, schema) && !isUnincludeable(field),
  );
}

export function buildIncludableRelationTree(
  model: Model,
  schema: Schema,
  visited: Set<string> = new Set(),
): IncludableRelationTree {
  if (visited.has(model.name)) {
    return {};
  }

  const nextVisited = new Set(visited);
  nextVisited.add(model.name);
  const tree: IncludableRelationTree = {};

  for (const field of getIncludableRelationFields(model, schema)) {
    const targetModel = schema.models.find((candidate) => candidate.name === field.type.name);
    if (!targetModel) {
      continue;
    }

    tree[field.name] = buildIncludableRelationTree(targetModel, schema, nextVisited);
  }

  return tree;
}

export function buildRelationTargets(model: Model, schema: Schema): Record<string, string> {
  const targets: Record<string, string> = {};

  for (const field of getIncludableRelationFields(model, schema)) {
    targets[field.name] = field.type.name;
  }

  return targets;
}

export function getSortableFieldNames(model: Model, schema: Schema): string[] {
  return getStoredFields(model, getModelNames(schema))
    .filter((field) => isStoredScalarField(field, schema))
    .map((field) => field.name);
}

export function toModelConstantPrefix(modelName: string): string {
  return modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
