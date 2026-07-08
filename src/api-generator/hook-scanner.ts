import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Schema } from '../schema-dsl/ast.js';

export interface HookMountEntry {
  modelName: string;
  importName: string;
  importPath: string;
}

export interface HookDiscoveryResult {
  entries: HookMountEntry[];
  modelsWithHooks: Set<string>;
}

function isHookFile(filename: string): boolean {
  return (
    filename.endsWith('.ts') &&
    !filename.endsWith('.test.ts') &&
    !filename.endsWith('.d.ts') &&
    !filename.startsWith('_')
  );
}

function toHookImportName(modelName: string): string {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}Hooks`;
}

export function discoverHooks(hooksDir: string, schema: Schema): HookDiscoveryResult {
  if (!existsSync(hooksDir)) {
    return { entries: [], modelsWithHooks: new Set() };
  }

  const modelNames = new Set(schema.models.map((model) => model.name));
  const entries: HookMountEntry[] = [];
  const modelsWithHooks = new Set<string>();

  for (const filename of readdirSync(hooksDir)) {
    if (!isHookFile(filename)) {
      continue;
    }

    const modelName = filename.replace(/\.ts$/, '');

    if (!modelNames.has(modelName)) {
      console.warn(`Skipping hook file "${filename}": no matching model in schema`);
      continue;
    }

    entries.push({
      modelName,
      importName: toHookImportName(modelName),
      importPath: `../src/hooks/${modelName}.js`,
    });
    modelsWithHooks.add(modelName);
  }

  entries.sort((left, right) => left.modelName.localeCompare(right.modelName));

  return { entries, modelsWithHooks };
}
