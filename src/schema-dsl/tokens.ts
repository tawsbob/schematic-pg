export enum TokenType {
  EXTENSIONS = 'EXTENSIONS',
  ENUMS = 'ENUMS',
  MODELS = 'MODELS',
  MODEL = 'MODEL',

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
}

const KEYWORDS: Record<string, TokenType> = {
  extensions: TokenType.EXTENSIONS,
  enums: TokenType.ENUMS,
  models: TokenType.MODELS,
  model: TokenType.MODEL,
  true: TokenType.BOOLEAN,
  false: TokenType.BOOLEAN,
};

export function keywordTokenType(value: string): TokenType {
  return KEYWORDS[value] ?? TokenType.IDENT;
}
