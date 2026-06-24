import { Location, Position } from 'vscode-languageserver';
import type { SchemaIndex } from './schema-index.js';
import { findReferences } from './schema-index.js';
import { getWordAtPosition } from './utils.js';

export function getReferences(
  documentUri: string,
  text: string,
  position: Position,
  index: SchemaIndex,
): Location[] {
  const word = getWordAtPosition(text, position);
  if (!word) {
    return [];
  }

  return findReferences(index, word).map((range) => Location.create(documentUri, range));
}
