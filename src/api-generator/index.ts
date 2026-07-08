import type { Schema } from '../schema-dsl/ast.js';
import { DEFAULT_HOOKS_DIR } from '../cli/paths.js';
import { generateAppFile, type AppGeneratorOptions } from './app-generator.js';
import { discoverHooks } from './hook-scanner.js';
import { generateHooksFile } from './hooks-generator.js';
import { generatePoliciesFile } from './policy-generator.js';
import { generateRouteFiles } from './route-generator.js';
import { generateValidationSchemas } from './zod-schema-generator.js';

export interface GeneratedApiFiles {
  app: string;
  policies: string;
  validation: string;
  hooks: string;
  routes: Map<string, string>;
}

export interface GenerateApiFilesOptions {
  customRoutesDir?: string;
  hooksDir?: string;
}

export function generateApiFiles(schema: Schema, options?: GenerateApiFilesOptions): GeneratedApiFiles {
  const appOptions: AppGeneratorOptions | undefined = options?.customRoutesDir
    ? { customRoutesDir: options.customRoutesDir }
    : undefined;
  const hooksDir = options?.hooksDir ?? DEFAULT_HOOKS_DIR;
  const { entries: hookEntries, modelsWithHooks } = discoverHooks(hooksDir, schema);

  return {
    app: generateAppFile(schema, appOptions),
    policies: generatePoliciesFile(schema),
    validation: generateValidationSchemas(schema),
    hooks: generateHooksFile(hookEntries),
    routes: generateRouteFiles(schema, modelsWithHooks),
  };
}
