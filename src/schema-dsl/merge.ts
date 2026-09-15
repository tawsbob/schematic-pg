import type {
  Enum,
  Extension,
  Model,
  Schema,
  SourceLocation,
  SqlFunction,
} from './ast.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';

export interface SchemaFragment {
  file: string;
  source: string;
  schema: Schema;
}

export interface MergedSchema {
  schema: Schema;
  canonicalSource: string;
}

export function parseFragment(source: string, filePath = ''): Schema {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenizeAll();
  const parser = new Parser(tokens, filePath || undefined);
  return parser.parseSchema();
}

function byName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

function sliceDeclaration(source: string, loc: SourceLocation): string {
  return source.slice(loc.start, loc.end);
}

function indentBlock(text: string, indent = '  '): string {
  return text
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${indent}${line}`))
    .join('\n');
}

function formatSection(name: string, bodies: string[]): string | null {
  if (bodies.length === 0) {
    return null;
  }

  return `${name} {\n\n${bodies.map((body) => indentBlock(body)).join('\n\n')}\n\n}`;
}

export function mergeFragments(fragments: SchemaFragment[]): MergedSchema {
  const extensionEntries: Array<{ item: Extension; source: string }> = [];
  const enumEntries: Array<{ item: Enum; source: string }> = [];
  const modelEntries: Array<{ item: Model; source: string }> = [];
  const functionEntries: Array<{ item: SqlFunction; source: string }> = [];

  for (const fragment of fragments) {
    for (const item of fragment.schema.extensions) {
      extensionEntries.push({ item, source: fragment.source });
    }
    for (const item of fragment.schema.enums) {
      enumEntries.push({ item, source: fragment.source });
    }
    for (const item of fragment.schema.models) {
      modelEntries.push({ item, source: fragment.source });
    }
    for (const item of fragment.schema.functions) {
      functionEntries.push({ item, source: fragment.source });
    }
  }

  extensionEntries.sort((left, right) => byName(left.item, right.item));
  enumEntries.sort((left, right) => byName(left.item, right.item));
  modelEntries.sort((left, right) => byName(left.item, right.item));
  functionEntries.sort((left, right) => byName(left.item, right.item));

  const extensions = extensionEntries.map((entry) => entry.item);
  const enums = enumEntries.map((entry) => entry.item);
  const models = modelEntries.map((entry) => entry.item);
  const functions = functionEntries.map((entry) => entry.item);

  const schema: Schema = {
    kind: 'Schema',
    extensions,
    enums,
    models,
    functions,
    loc: {
      line: 1,
      col: 1,
      start: 0,
      end: 0,
    },
  };

  const sections = [
    formatSection(
      'extensions',
      extensionEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc)),
    ),
    formatSection(
      'enums',
      enumEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc)),
    ),
    formatSection(
      'models',
      modelEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc)),
    ),
    formatSection(
      'functions',
      functionEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc)),
    ),
  ].filter((section): section is string => section !== null);

  const canonicalSource = sections.length > 0 ? `${sections.join('\n\n')}\n` : '';

  return { schema, canonicalSource };
}
