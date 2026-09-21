import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Schema } from '../schema-dsl/ast.js';
import { toRouteBasePath, toRouteImportName } from '../api/utils/route-naming.js';

export interface CustomRouteMountEntry {
  basePath: string;
  importName: string;
  /** Import path relative to generated/app.ts */
  importPath: string;
  /** Import path relative to generated/routes/*.ts */
  routeImportPath: string;
}

export interface PartitionedCustomRoutes {
  overlays: Map<string, CustomRouteMountEntry>;
  standalone: CustomRouteMountEntry[];
}

function isRouteFile(filename: string): boolean {
  return (
    filename.endsWith('.ts') &&
    !filename.endsWith('.test.ts') &&
    !filename.endsWith('.d.ts') &&
    !filename.startsWith('_')
  );
}

function isSkippedDir(dirname: string): boolean {
  return dirname.startsWith('_');
}

function scanDirectory(
  customRoutesDir: string,
  relativeDir: string,
  entries: CustomRouteMountEntry[],
): void {
  const absoluteDir = relativeDir ? path.join(customRoutesDir, relativeDir) : customRoutesDir;

  for (const entry of readdirSync(absoluteDir)) {
    const entryRelativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    const absolutePath = path.join(customRoutesDir, entryRelativePath);

    if (statSync(absolutePath).isDirectory()) {
      if (!isSkippedDir(entry)) {
        scanDirectory(customRoutesDir, entryRelativePath, entries);
      }
      continue;
    }

    if (!isRouteFile(entry)) {
      continue;
    }

    const basePath = entryRelativePath.replace(/\.ts$/, '').replace(/\\/g, '/');
    entries.push({
      basePath,
      importName: toRouteImportName(basePath),
      importPath: `../src/routes/${basePath}.js`,
      routeImportPath: `../../src/routes/${basePath}.js`,
    });
  }
}

export function discoverCustomRoutes(customRoutesDir: string): CustomRouteMountEntry[] {
  if (!existsSync(customRoutesDir)) {
    return [];
  }

  const entries: CustomRouteMountEntry[] = [];
  scanDirectory(customRoutesDir, '', entries);
  return entries.sort((left, right) => left.basePath.localeCompare(right.basePath));
}

export function partitionCustomRoutes(
  entries: CustomRouteMountEntry[],
  schema: Schema,
): PartitionedCustomRoutes {
  const modelBasePaths = new Map([
    ...schema.models.map((model) => [toRouteBasePath(model.name), model.name] as const),
    ...schema.views.map((view) => [toRouteBasePath(view.name), view.name] as const),
  ]);

  const overlays = new Map<string, CustomRouteMountEntry>();
  const standalone: CustomRouteMountEntry[] = [];

  for (const entry of entries) {
    const modelName = modelBasePaths.get(entry.basePath);
    if (modelName) {
      overlays.set(modelName, entry);
    } else {
      standalone.push(entry);
    }
  }

  return { overlays, standalone };
}
