import { loadSchemaFromArg } from '../../schema-source/index.js';
import type { Schema } from '../ast.js';

let cached: { schema: Schema; canonicalSource: string } | null = null;

/** Load the repo's schema/ fragments (cached per process). */
export function loadRepoSchema(): { schema: Schema; canonicalSource: string } {
  if (!cached) {
    const loaded = loadSchemaFromArg();
    cached = { schema: loaded.schema, canonicalSource: loaded.canonicalSource };
  }
  return cached;
}
