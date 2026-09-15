import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from '../schema-dsl/index.js';
import type { Schema } from '../schema-dsl/ast.js';

const SNAPSHOT_DIR = '.schema-state';
const SNAPSHOT_FILE = 'app.schema';

export function getSnapshotPath(cwd = process.cwd()): string {
  return join(cwd, SNAPSHOT_DIR, SNAPSHOT_FILE);
}

export function snapshotExists(cwd = process.cwd()): boolean {
  return existsSync(getSnapshotPath(cwd));
}

export function readSnapshotSource(cwd = process.cwd()): string | null {
  const snapshotPath = getSnapshotPath(cwd);
  if (!existsSync(snapshotPath)) {
    return null;
  }
  return readFileSync(snapshotPath, 'utf8');
}

export function readSnapshotSchema(cwd = process.cwd()): Schema | null {
  const source = readSnapshotSource(cwd);
  return source ? parse(source) : null;
}

export function writeSnapshotSource(source: string, cwd = process.cwd()): void {
  const snapshotPath = getSnapshotPath(cwd);
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, source, 'utf8');
}

export function writeSnapshot(sourcePath: string, cwd = process.cwd()): void {
  writeSnapshotSource(readFileSync(sourcePath, 'utf8'), cwd);
}

export function ensureSnapshot(schemaPath: string, cwd = process.cwd()): void {
  if (!snapshotExists(cwd)) {
    writeSnapshot(schemaPath, cwd);
  }
}
