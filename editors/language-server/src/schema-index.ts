import type { CronJob, Field, FunctionReturn, Model, Schema, SourceLocation, SqlFunction, TypeExpr } from 'schematic-pg/schema-dsl';
import { isTableReturn } from 'schematic-pg/schema-dsl';
import { Range } from 'vscode-languageserver';
import { toRange } from './utils.js';

export type SymbolKind =
  | 'enum'
  | 'enum-value'
  | 'model'
  | 'field'
  | 'type-ref'
  | 'extension'
  | 'function'
  | 'job';

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
  functions: Map<string, IndexedSymbol>;
  jobs: Map<string, IndexedSymbol>;
  callRefs: IndexedSymbol[];
}

export function buildSchemaIndex(schema: Schema): SchemaIndex {
  const symbols: IndexedSymbol[] = [];
  const enums = new Map<string, IndexedSymbol>();
  const models = new Map<string, IndexedSymbol>();
  const fields = new Map<string, IndexedSymbol>();
  const typeRefs: IndexedSymbol[] = [];
  const enumValues = new Map<string, IndexedSymbol>();
  const functions = new Map<string, IndexedSymbol>();
  const jobs = new Map<string, IndexedSymbol>();
  const callRefs: IndexedSymbol[] = [];

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

  for (const sqlFunction of schema.functions) {
    const functionSymbol: IndexedSymbol = {
      name: sqlFunction.name,
      kind: 'function',
      range: toRange(sqlFunction.loc),
      detail: formatFunctionSignature(sqlFunction),
    };
    symbols.push(functionSymbol);
    functions.set(sqlFunction.name, functionSymbol);
  }

  for (const job of schema.jobs) {
    const jobSymbol: IndexedSymbol = {
      name: job.name,
      kind: 'job',
      range: toRange(job.loc),
      detail: formatJobDetail(job),
    };
    symbols.push(jobSymbol);
    jobs.set(job.name, jobSymbol);

    if (job.call) {
      const callRef: IndexedSymbol = {
        name: job.call,
        kind: 'type-ref',
        range: toRange(job.loc),
        containerName: job.name,
        detail: `call: ${job.call}`,
      };
      callRefs.push(callRef);
      symbols.push(callRef);
    }
  }

  return { symbols, enums, models, fields, typeRefs, enumValues, functions, jobs, callRefs };
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
  return /^(UUID|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|DECIMAL|JSONB|INTEGER|SMALLINT|BIGINT|BIGSERIAL|POINT|SERIAL|REAL|DOUBLE|NUMERIC|BYTEA|DATE|TIME|INTERVAL|TRIGGER|VOID|TABLE)$/.test(
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

function formatFunctionReturn(returns: FunctionReturn): string {
  if (isTableReturn(returns)) {
    const columns = returns.columns
      .map((column) => `${column.name}: ${formatType(column.type)}`)
      .join(', ');
    return `TABLE(${columns})`;
  }
  return formatType(returns);
}

function formatJobDetail(job: CronJob): string {
  if (job.call) {
    return `schedule: ${job.schedule}, call: ${job.call}`;
  }
  return `schedule: ${job.schedule}`;
}

export function findDefinition(index: SchemaIndex, word: string): IndexedSymbol | undefined {
  return (
    index.enums.get(word) ??
    index.models.get(word) ??
    index.functions.get(word) ??
    index.jobs.get(word)
  );
}

export function findReferences(index: SchemaIndex, word: string): Range[] {
  const ranges: Range[] = [];

  if (index.enums.has(word)) {
    ranges.push(index.enums.get(word)!.range);
  }

  if (index.models.has(word)) {
    ranges.push(index.models.get(word)!.range);
  }

  if (index.functions.has(word)) {
    ranges.push(index.functions.get(word)!.range);
  }

  for (const typeRef of index.typeRefs) {
    if (typeRef.name === word) {
      ranges.push(typeRef.range);
    }
  }

  for (const callRef of index.callRefs) {
    if (callRef.name === word) {
      ranges.push(callRef.range);
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

export function findContainingFunction(schema: Schema, positionLine: number): SqlFunction | undefined {
  return schema.functions.find((sqlFunction) => {
    const start = sqlFunction.loc.line;
    const end = sqlFunction.loc.endLine ?? sqlFunction.loc.line;
    return positionLine + 1 >= start && positionLine + 1 <= end;
  });
}

export function findContainingJob(schema: Schema, positionLine: number): CronJob | undefined {
  return schema.jobs.find((job) => {
    const start = job.loc.line;
    const end = job.loc.endLine ?? job.loc.line;
    return positionLine + 1 >= start && positionLine + 1 <= end;
  });
}

function formatFunctionSignature(sqlFunction: SqlFunction): string {
  const params = sqlFunction.params.map((param) => `${param.name}: ${formatType(param.type)}`).join(', ');
  return `(${params}): ${formatFunctionReturn(sqlFunction.returns)}`;
}

export function locAt(line: number, col: number): SourceLocation {
  return { line, col };
}
