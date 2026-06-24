import { LexError, ParseError, parse, type Schema } from 'postgrest-schema-dsl/schema-dsl';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';

export interface ParseResult {
  schema?: Schema;
  diagnostics: Diagnostic[];
}

export function parseDocument(source: string): ParseResult {
  try {
    const schema = parse(source);
    return { schema, diagnostics: [] };
  } catch (error) {
    if (error instanceof LexError || error instanceof ParseError) {
      const line = Math.max(error.line - 1, 0);
      const character = Math.max(error.col - 1, 0);
      return {
        diagnostics: [
          Diagnostic.create(
            Range.create(line, character, line, character + 1),
            error.message,
            DiagnosticSeverity.Error,
            'schema-dsl',
          ),
        ],
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown parse error';
    return {
      diagnostics: [
        Diagnostic.create(
          Range.create(0, 0, 0, 1),
          message,
          DiagnosticSeverity.Error,
          'schema-dsl',
        ),
      ],
    };
  }
}
