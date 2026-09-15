import type { TypeExpr } from '../../schema-dsl/ast.js';
import { PRIMITIVE_TYPES } from '../../schema-dsl/primitives.js';
import { toSnakeCase } from './snake-case.js';
export function mapColumnType(type: TypeExpr, enumNames: Set<string>): string {
  if (type.name === 'TRIGGER' || type.name === 'VOID') {
    return type.name;
  }

  const baseType = mapBaseType(type, enumNames);
  return type.array ? `${baseType}[]` : baseType;
}

function mapBaseType(type: TypeExpr, enumNames: Set<string>): string {
  const { name } = type;

  if (enumNames.has(name)) {
    return toSnakeCase(name);
  }

  if (name === 'TIMESTAMP') {
    return 'TIMESTAMP WITH TIME ZONE';
  }

  if (name === 'VARCHAR' && type.args?.length) {
    const length = type.args.map((arg) => (arg as { value: number }).value).join(', ');
    return `VARCHAR(${length})`;
  }

  if (name === 'DECIMAL' && type.args?.length) {
    const args = type.args.map((arg) => (arg as { value: number }).value).join(', ');
    return `DECIMAL(${args})`;
  }

  if (PRIMITIVE_TYPES.has(name)) {
    return name;
  }

  return name;
}
