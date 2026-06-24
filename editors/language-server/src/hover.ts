import type { Schema } from 'postgrest-schema-dsl/schema-dsl';
import { Position } from 'vscode-languageserver';
import type { SchemaIndex } from './schema-index.js';
import { findDefinition, getEnumValues } from './schema-index.js';
import { getWordAtPosition } from './utils.js';

export function getHover(
  text: string,
  position: Position,
  schema: Schema | undefined,
  index: SchemaIndex,
): { contents: string } | undefined {
  const word = getWordAtPosition(text, position);
  if (!word) {
    return undefined;
  }

  const definition = findDefinition(index, word);
  if (definition) {
    if (definition.kind === 'enum' && schema) {
      const values = getEnumValues(schema, word);
      return {
        contents: `**enum ${word}**\n\nValues: ${values.join(', ')}`,
      };
    }

    if (definition.kind === 'model' && schema) {
      const model = schema.models.find((entry) => entry.name === word);
      const fieldCount = model?.fields.length ?? 0;
      return {
        contents: `**model ${word}**\n\nFields: ${fieldCount}`,
      };
    }
  }

  for (const [fieldKey, fieldSymbol] of index.fields.entries()) {
    if (fieldSymbol.name === word) {
      return {
        contents: `**field ${fieldKey}**\n\nType: ${fieldSymbol.detail ?? 'unknown'}`,
      };
    }
  }

  const attributeMatch = text
    .split('\n')
    [position.line]?.slice(0, position.character)
    .match(/@([\w]+)/);
  if (attributeMatch) {
    return {
      contents: `**@${attributeMatch[1]}** attribute`,
    };
  }

  return undefined;
}
