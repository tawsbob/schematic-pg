import { Location, Position } from 'vscode-languageserver';
import type { SchemaIndex } from './schema-index.js';
import { findDefinition } from './schema-index.js';
import { getWordAtPosition } from './utils.js';

export function getDefinition(
  documentUri: string,
  text: string,
  position: Position,
  index: SchemaIndex,
): Location | undefined {
  const word = getWordAtPosition(text, position);
  if (!word) {
    return undefined;
  }

  const symbol = findDefinition(index, word);
  if (!symbol) {
    return undefined;
  }

  return Location.create(documentUri, symbol.range);
}
