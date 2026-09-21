export var TokenType;
(function (TokenType) {
    TokenType["EXTENSIONS"] = "EXTENSIONS";
    TokenType["ENUMS"] = "ENUMS";
    TokenType["PREDICATES"] = "PREDICATES";
    TokenType["MODELS"] = "MODELS";
    TokenType["MODEL"] = "MODEL";
    TokenType["VIEWS"] = "VIEWS";
    TokenType["VIEW"] = "VIEW";
    TokenType["MATERIALIZED"] = "MATERIALIZED";
    TokenType["FUNCTIONS"] = "FUNCTIONS";
    TokenType["FUNCTION"] = "FUNCTION";
    TokenType["STRING"] = "STRING";
    TokenType["TRIPLE_STRING"] = "TRIPLE_STRING";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["BOOLEAN"] = "BOOLEAN";
    TokenType["IDENT"] = "IDENT";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["COLON"] = "COLON";
    TokenType["COMMA"] = "COMMA";
    TokenType["QUESTION"] = "QUESTION";
    TokenType["AT"] = "AT";
    TokenType["ATAT"] = "ATAT";
    TokenType["EOF"] = "EOF";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
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
    true: TokenType.BOOLEAN,
    false: TokenType.BOOLEAN,
};
export function keywordTokenType(value) {
    return KEYWORDS[value] ?? TokenType.IDENT;
}
