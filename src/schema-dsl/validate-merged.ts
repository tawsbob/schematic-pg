import type { AttributeArgs, Schema, SourceLocation } from './ast.js';
import { isTableReturn } from './ast.js';
import { PRIMITIVE_TYPES } from './primitives.js';
import { SchemaError } from './validate.js';
import { toTableName } from '../sql-generator/utils/snake-case.js';

function formatFile(loc: SourceLocation): string {
  return loc.file ?? '<unknown>';
}

function findDuplicateNames(
  kind: string,
  entries: Array<{ name: string; loc: SourceLocation }>,
): void {
  const seen = new Map<string, SourceLocation>();

  for (const entry of entries) {
    const previous = seen.get(entry.name);
    if (previous) {
      throw new SchemaError(
        `duplicate ${kind} name "${entry.name}" (also declared in ${formatFile(previous)})`,
        entry.loc,
      );
    }
    seen.set(entry.name, entry.loc);
  }
}

function validateDuplicateNames(schema: Schema): void {
  findDuplicateNames(
    'extension',
    schema.extensions.map((extension) => ({ name: extension.name, loc: extension.loc })),
  );
  findDuplicateNames(
    'enum',
    schema.enums.map((enumDef) => ({ name: enumDef.name, loc: enumDef.loc })),
  );
  findDuplicateNames(
    'predicate',
    schema.predicates.map((predicate) => ({ name: predicate.name, loc: predicate.loc })),
  );
  findDuplicateNames(
    'model',
    schema.models.map((model) => ({ name: model.name, loc: model.loc })),
  );
  findDuplicateNames(
    'view',
    schema.views.map((view) => ({ name: view.name, loc: view.loc })),
  );
  findDuplicateNames(
    'function',
    schema.functions.map((fn) => ({ name: fn.name, loc: fn.loc })),
  );
  findDuplicateNames(
    'job',
    schema.jobs.map((job) => ({ name: job.name, loc: job.loc })),
  );

  const modelBySqlName = new Map(
    schema.models.map((model) => [toTableName(model.name), model]),
  );
  for (const view of schema.views) {
    const sqlName = toTableName(view.name);
    const model = modelBySqlName.get(sqlName);
    if (model) {
      throw new SchemaError(
        `view "${view.name}" SQL name "${sqlName}" conflicts with model "${model.name}" (also declared in ${formatFile(model.loc)})`,
        view.loc,
      );
    }
    if (schema.models.some((candidate) => candidate.name === view.name)) {
      throw new SchemaError(
        `view name "${view.name}" conflicts with model "${view.name}"`,
        view.loc,
      );
    }
  }
}

function validateUnknownTypeNames(schema: Schema): void {
  const enumNames = new Set(schema.enums.map((enumDef) => enumDef.name));
  const modelNames = new Set(schema.models.map((model) => model.name));

  for (const model of schema.models) {
    for (const field of model.fields) {
      const typeName = field.type.name;
      if (
        PRIMITIVE_TYPES.has(typeName) ||
        enumNames.has(typeName) ||
        modelNames.has(typeName)
      ) {
        continue;
      }

      throw new SchemaError(
        `unknown type "${typeName}" on field "${model.name}.${field.name}"`,
        field.type.loc,
      );
    }
  }

  for (const view of schema.views) {
    for (const column of view.columns) {
      const typeName = column.type.name;
      if (PRIMITIVE_TYPES.has(typeName) || enumNames.has(typeName)) {
        continue;
      }

      throw new SchemaError(
        `unknown type "${typeName}" on view column "${view.name}.${column.name}"`,
        column.type.loc,
      );
    }
  }
}

function getPolicyWherePair(args: AttributeArgs | undefined) {
  if (!args || args.kind !== 'KeyValueArgs') {
    return undefined;
  }

  return args.pairs.find((pair) => pair.key === 'where');
}

function validatePolicyPredicateReferences(schema: Schema): void {
  const predicateNames = new Set(schema.predicates.map((predicate) => predicate.name));

  for (const model of schema.models) {
    for (const attribute of model.attributes) {
      if (attribute.name !== 'policy') {
        continue;
      }

      const wherePair = getPolicyWherePair(attribute.args);
      if (!wherePair || wherePair.value.kind !== 'Identifier') {
        continue;
      }

      const predicateName = wherePair.value.name;
      if (!predicateNames.has(predicateName)) {
        throw new SchemaError(
          `unknown predicate "${predicateName}" referenced by @policy on model "${model.name}"`,
          wherePair.loc ?? attribute.loc,
        );
      }
    }
  }

  for (const view of schema.views) {
    for (const attribute of view.attributes) {
      if (attribute.name !== 'policy') {
        continue;
      }

      const wherePair = getPolicyWherePair(attribute.args);
      if (!wherePair || wherePair.value.kind !== 'Identifier') {
        continue;
      }

      const predicateName = wherePair.value.name;
      if (!predicateNames.has(predicateName)) {
        throw new SchemaError(
          `unknown predicate "${predicateName}" referenced by @policy on view "${view.name}"`,
          wherePair.loc ?? attribute.loc,
        );
      }
    }
  }
}

function validateCronJobs(schema: Schema): void {
  if (schema.jobs.length === 0) {
    return;
  }

  const hasPgCron = schema.extensions.some((extension) => extension.name === 'pg_cron');
  if (!hasPgCron) {
    throw new SchemaError(
      'cron jobs require the pg_cron extension (add `pg_cron` to extensions)',
      schema.jobs[0]!.loc,
    );
  }

  const functionsByName = new Map(schema.functions.map((fn) => [fn.name, fn]));

  for (const job of schema.jobs) {
    if (job.execute !== undefined && job.execute.includes('{{auth.')) {
      throw new SchemaError(
        `cron job "${job.name}" execute body must not use {{auth.*}} templates (jobs have no request auth context)`,
        job.loc,
      );
    }

    if (job.call === undefined) {
      continue;
    }

    const sqlFunction = functionsByName.get(job.call);
    if (!sqlFunction) {
      throw new SchemaError(
        `unknown function "${job.call}" referenced by cron job "${job.name}"`,
        job.loc,
      );
    }

    if (sqlFunction.params.length > 0) {
      throw new SchemaError(
        `cron job "${job.name}" call "${job.call}" must reference a zero-argument function`,
        job.loc,
      );
    }

    if (isTableReturn(sqlFunction.returns)) {
      throw new SchemaError(
        `cron job "${job.name}" call "${job.call}" cannot reference a TABLE-returning function`,
        job.loc,
      );
    }

    if (sqlFunction.returns.kind === 'TypeExpr' && sqlFunction.returns.name === 'TRIGGER') {
      throw new SchemaError(
        `cron job "${job.name}" call "${job.call}" cannot reference a TRIGGER function`,
        job.loc,
      );
    }
  }
}

/**
 * Strict validation for a fully merged schema.
 * Must not be called from parse() — the language server validates single buffers
 * where cross-file model references would look unresolved.
 */
export function validateMergedSchema(schema: Schema): void {
  validateDuplicateNames(schema);
  validateUnknownTypeNames(schema);
  validatePolicyPredicateReferences(schema);
  validateCronJobs(schema);
}
