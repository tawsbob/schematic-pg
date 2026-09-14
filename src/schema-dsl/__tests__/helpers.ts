// Run: npm test

import assert from 'node:assert/strict';
import type {
  Attribute,
  AttributeArgs,
  Directive,
  Field,
  KeyValueArgs,
  Model,
  TypeExpr,
  Value,
} from '../ast.js';
import { LexError } from '../lexer.js';
import { ParseError } from '../parser.js';
import { SchemaError } from '../validate.js';
import { parse, tokenize } from '../index.js';
import { TokenType } from '../tokens.js';

export function wrapModels(body: string): string {
  return `extensions {}\nenums {}\nmodels { ${body} }`;
}

export function wrapFunctions(body: string): string {
  return `extensions {}\nenums {}\nmodels {}\nfunctions { ${body} }`;
}

export function parseSnippet(source: string) {
  return parse(source);
}

export function parseModelBody(body: string): Model {
  return parse(wrapModels(`model Test { ${body} }`)).models[0];
}

export function tokenizeSnippet(source: string) {
  return tokenize(source);
}

export function expectParseError(
  source: string,
  matcher: RegExp | string,
  expected?: { line?: number; col?: number },
): void {
  assert.throws(
    () => parse(source),
    (error: unknown) => {
      assert.ok(
        error instanceof ParseError || error instanceof SchemaError,
        `expected ParseError or SchemaError, got ${error}`,
      );
      const message = error.message;
      if (typeof matcher === 'string') {
        assert.ok(message.includes(matcher), `message "${message}" should include "${matcher}"`);
      } else {
        assert.match(message, matcher);
      }
      if (expected?.line !== undefined) {
        assert.equal(error.line, expected.line);
      }
      if (expected?.col !== undefined) {
        assert.equal(error.col, expected.col);
      }
      return true;
    },
  );
}

export function expectSchemaError(
  source: string,
  matcher: RegExp | string,
  expected?: { line?: number; col?: number },
): void {
  assert.throws(
    () => parse(source),
    (error: unknown) => {
      assert.ok(error instanceof SchemaError, `expected SchemaError, got ${error}`);
      const message = error.message;
      if (typeof matcher === 'string') {
        assert.ok(message.includes(matcher), `message "${message}" should include "${matcher}"`);
      } else {
        assert.match(message, matcher);
      }
      if (expected?.line !== undefined) {
        assert.equal(error.line, expected.line);
      }
      if (expected?.col !== undefined) {
        assert.equal(error.col, expected.col);
      }
      return true;
    },
  );
}

export function expectLexError(
  source: string,
  matcher: RegExp | string,
  expected?: { line?: number; col?: number },
): void {
  assert.throws(
    () => tokenize(source),
    (error: unknown) => {
      assert.ok(error instanceof LexError, `expected LexError, got ${error}`);
      const message = error.message;
      if (typeof matcher === 'string') {
        assert.ok(message.includes(matcher), `message "${message}" should include "${matcher}"`);
      } else {
        assert.match(message, matcher);
      }
      if (expected?.line !== undefined) {
        assert.equal(error.line, expected.line);
      }
      if (expected?.col !== undefined) {
        assert.equal(error.col, expected.col);
      }
      return true;
    },
  );
}

export function getField(model: Model, name: string): Field {
  const field = model.fields.find((f) => f.name === name);
  assert.ok(field, `field "${name}" not found`);
  return field;
}

export function getAttr(field: Field, name: string): Attribute {
  const attr = field.attributes.find((a) => a.name === name);
  assert.ok(attr, `attribute "@${name}" not found on field "${field.name}"`);
  return attr;
}

export function getModelAttr(model: Model, name: string): Attribute {
  const attr = model.attributes.find((a) => a.name === name);
  assert.ok(attr, `model attribute "@${name}" not found`);
  return attr;
}

export function getDirective(model: Model, name: string, index = 0): Directive {
  const directives = model.directives.filter((d) => d.name === name);
  assert.ok(
    directives.length > index,
    `directive "@@${name}" #${index} not found (have ${directives.length})`,
  );
  return directives[index];
}

export function tokenTypes(source: string): Array<{ type: TokenType; value: string }> {
  return tokenizeSnippet(source)
    .filter((t) => t.type !== TokenType.EOF)
    .map(({ type, value }) => ({ type, value }));
}

export function assertTypeExpr(
  type: TypeExpr,
  expected: Partial<Pick<TypeExpr, 'name' | 'optional' | 'array'>> & {
    args?: number[];
  },
): void {
  if (expected.name !== undefined) {
    assert.equal(type.name, expected.name);
  }
  if (expected.optional !== undefined) {
    assert.equal(type.optional, expected.optional);
  }
  if (expected.array !== undefined) {
    assert.equal(type.array, expected.array);
  }
  if (expected.args !== undefined) {
    assert.ok(type.args, 'expected type args');
    assert.equal(type.args!.length, expected.args.length);
    for (let i = 0; i < expected.args.length; i++) {
      assert.equal(type.args![i].kind, 'NumberLiteral');
      assert.equal((type.args![i] as { value: number }).value, expected.args[i]);
    }
  }
}

export function assertKeyValueArgs(args: AttributeArgs | undefined): KeyValueArgs {
  assert.ok(args, 'expected args');
  assert.equal(args!.kind, 'KeyValueArgs');
  return args as KeyValueArgs;
}

export function getKvPair(args: KeyValueArgs, key: string) {
  const pair = args.pairs.find((p) => p.key === key);
  assert.ok(pair, `key "${key}" not found`);
  return pair;
}

export function assertValueKind(value: Value, kind: Value['kind']): void {
  assert.equal(value.kind, kind);
}
