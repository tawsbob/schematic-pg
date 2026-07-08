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
export declare function discoverHooks(hooksDir: string, schema: Schema): HookDiscoveryResult;
