import type { Field, Model, Schema, SourceLocation, TypeExpr } from 'schematic-pg/schema-dsl';
import { Range } from 'vscode-languageserver';
import { toRange } from './utils.js';

export type SymbolKind =
  | 'enum'
  | 'enum-value'
  | 'model'
  | 'field'
  | 'type-ref'
  | 'extension';

export interface IndexedSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  containerName?: string;
  detail?: string;
}

export interface SchemaIndex {
  symbols: IndexedSymbol[];
  enums: Map<string, IndexedSymbol>;
  models: Map<string, IndexedSymbol>;
  fields: Map<string, IndexedSymbol>;
  typeRefs: IndexedSymbol[];
  enumValues: Map<string, IndexedSymbol>;
}

export function buildSchemaIndex(schema: Schema): SchemaIndex {
  const symbols: IndexedSymbol[] = [];
  const enums = new Map<string, IndexedSymbol>();
  const models = new Map<string, IndexedSymbol>();
  const fields = new Map<string, IndexedSymbol>();
  const typeRefs: IndexedSymbol[] = [];
  const enumValues = new Map<string, IndexedSymbol>();

  for (const extension of schema.extensions) {
    const symbol: IndexedSymbol = {
      name: extension.name,
      kind: 'extension',
      range: toRange(extension.loc),
    };
    symbols.push(symbol);
  }

  for (const enumDef of schema.enums) {
    const symbol: IndexedSymbol = {
      name: enumDef.name,
      kind: 'enum',
      range: toRange(enumDef.loc),
      detail: enumDef.values.join(', '),
    };
    symbols.push(symbol);
    enums.set(enumDef.name, symbol);

    for (const value of enumDef.values) {
      const valueSymbol: IndexedSymbol = {
        name: value,
        kind: 'enum-value',
        range: toRange(enumDef.loc),
        containerName: enumDef.name,
      };
      symbols.push(valueSymbol);
      enumValues.set(`${enumDef.name}.${value}`, valueSymbol);
    }
  }

  for (const model of schema.models) {
    const modelSymbol: IndexedSymbol = {
      name: model.name,
      kind: 'model',
      range: toRange(model.loc),
    };
    symbols.push(modelSymbol);
    models.set(model.name, modelSymbol);

    for (const field of model.fields) {
      const fieldKey = `${model.name}.${field.name}`;
      const fieldSymbol: IndexedSymbol = {
        name: field.name,
        kind: 'field',
        range: toRange(field.loc),
        containerName: model.name,
        detail: formatType(field.type),
      };
      symbols.push(fieldSymbol);
      fields.set(fieldKey, fieldSymbol);

      const typeRef = createTypeRef(field.type, model.name);
      if (typeRef) {
        typeRefs.push(typeRef);
        symbols.push(typeRef);
      }
    }
  }

  return { symbols, enums, models, fields, typeRefs, enumValues };
}

function createTypeRef(type: TypeExpr, containerName: string): IndexedSymbol | undefined {
  if (isBuiltinType(type.name)) {
    return undefined;
  }

  return {
    name: type.name,
    kind: 'type-ref',
    range: toRange(type.loc),
    containerName,
    detail: formatType(type),
  };
}

function isBuiltinType(name: string): boolean {
  return /^(UUID|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|DECIMAL|JSONB|INTEGER|SMALLINT|BIGINT|POINT|SERIAL|REAL|DOUBLE|NUMERIC|BYTEA|DATE|TIME|INTERVAL)$/.test(
    name,
  );
}

function formatType(type: TypeExpr): string {
  let rendered = type.name;
  if (type.args?.length) {
    rendered += `(${type.args.map((arg) => JSON.stringify(arg)).join(', ')})`;
  }
  if (type.array) {
    rendered += '[]';
  }
  if (type.optional) {
    rendered += '?';
  }
  return rendered;
}

export function findDefinition(index: SchemaIndex, word: string): IndexedSymbol | undefined {
  return index.enums.get(word) ?? index.models.get(word);
}

export function findReferences(index: SchemaIndex, word: string): Range[] {
  const ranges: Range[] = [];

  if (index.enums.has(word)) {
    ranges.push(index.enums.get(word)!.range);
  }

  if (index.models.has(word)) {
    ranges.push(index.models.get(word)!.range);
  }

  for (const typeRef of index.typeRefs) {
    if (typeRef.name === word) {
      ranges.push(typeRef.range);
    }
  }

  return ranges;
}

export function getModelFields(schema: Schema, modelName: string): Field[] {
  return schema.models.find((model) => model.name === modelName)?.fields ?? [];
}

export function getModelNames(schema: Schema): string[] {
  return schema.models.map((model) => model.name);
}

export function getEnumNames(schema: Schema): string[] {
  return schema.enums.map((enumDef) => enumDef.name);
}

export function getEnumValues(schema: Schema, enumName: string): string[] {
  return schema.enums.find((enumDef) => enumDef.name === enumName)?.values ?? [];
}

export function findContainingModel(schema: Schema, positionLine: number): Model | undefined {
  return schema.models.find((model) => {
    const start = model.loc.line;
    const end = model.loc.endLine ?? model.loc.line;
    return positionLine + 1 >= start && positionLine + 1 <= end;
  });
}

export function locAt(line: number, col: number): SourceLocation {
  return { line, col };
}
