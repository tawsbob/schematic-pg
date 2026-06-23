export interface SourceLocation {
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
}

export interface Schema {
  kind: 'Schema';
  extensions: Extension[];
  enums: Enum[];
  models: Model[];
  loc: SourceLocation;
}

export interface Extension {
  kind: 'Extension';
  name: string;
  options?: BlockLiteral;
  loc: SourceLocation;
}

export interface Enum {
  kind: 'Enum';
  name: string;
  values: string[];
  loc: SourceLocation;
}

export interface Model {
  kind: 'Model';
  name: string;
  fields: Field[];
  attributes: Attribute[];
  directives: Directive[];
  loc: SourceLocation;
}

export interface Field {
  kind: 'Field';
  name: string;
  type: TypeExpr;
  attributes: Attribute[];
  loc: SourceLocation;
}

export interface TypeExpr {
  kind: 'TypeExpr';
  name: string;
  args?: Value[];
  optional?: boolean;
  array?: boolean;
  loc: SourceLocation;
}

export interface Attribute {
  kind: 'Attribute';
  name: string;
  args?: AttributeArgs;
  loc: SourceLocation;
}

export type AttributeArgs =
  | KeyValueArgs
  | ExpressionArgs;

export interface KeyValueArgs {
  kind: 'KeyValueArgs';
  pairs: KeyValuePair[];
}

export interface ExpressionArgs {
  kind: 'ExpressionArgs';
  expressions: Value[];
}

export interface Directive {
  kind: 'Directive';
  name: string;
  args?: AttributeArgs;
  loc: SourceLocation;
}

export interface KeyValuePair {
  key: string;
  value: Value;
  loc?: SourceLocation;
}

export type Value =
  | StringLiteral
  | TripleStringLiteral
  | NumberLiteral
  | BooleanLiteral
  | Identifier
  | ArrayLiteral
  | BlockLiteral
  | CallExpression;

export interface StringLiteral {
  kind: 'StringLiteral';
  value: string;
}

export interface TripleStringLiteral {
  kind: 'TripleStringLiteral';
  value: string;
}

export interface NumberLiteral {
  kind: 'NumberLiteral';
  value: number;
}

export interface BooleanLiteral {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface Identifier {
  kind: 'Identifier';
  name: string;
}

export interface ArrayLiteral {
  kind: 'ArrayLiteral';
  elements: Value[];
}

export interface BlockLiteral {
  kind: 'BlockLiteral';
  pairs: KeyValuePair[];
}

export interface CallExpression {
  kind: 'CallExpression';
  callee: string;
  args: Value[];
}
