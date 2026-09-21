import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';

const MIGRATIONS_DIR = 'migrations';
const MIGRATIONS_TABLE = '_schema_migrations';

export interface MigrationFile {
  id: number;
  name: string;
  filename: string;
  path: string;
}

export function getMigrationsDir(cwd = process.cwd()): string {
  return join(cwd, MIGRATIONS_DIR);
}

export function ensureMigrationsDir(cwd = process.cwd()): string {
  const dir = getMigrationsDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function listMigrationFiles(cwd = process.cwd()): MigrationFile[] {
  const dir = getMigrationsDir(cwd);
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((filename) => filename.endsWith('.sql'))
    .map((filename) => {
      const match = /^(\d+)_(.+)\.sql$/.exec(filename);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      return {
        id: Number(match[1]),
        name: match[2],
        filename,
        path: join(dir, filename),
      };
    })
    .sort((left, right) => left.id - right.id);
}

export function createMigration(name: string, sql: string, cwd = process.cwd()): MigrationFile {
  const dir = ensureMigrationsDir(cwd);
  const existing = listMigrationFiles(cwd);
  const nextId = existing.length > 0 ? existing[existing.length - 1].id + 1 : 1;
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${String(nextId).padStart(4, '0')}_${sanitizedName}.sql`;
  const path = join(dir, filename);

  writeFileSync(path, sql, 'utf8');

  return {
    id: nextId,
    name: sanitizedName,
    filename,
    path,
  };
}

export async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrationFilenames(client: PoolClient): Promise<Set<string>> {
  await ensureMigrationsTable(client);
  const result = await client.query<{ filename: string }>(
    `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id`,
  );
  return new Set(result.rows.map((row) => row.filename));
}

export async function listPendingMigrations(
  client: PoolClient,
  cwd = process.cwd(),
): Promise<MigrationFile[]> {
  const applied = await getAppliedMigrationFilenames(client);
  return listMigrationFiles(cwd).filter((migration) => !applied.has(migration.filename));
}

export async function recordAppliedMigration(
  client: PoolClient,
  migration: MigrationFile,
): Promise<void> {
  await client.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (id, name, filename) VALUES ($1, $2, $3)`,
    [migration.id, migration.name, migration.filename],
  );
}

export function readMigrationSql(migration: MigrationFile): string {
  return readFileSync(migration.path, 'utf8');
}

export const DESTRUCTIVE_MIGRATION_KINDS = new Set([
  'DropTable',
  'DropColumn',
  'DropConstraint',
  'DropIndex',
  'DropExtension',
  'DropTrigger',
  'DropPartition',
  'ConvertToPartitioned',
  'ConvertFromPartitioned',
]);
