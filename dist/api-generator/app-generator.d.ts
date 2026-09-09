import type { Schema } from '../schema-dsl/ast.js';
import { type CustomRouteMountEntry } from './custom-route-scanner.js';
export interface AppGeneratorOptions {
    customRoutesDir?: string;
    /** When provided, skip re-discovering and use these standalone mounts only. */
    standaloneCustomRoutes?: CustomRouteMountEntry[];
    overlays?: ReadonlyMap<string, CustomRouteMountEntry>;
}
export declare class AppGenerator {
    private readonly schema;
    private readonly options;
    constructor(schema: Schema, options?: AppGeneratorOptions);
    generate(): string;
    private resolveStandaloneCustomRoutes;
}
export declare function generateAppFile(schema: Schema, options?: AppGeneratorOptions): string;
