import type { Schema } from '../../schema-dsl/ast.js';
import {
  formatNormalizedFunctionReturn,
  getEnumNames,
  normalizeFunction,
  type NormalizedFunction,
} from '../utils/ast-helpers.js';
import { joinSection } from '../utils/format.js';
import { quoteIdentifier } from '../utils/snake-case.js';

export type { NormalizedFunction };

export function generateCreateFunction(normalized: NormalizedFunction): string {
  const functionName = quoteIdentifier(normalized.sqlName);
  const params = normalized.params
    .map((param) => `${quoteIdentifier(param.sqlName)} ${param.sqlType}`)
    .join(', ');
  const clauses = [
    `CREATE OR REPLACE FUNCTION ${functionName}(${params})`,
    `RETURNS ${formatNormalizedFunctionReturn(normalized.returns)}`,
    `LANGUAGE ${normalized.language}`,
  ];

  if (normalized.volatility !== 'VOLATILE') {
    clauses.push(normalized.volatility);
  }

  if (normalized.security === 'DEFINER') {
    clauses.push('SECURITY DEFINER');
  }

  const body = formatFunctionBody(normalized.execute, normalized.language);
  clauses.push(`AS $$\n${body}\n$$;`);
  return clauses.join('\n');
}

export function generateDropFunction(normalized: NormalizedFunction): string {
  const functionName = quoteIdentifier(normalized.sqlName);
  const argTypes = normalized.params.map((param) => param.sqlType).join(', ');
  return `DROP FUNCTION IF EXISTS ${functionName}(${argTypes});`;
}

export function generateFunctions(schema: Schema): string {
  const enumNames = getEnumNames(schema);
  const statements = schema.functions.map((sqlFunction) =>
    generateCreateFunction(normalizeFunction(sqlFunction, enumNames)),
  );
  return joinSection('Create functions', statements);
}

function formatFunctionBody(execute: string, language: string): string {
  const trimmed = execute.trim();
  const indented = indentBody(trimmed);

  if (language !== 'plpgsql') {
    return indented;
  }

  if (/^(declare|begin)\b/i.test(trimmed)) {
    return indented;
  }

  return `BEGIN\n${indented}\nEND;`;
}

function indentBody(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');
}
