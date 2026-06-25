import type { SourceLocation } from 'schematic-pg/schema-dsl';
import { Position, Range } from 'vscode-languageserver';

export function toRange(loc: SourceLocation): Range {
  const startLine = Math.max(loc.line - 1, 0);
  const startChar = Math.max(loc.col - 1, 0);
  const endLine = Math.max((loc.endLine ?? loc.line) - 1, 0);
  const endChar = Math.max((loc.endCol ?? loc.col + 1) - 1, 0);
  return Range.create(startLine, startChar, endLine, endChar);
}

export function toPosition(loc: SourceLocation): Position {
  return Position.create(Math.max(loc.line - 1, 0), Math.max(loc.col - 1, 0));
}

export function getWordAtPosition(text: string, position: Position): string | undefined {
  const lines = text.split('\n');
  const line = lines[position.line] ?? '';
  if (!line) {
    return undefined;
  }

  const isWordChar = (char: string) => /[a-zA-Z0-9_-]/.test(char);
  let start = position.character;
  let end = position.character;

  while (start > 0 && isWordChar(line[start - 1] ?? '')) {
    start -= 1;
  }

  while (end < line.length && isWordChar(line[end] ?? '')) {
    end += 1;
  }

  const word = line.slice(start, end);
  return word || undefined;
}

export function getLinePrefix(text: string, position: Position): string {
  const lines = text.split('\n');
  return lines[position.line]?.slice(0, position.character) ?? '';
}

export function simpleHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
