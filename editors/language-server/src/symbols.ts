import type { Schema } from 'postgrest-schema-dsl/schema-dsl';
import {
  DocumentSymbol,
  SymbolKind as LspSymbolKind,
} from 'vscode-languageserver';
import type { SchemaIndex } from './schema-index.js';
import { buildSchemaIndex } from './schema-index.js';

export function getDocumentSymbols(schema: Schema): DocumentSymbol[] {
  const index = buildSchemaIndex(schema);
  const symbols: DocumentSymbol[] = [];

  for (const enumDef of schema.enums) {
    const enumSymbol = index.enums.get(enumDef.name);
    if (!enumSymbol) {
      continue;
    }

    symbols.push(
      DocumentSymbol.create(
        enumDef.name,
        LspSymbolKind.Enum,
        enumSymbol.range,
        enumSymbol.range,
        enumDef.values.map((value) =>
          DocumentSymbol.create(
            value,
            LspSymbolKind.EnumMember,
            enumSymbol.range,
            enumSymbol.range,
          ),
        ),
      ),
    );
  }

  for (const model of schema.models) {
    const modelSymbol = index.models.get(model.name);
    if (!modelSymbol) {
      continue;
    }

    const children: DocumentSymbol[] = model.fields.map((field) => {
      const fieldSymbol = index.fields.get(`${model.name}.${field.name}`);
      const range = fieldSymbol?.range ?? modelSymbol.range;
      return DocumentSymbol.create(field.name, LspSymbolKind.Field, range, range);
    });

    for (const directive of model.directives) {
      const range = index.models.get(model.name)?.range ?? modelSymbol.range;
      children.push(
        DocumentSymbol.create(`@@${directive.name}`, LspSymbolKind.Event, range, range),
      );
    }

    symbols.push(
      DocumentSymbol.create(
        model.name,
        LspSymbolKind.Class,
        modelSymbol.range,
        modelSymbol.range,
        children,
      ),
    );
  }

  return symbols;
}
