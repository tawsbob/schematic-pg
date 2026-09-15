export declare enum TokenType {
    EXTENSIONS = "EXTENSIONS",
    ENUMS = "ENUMS",
    MODELS = "MODELS",
    MODEL = "MODEL",
    FUNCTIONS = "FUNCTIONS",
    FUNCTION = "FUNCTION",
    STRING = "STRING",
    TRIPLE_STRING = "TRIPLE_STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    IDENT = "IDENT",
    LBRACE = "LBRACE",
    RBRACE = "RBRACE",
    LBRACKET = "LBRACKET",
    RBRACKET = "RBRACKET",
    LPAREN = "LPAREN",
    RPAREN = "RPAREN",
    COLON = "COLON",
    COMMA = "COMMA",
    QUESTION = "QUESTION",
    AT = "AT",
    ATAT = "ATAT",
    EOF = "EOF"
}
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
    start: number;
    end: number;
}
export declare function keywordTokenType(value: string): TokenType;
