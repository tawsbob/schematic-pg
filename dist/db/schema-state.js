import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from '../schema-dsl/index.js';
const SNAPSHOT_DIR = '.schema-state';
const SNAPSHOT_FILE = 'app.schema';
export function getSnapshotPath(cwd = process.cwd()) {
    return join(cwd, SNAPSHOT_DIR, SNAPSHOT_FILE);
}
export function snapshotExists(cwd = process.cwd()) {
    return existsSync(getSnapshotPath(cwd));
}
export function readSnapshotSource(cwd = process.cwd()) {
    const snapshotPath = getSnapshotPath(cwd);
    if (!existsSync(snapshotPath)) {
        return null;
    }
    return readFileSync(snapshotPath, 'utf8');
}
export function readSnapshotSchema(cwd = process.cwd()) {
    const source = readSnapshotSource(cwd);
    return source ? parse(source) : null;
}
export function writeSnapshotSource(source, cwd = process.cwd()) {
    const snapshotPath = getSnapshotPath(cwd);
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, source, 'utf8');
}
export function writeSnapshot(sourcePath, cwd = process.cwd()) {
    writeSnapshotSource(readFileSync(sourcePath, 'utf8'), cwd);
}
export function ensureSnapshot(schemaPath, cwd = process.cwd()) {
    if (!snapshotExists(cwd)) {
        writeSnapshot(schemaPath, cwd);
    }
}
