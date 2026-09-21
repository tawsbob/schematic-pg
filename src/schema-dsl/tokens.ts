export enum TokenType {
  EXTENSIONS = 'EXTENSIONS',
  ENUMS = 'ENUMS',
  PREDICATES = 'PREDICATES',
  MODELS = 'MODELS',
  MODEL = 'MODEL',
  VIEWS = 'VIEWS',
  VIEW = 'VIEW',
  MATERIALIZED = 'MATERIALIZED',
  FUNCTIONS = 'FUNCTIONS',
  FUNCTION = 'FUNCTION',
  CRON = 'CRON',
  JOB = 'JOB',

  STRING = 'STRING',
  TRIPLE_STRING = 'TRIPLE_STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',

  IDENT = 'IDENT',

  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COLON = 'COLON',
  COMMA = 'COMMA',
  QUESTION = 'QUESTION',

  AT = 'AT',
  ATAT = 'ATAT',

  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  start: number;
  end: number;
}

const KEYWORDS: Record<string, TokenType> = {
  extensions: TokenType.EXTENSIONS,
  enums: TokenType.ENUMS,
  predicates: TokenType.PREDICATES,
  models: TokenType.MODELS,
  model: TokenType.MODEL,
  views: TokenType.VIEWS,
  view: TokenType.VIEW,
  materialized: TokenType.MATERIALIZED,
  functions: TokenType.FUNCTIONS,
  function: TokenType.FUNCTION,
  cron: TokenType.CRON,
  job: TokenType.JOB,
  true: TokenType.BOOLEAN,
  false: TokenType.BOOLEAN,
};

export function keywordTokenType(value: string): TokenType {
  return KEYWORDS[value] ?? TokenType.IDENT;
}
